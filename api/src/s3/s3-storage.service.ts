import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

const allowedContentTypes = new Map([
  ['application/pdf', 'pdf'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
]);
const maxPaymentProofBytes = 10 * 1024 * 1024;

@Injectable()
export class S3StorageService {
  private readonly client = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
  });

  async checkConnection(): Promise<{ status: 'connected' | 'unavailable' | 'not_configured' }> {
    const bucket = process.env.S3_BUCKET?.trim();
    if (!bucket) return { status: 'not_configured' };

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
      return { status: 'connected' };
    } catch {
      return { status: 'unavailable' };
    }
  }

  async createBillUploadUrl(
    billId: string,
    contentType: string,
  ): Promise<{ key: string; url: string; expiresIn: number }> {
    return this.createUploadUrl('bills', billId, contentType);
  }

  async createPaymentProofUploadUrl(
    paymentId: string,
    contentType: string,
  ): Promise<{ key: string; url: string; expiresIn: number }> {
    return this.createUploadUrl('payment-proofs', paymentId, contentType);
  }

  async storePaymentProof(
    paymentId: string,
    contentType: string,
    content: Buffer,
  ): Promise<{ key: string; storage: 'local' | 's3' }> {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(paymentId)) {
      throw new BadRequestException('Invalid payment identifier');
    }
    if (content.length === 0) {
      throw new BadRequestException('Payment proof file is empty');
    }
    if (content.length > maxPaymentProofBytes) {
      throw new PayloadTooLargeException('Payment proof must be 10 MB or smaller');
    }

    const extension = this.normalizeContentType(contentType);
    if (!extension || !this.matchesFileSignature(content, extension)) {
      throw new BadRequestException('Choose a valid PDF, JPG, or PNG file');
    }

    const key = `${process.env.S3_BUCKET?.trim() ? 'payment-proofs' : 'local-payment-proofs'}/${paymentId}/${randomUUID()}.${extension}`;
    const bucket = process.env.S3_BUCKET?.trim();
    if (bucket) {
      await this.client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: content,
        ContentLength: content.length,
        ContentType: contentType,
      }));
      return { key, storage: 's3' };
    }

    const directory = this.localPaymentProofDirectory(paymentId);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, key.split('/')[2]), content, { flag: 'wx' });
    return { key, storage: 'local' };
  }

  async createDownloadUrl(key: string): Promise<{ url: string; expiresIn: number }> {
    this.assertValidKey(key);

    const expiresIn = 300;
    const bucket = this.requireBucket();
    await this.assertObjectExists(bucket, key);

    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return { url: await getSignedUrl(this.client, command, { expiresIn }), expiresIn };
  }

  async confirmUploadedObject(key: string): Promise<void> {
    this.assertValidKey(key);
    await this.assertObjectExists(this.requireBucket(), key);
  }

  async readLocalPaymentProof(paymentId: string, key: string): Promise<{ content: Buffer; contentType: string }> {
    const match = key.match(/^local-payment-proofs\/([A-Za-z0-9_-]{1,128})\/([A-Za-z0-9-]+\.(pdf|jpg|png))$/);
    if (!match || match[1] !== paymentId) {
      throw new NotFoundException('Payment proof not found');
    }

    try {
      const filename = match[2];
      let content: Buffer;
      try {
        content = await readFile(join(this.localPaymentProofDirectory(paymentId), filename));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        const correctDirectory = this.localPaymentProofDirectory(paymentId);
        const legacyDirectory = this.legacyLocalPaymentProofDirectory(paymentId);
        if (legacyDirectory === correctDirectory) throw error;
        content = await readFile(join(legacyDirectory, filename));
      }
      const contentType = match[3] === 'pdf' ? 'application/pdf' : match[3] === 'jpg' ? 'image/jpeg' : 'image/png';
      return { content, contentType };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException('Payment proof not found');
      }
      throw new ServiceUnavailableException('Unable to read the local payment proof');
    }
  }

  private async createUploadUrl(
    category: 'bills' | 'payment-proofs',
    recordId: string,
    contentType: string,
  ): Promise<{ key: string; url: string; expiresIn: number }> {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(recordId)) {
      throw new ServiceUnavailableException('Invalid record identifier');
    }

    const extension = this.normalizeContentType(contentType);
    if (!extension) throw new ServiceUnavailableException('Unsupported file type');

    const key = `${category}/${recordId}/${randomUUID()}.${extension}`;
    const expiresIn = 300;
    const command = new PutObjectCommand({
      Bucket: this.requireBucket(),
      Key: key,
      ContentType: contentType,
    });
    const url = await getSignedUrl(this.client, command, { expiresIn });
    return { key, url, expiresIn };
  }

  private requireBucket(): string {
    const bucket = process.env.S3_BUCKET?.trim();
    if (!bucket) throw new ServiceUnavailableException('S3 storage is not configured');
    return bucket;
  }

  private localPaymentProofDirectory(paymentId: string): string {
    const workingDirectory = resolve(process.cwd());
    const apiDirectory = basename(workingDirectory).toLowerCase() === 'api'
      ? workingDirectory
      : join(workingDirectory, 'api');
    return resolve(apiDirectory, 'local-storage', 'payment-proofs', paymentId);
  }

  private legacyLocalPaymentProofDirectory(paymentId: string): string {
    return resolve(process.cwd(), 'api', 'local-storage', 'payment-proofs', paymentId);
  }

  private matchesFileSignature(content: Buffer, extension: string): boolean {
    if (extension === 'pdf') return content.subarray(0, 5).toString('ascii') === '%PDF-';
    if (extension === 'jpg') return content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff;
    return content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }

  private assertValidKey(key: string): void {
    if (!/^(bills|payment-proofs)\/[A-Za-z0-9_-]+\/[A-Za-z0-9-]+\.(pdf|jpg|png)$/.test(key)) {
      throw new ServiceUnavailableException('Invalid storage key');
    }
  }

  private async assertObjectExists(bucket: string, key: string): Promise<void> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    } catch (error) {
      const statusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      const errorName = (error as { name?: string }).name;
      if (statusCode === 404 || errorName === 'NotFound' || errorName === 'NoSuchKey') {
        throw new NotFoundException('Stored file was not found');
      }
      throw new ServiceUnavailableException('Unable to verify the stored file');
    }
  }

  private normalizeContentType(contentType: string): string | undefined {
    const normalized = contentType.trim().split(';', 1)[0]?.trim().toLowerCase();
    return normalized ? allowedContentTypes.get(normalized) : undefined;
  }
}
