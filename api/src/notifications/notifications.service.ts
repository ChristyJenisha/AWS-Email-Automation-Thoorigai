import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getBatchOrganizationId(batchId: string): Promise<string> {
    const batch = await this.prisma.batch.findUnique({
      where: { id: batchId },
      select: { organizationId: true },
    });

    if (!batch) {
      throw new NotFoundException('Batch not found');
    }

    return batch.organizationId;
  }

  async assertNotificationBelongsToBatch(notificationId: string, batchId: string): Promise<void> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, batchId },
      select: { id: true },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found for this batch');
    }
  }

  async listByBatch(batchId: string) {
    return this.prisma.notification.findMany({
      where: { batchId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async queue(batchId: string, recipient: string, stepInstanceId?: string) {
    if (!recipient.trim()) {
      throw new Error('Notification recipient is required');
    }

    return this.prisma.notification.create({
      data: {
        batchId,
        stepInstanceId: stepInstanceId ?? null,
        recipient: recipient.trim(),
        status: NotificationStatus.PENDING,
      },
    });
  }

  async markSent(notificationId: string, batchId: string) {
    const updated = await this.prisma.notification.updateMany({
      where: { id: notificationId, batchId, status: NotificationStatus.PENDING },
      data: { status: NotificationStatus.SENT, sentAt: new Date() },
    });

    if (updated.count !== 1) {
      throw new NotFoundException('Notification not found or already processed');
    }

    return { id: notificationId, status: NotificationStatus.SENT };
  }

  async markFailed(notificationId: string, error: string) {
    const updated = await this.prisma.notification.updateMany({
      where: { id: notificationId },
      data: { status: NotificationStatus.FAILED, error: error.trim() || 'unknown_error' },
    });

    if (updated.count !== 1) {
      throw new NotFoundException('Notification not found');
    }

    return { id: notificationId, status: NotificationStatus.FAILED };
  }
}
