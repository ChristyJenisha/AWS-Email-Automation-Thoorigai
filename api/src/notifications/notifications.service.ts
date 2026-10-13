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

  async handleSnsEvent(payload: any) {
    if (!payload || typeof payload !== 'object') {
      return { status: 'ignored', reason: 'invalid_payload' };
    }

    // 1. AWS SNS Topic Subscription Confirmation
    if (payload.Type === 'SubscriptionConfirmation' && payload.SubscribeURL) {
      try {
        const response = await fetch(payload.SubscribeURL);
        console.log(`[SNS_SUBSCRIPTION_CONFIRMED] Topic: ${payload.TopicArn}, status: ${response.status}`);
        return { status: 'confirmed', topicArn: payload.TopicArn };
      } catch (error) {
        console.error('[SNS_SUBSCRIPTION_ERROR]', error);
        return { status: 'subscription_failed', error: String(error) };
      }
    }

    // 2. AWS SES Event Notifications via SNS
    if (payload.Type === 'Notification') {
      let message = payload.Message;
      if (typeof message === 'string') {
        try {
          message = JSON.parse(message);
        } catch {
          // payload was plain string
        }
      }

      if (message && typeof message === 'object') {
        const eventType = message.notificationType || message.eventType;

        if (eventType === 'Bounce' && message.bounce) {
          return this.processSesBounce(message.bounce);
        }

        if (eventType === 'Complaint' && message.complaint) {
          return this.processSesComplaint(message.complaint);
        }
      }

      return { status: 'processed', note: 'unhandled_notification_type' };
    }

    return { status: 'ignored', reason: 'unknown_message_type' };
  }

  private async processSesBounce(bounce: {
    bounceType?: string;
    bounceSubType?: string;
    bouncedRecipients?: Array<{ emailAddress: string; status?: string; diagnosticCode?: string }>;
  }) {
    const recipients = bounce.bouncedRecipients ?? [];
    const bounceType = bounce.bounceType || 'Unknown';
    const isPermanent = bounceType.toLowerCase() === 'permanent';

    for (const recipient of recipients) {
      const email = recipient.emailAddress?.toLowerCase().trim();
      if (!email) continue;

      const diagnostic = recipient.diagnosticCode || recipient.status || '';
      const errorMsg = `SES Bounce: ${bounceType} (${diagnostic})`;

      await this.prisma.notification.updateMany({
        where: { recipient: email, status: { in: [NotificationStatus.PENDING, NotificationStatus.SENT] } },
        data: { status: NotificationStatus.FAILED, error: errorMsg },
      });

      const contacts = await this.prisma.contact.findMany({
        where: { email },
        select: { id: true, name: true, organizationId: true },
      });

      for (const contact of contacts) {
        if (isPermanent) {
          await this.prisma.contact.update({
            where: { id: contact.id },
            data: { isActive: false },
          });
        }

        await this.prisma.auditLog.create({
          data: {
            entityType: 'contact',
            entityId: contact.id,
            action: isPermanent ? 'email_hard_bounced' : 'email_soft_bounced',
            actor: 'aws-ses',
            detail: {
              email,
              bounceType,
              bounceSubType: bounce.bounceSubType,
              diagnostic,
              deactivated: isPermanent,
            },
          },
        });
      }
    }

    return { status: 'processed', type: 'bounce', count: recipients.length };
  }

  private async processSesComplaint(complaint: {
    complainedRecipients?: Array<{ emailAddress: string }>;
  }) {
    const recipients = complaint.complainedRecipients ?? [];

    for (const recipient of recipients) {
      const email = recipient.emailAddress?.toLowerCase().trim();
      if (!email) continue;

      await this.prisma.notification.updateMany({
        where: { recipient: email },
        data: { status: NotificationStatus.FAILED, error: 'SES Complaint received' },
      });

      const contacts = await this.prisma.contact.findMany({
        where: { email },
        select: { id: true },
      });

      for (const contact of contacts) {
        await this.prisma.contact.update({
          where: { id: contact.id },
          data: { isActive: false },
        });

        await this.prisma.auditLog.create({
          data: {
            entityType: 'contact',
            entityId: contact.id,
            action: 'email_complaint',
            actor: 'aws-ses',
            detail: { email, deactivated: true },
          },
        });
      }
    }

    return { status: 'processed', type: 'complaint', count: recipients.length };
  }
}
