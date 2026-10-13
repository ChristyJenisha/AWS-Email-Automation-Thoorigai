import { NotificationStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from './notifications.service.js';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: {
    batch: { findUnique: ReturnType<typeof vi.fn> };
    notification: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    contact: {
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    auditLog: {
      create: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    prisma = {
      batch: { findUnique: vi.fn() },
      notification: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      contact: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    };
    service = new NotificationsService(prisma as unknown as PrismaService);
  });

  it('queues a pending notification for a valid recipient', async () => {
    prisma.notification.create.mockResolvedValue({
      id: 'notif-1',
      batchId: 'batch-1',
      recipient: 'user@example.test',
      status: NotificationStatus.PENDING,
    });

    const result = await service.queue('batch-1', 'user@example.test');
    expect(result).toEqual(expect.objectContaining({ id: 'notif-1', recipient: 'user@example.test' }));
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        batchId: 'batch-1',
        recipient: 'user@example.test',
        status: NotificationStatus.PENDING,
      }),
    });
  });

  it('marks a pending notification as sent with timestamp', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.markSent('notif-1', 'batch-1');
    expect(result).toEqual({ id: 'notif-1', status: NotificationStatus.SENT });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'notif-1', batchId: 'batch-1', status: NotificationStatus.PENDING },
      data: expect.objectContaining({ status: NotificationStatus.SENT }),
    });
  });

  it('confirms an AWS SNS topic subscription via HTTP GET', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    const payload = {
      Type: 'SubscriptionConfirmation',
      TopicArn: 'arn:aws:sns:ap-south-1:123456789:ses-events',
      SubscribeURL: 'https://sns.ap-south-1.amazonaws.com/?Action=ConfirmSubscription&TopicArn=...',
    };

    const result = await service.handleSnsEvent(payload);
    expect(result).toEqual({ status: 'confirmed', topicArn: payload.TopicArn });
    expect(fetchMock).toHaveBeenCalledWith(payload.SubscribeURL);

    vi.unstubAllGlobals();
  });

  it('handles a permanent SES bounce by failing notifications and deactivating contacts', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 2 });
    prisma.contact.findMany.mockResolvedValue([
      { id: 'contact-1', name: 'Bad Recipient', organizationId: 'demo-org' },
    ]);
    prisma.contact.update.mockResolvedValue({ id: 'contact-1', isActive: false });
    prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

    const payload = {
      Type: 'Notification',
      Message: JSON.stringify({
        notificationType: 'Bounce',
        bounce: {
          bounceType: 'Permanent',
          bounceSubType: 'General',
          bouncedRecipients: [
            {
              emailAddress: 'bad-email@example.test',
              status: '5.1.1',
              diagnosticCode: 'smtp; 550 5.1.1 User does not exist',
            },
          ],
        },
      }),
    };

    const result = await service.handleSnsEvent(payload);
    expect(result).toEqual({ status: 'processed', type: 'bounce', count: 1 });

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        recipient: 'bad-email@example.test',
        status: { in: [NotificationStatus.PENDING, NotificationStatus.SENT] },
      },
      data: expect.objectContaining({
        status: NotificationStatus.FAILED,
        error: expect.stringContaining('Permanent'),
      }),
    });

    expect(prisma.contact.update).toHaveBeenCalledWith({
      where: { id: 'contact-1' },
      data: { isActive: false },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: 'contact',
        entityId: 'contact-1',
        action: 'email_hard_bounced',
        actor: 'aws-ses',
      }),
    });
  });

  it('handles an SES spam complaint by deactivating the contact', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 1 });
    prisma.contact.findMany.mockResolvedValue([{ id: 'contact-1' }]);
    prisma.contact.update.mockResolvedValue({ id: 'contact-1', isActive: false });
    prisma.auditLog.create.mockResolvedValue({ id: 'audit-2' });

    const payload = {
      Type: 'Notification',
      Message: JSON.stringify({
        notificationType: 'Complaint',
        complaint: {
          complainedRecipients: [{ emailAddress: 'complaining-user@example.test' }],
        },
      }),
    };

    const result = await service.handleSnsEvent(payload);
    expect(result).toEqual({ status: 'processed', type: 'complaint', count: 1 });

    expect(prisma.contact.update).toHaveBeenCalledWith({
      where: { id: 'contact-1' },
      data: { isActive: false },
    });
  });
});
