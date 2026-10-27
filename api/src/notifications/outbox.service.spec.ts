import { OutboxStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { OutboxService } from './outbox.service.js';

describe('OutboxService', () => {
  let service: OutboxService;
  let prisma: {
    outbox: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let emailService: {
    sendReminderEmail: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    prisma = {
      outbox: {
        create: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
    };
    emailService = {
      sendReminderEmail: vi.fn(),
    };
    service = new OutboxService(
      prisma as unknown as PrismaService,
      emailService as unknown as EmailService,
    );
  });

  it('enqueues an email message into the outbox table with PENDING status', async () => {
    prisma.outbox.create.mockResolvedValue({ id: 'outbox-1' });

    await service.enqueue({
      recipient: 'approver@example.com',
      subject: 'Approval Needed',
      body: 'Please approve batch 1',
    });

    expect(prisma.outbox.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        channel: 'email',
        recipient: 'approver@example.com',
        subject: 'Approval Needed',
        body: 'Please approve batch 1',
        status: OutboxStatus.PENDING,
      }),
    });
  });

  it('processes pending outbox items and marks them SENT on delivery success', async () => {
    prisma.outbox.findMany.mockResolvedValue([
      {
        id: 'outbox-1',
        recipient: 'approver@example.com',
        subject: 'Subject 1',
        body: 'Body 1',
        html: '<p>Body 1</p>',
        attempts: 0,
      },
    ]);
    emailService.sendReminderEmail.mockResolvedValue({ status: 'sent', provider: 'ses' });
    prisma.outbox.update.mockResolvedValue({ id: 'outbox-1' });

    const stats = await service.processPending(10);

    expect(stats).toEqual({ processed: 1, sent: 1, failed: 0 });
    expect(emailService.sendReminderEmail).toHaveBeenCalledWith({
      to: 'approver@example.com',
      subject: 'Subject 1',
      body: 'Body 1',
      html: '<p>Body 1</p>',
    });
    expect(prisma.outbox.update).toHaveBeenCalledWith({
      where: { id: 'outbox-1' },
      data: expect.objectContaining({ status: OutboxStatus.SENT }),
    });
  });

  it('increments attempts on delivery failure and marks item DEAD after 5 attempts', async () => {
    prisma.outbox.findMany.mockResolvedValue([
      {
        id: 'outbox-failed',
        recipient: 'invalid@example.com',
        subject: 'Subject',
        body: 'Body',
        attempts: 4, // 5th attempt will mark dead
      },
    ]);
    emailService.sendReminderEmail.mockRejectedValue(new Error('SMTP connection refused'));
    prisma.outbox.update.mockResolvedValue({ id: 'outbox-failed' });

    const stats = await service.processPending(10);

    expect(stats).toEqual({ processed: 1, sent: 0, failed: 1 });
    expect(prisma.outbox.update).toHaveBeenCalledWith({
      where: { id: 'outbox-failed' },
      data: expect.objectContaining({
        attempts: 5,
        status: OutboxStatus.DEAD,
        lastError: expect.stringContaining('SMTP connection refused'),
        nextRetryAt: null,
      }),
    });
  });
});

