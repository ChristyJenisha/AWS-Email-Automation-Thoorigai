import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

const allowedContentTypes = new Map([
  ['application/pdf', 'pdf'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
]);

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

  async createDownloadUrl(key: string): Promise<{ url: string; expiresIn: number }> {
    if (!/^(bills|payment-proofs)\/[A-Za-z0-9_-]+\/[A-Za-z0-9-]+\.(pdf|jpg|png)$/.test(key)) {
      throw new ServiceUnavailableException('Invalid storage key');
    }

    const expiresIn = 300;
    const command = new GetObjectCommand({ Bucket: this.requireBucket(), Key: key });
    return { url: await getSignedUrl(this.client, command, { expiresIn }), expiresIn };
  }

  private async createUploadUrl(
    category: 'bills' | 'payment-proofs',
    recordId: string,
    contentType: string,
  ): Promise<{ key: string; url: string; expiresIn: number }> {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(recordId)) {
      throw new ServiceUnavailableException('Invalid record identifier');
    }

    const extension = allowedContentTypes.get(contentType);
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
}