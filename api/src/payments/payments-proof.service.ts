import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { S3StorageService } from '../s3/s3-storage.service.js';

@Injectable()
export class PaymentsProofService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3StorageService: S3StorageService,
  ) {}

  async createProofUploadUrl(paymentId: string, contentType: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return this.s3StorageService.createPaymentProofUploadUrl(paymentId, contentType);
  }

  async confirmProofUpload(paymentId: string, key: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (!key.startsWith(`payment-proofs/${paymentId}/`)) {
      throw new BadRequestException('Proof file does not belong to this payment');
    }

    await this.s3StorageService.confirmUploadedObject(key);
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { proofKey: key },
      select: { id: true, proofKey: true },
    });
  }

  async storeProofFile(paymentId: string, contentType: string, content: Buffer) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const stored = await this.s3StorageService.storePaymentProof(paymentId, contentType, content);
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { proofKey: stored.key },
      select: { id: true, proofKey: true },
    });
  }

  async createProofDownloadUrl(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, proofKey: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (!payment.proofKey) {
      throw new NotFoundException('Payment proof not found');
    }

    if (payment.proofKey.startsWith(`local-payment-proofs/${paymentId}/`)) {
      return { local: true as const };
    }
    if (!payment.proofKey.startsWith(`payment-proofs/${paymentId}/`)) {
      throw new NotFoundException('Payment proof not found');
    }

    return this.s3StorageService.createDownloadUrl(payment.proofKey);
  }

  async getLocalProofFile(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { proofKey: true },
    });
    if (!payment?.proofKey?.startsWith(`local-payment-proofs/${paymentId}/`)) {
      throw new NotFoundException('Local payment proof not found');
    }
    return this.s3StorageService.readLocalPaymentProof(paymentId, payment.proofKey);
  }
}
