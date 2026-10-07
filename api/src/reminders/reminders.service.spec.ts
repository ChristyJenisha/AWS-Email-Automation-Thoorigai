import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RemindersService } from './reminders.service.js';

describe('RemindersService', () => {
  let service: RemindersService;
  let prisma: {
    stepInstance: { findMany: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
    notification: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    auditLog: { create: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let emailService: { sendReminderEmail: ReturnType<typeof vi.fn> };
  let workflowTransitions: { generateApprovalToken: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prisma = {
      stepInstance: { findMany: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      notification: { create: vi.fn(), update: vi.fn() },
      auditLog: { create: vi.fn() },
      $transaction: vi.fn((callback) => callback(prisma)),
    };
    emailService = { sendReminderEmail: vi.fn().mockResolvedValue({ status: 'simulated', provider: 'local-dev' }) };
    workflowTransitions = { generateApprovalToken: vi.fn().mockReturnValue('signed-approval-token') };
    service = new RemindersService(
      prisma as any,
      emailService as any,
      workflowTransitions as any,
    );
  });

  it('sends an immediate signed approval link for a newly created batch', async () => {
    prisma.stepInstance.findFirst.mockResolvedValue({
      id: 'step-1',
      batchId: 'batch-1',
      stage: {
        contact: { id: 'approver-1', email: 'approver@example.test' },
        backupContact: null,
      },
      batch: { organizationId: 'demo-org' },
    });
    prisma.notification.create.mockResolvedValue({ id: 'notification-1' });
    prisma.notification.update.mockResolvedValue({ id: 'notification-1', status: 'SENT' });

    const result = await service.sendInitialApproval('batch-1');

    expect(result).toEqual({ status: 'sent', notificationId: 'notification-1' });
    expect(workflowTransitions.generateApprovalToken).toHaveBeenCalledWith('step-1', 'approver-1', 'demo-org');
    expect(emailService.sendReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'approver@example.test',
        subject: 'Approval required for batch batch-1',
        body: expect.stringContaining('/approve?token=signed-approval-token'),
      }),
    );
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notification-1' },
      data: expect.objectContaining({ status: 'SENT' }),
    });
  });

  it('records an initial approval email failure without throwing', async () => {
    prisma.stepInstance.findFirst.mockResolvedValue({
      id: 'step-1',
      batchId: 'batch-1',
      stage: { contact: { id: 'approver-1', email: 'approver@example.test' }, backupContact: null },
      batch: { organizationId: 'demo-org' },
    });
    prisma.notification.create.mockResolvedValue({ id: 'notification-1' });
    emailService.sendReminderEmail.mockRejectedValue(new Error('SES is unavailable'));

    await expect(service.sendInitialApproval('batch-1')).resolves.toEqual({
      status: 'failed',
      notificationId: 'notification-1',
    });
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notification-1' },
      data: { status: 'FAILED', error: 'SES is unavailable' },
    });
  });

  it('creates a reminder notification and increments the reminder count for due steps', async () => {
    const now = new Date('2026-09-30T10:00:00.000Z');
    prisma.stepInstance.findMany.mockResolvedValue([
      {
        id: 'step-1',
        batchId: 'batch-1',
        status: 'ALERTED',
        reminderCount: 0,
        nextReminderAt: now,
        batch: { organizationId: 'demo-org' },
        stage: {
          id: 'stage-1',
          maxReminders: 3,
          reminderIntervalHours: 24,
          contact: { id: 'approver-1', email: 'approver@example.test' },
          backupContact: { id: 'backup-approver-1', email: 'backup@example.test' },
        },
      },
    ]);
    prisma.notification.create.mockResolvedValue({ id: 'notification-1' });
    prisma.notification.update.mockResolvedValue({ id: 'notification-1', status: 'SENT' });
    prisma.stepInstance.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.processDueReminders(now);

    expect(result).toHaveLength(1);
    expect(workflowTransitions.generateApprovalToken).toHaveBeenCalledWith('step-1', 'approver-1', 'demo-org');
    expect(emailService.sendReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'approver@example.test',
        body: expect.stringContaining('http://localhost:3000/approve?token=signed-approval-token'),
      }),
    );
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        batchId: 'batch-1',
        stepInstanceId: 'step-1',
        recipient: 'approver@example.test',
        status: 'PENDING',
      }),
    });
    expect(prisma.stepInstance.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'step-1', status: 'ALERTED', nextReminderAt: { lte: now } },
      data: { nextReminderAt: new Date('2026-09-30T10:05:00.000Z') },
    });
    expect(prisma.stepInstance.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'step-1', status: 'ALERTED', nextReminderAt: new Date('2026-09-30T10:05:00.000Z') },
      data: expect.objectContaining({
        reminderCount: 1,
        nextReminderAt: new Date('2026-10-01T10:00:00.000Z'),
      }),
    });
  });

  it('skips a due step already claimed by another sweep', async () => {
    const now = new Date('2026-09-30T10:00:00.000Z');
    prisma.stepInstance.findMany.mockResolvedValue([{
      id: 'step-1', batchId: 'batch-1', reminderCount: 0,
      stage: { maxReminders: 3, reminderIntervalHours: 24, contact: { id: 'approver-1', email: 'approver@example.test' } },
      batch: { organizationId: 'demo-org', organization: { contacts: [] } },
    }]);
    prisma.stepInstance.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.processDueReminders(now);

    expect(result).toEqual([]);
    expect(emailService.sendReminderEmail).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('records failed delivery and retries after the lease without incrementing reminders', async () => {
    const now = new Date('2026-09-30T10:00:00.000Z');
    prisma.stepInstance.findMany.mockResolvedValue([{
      id: 'step-1', batchId: 'batch-1', reminderCount: 0,
      stage: { maxReminders: 3, reminderIntervalHours: 24, contact: { id: 'approver-1', email: 'approver@example.test' } },
      batch: { organizationId: 'demo-org', organization: { contacts: [] } },
    }]);
    prisma.notification.create.mockResolvedValue({ id: 'notification-1' });
    emailService.sendReminderEmail.mockRejectedValue(new Error('SES unavailable'));

    const result = await service.processDueReminders(now);

    expect(result[0]).toMatchObject({ status: 'failed', nextReminderAt: new Date('2026-09-30T10:05:00.000Z') });
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notification-1' },
      data: { status: 'FAILED', error: 'SES unavailable' },
    });
    expect(prisma.stepInstance.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'step-1', status: 'ALERTED', nextReminderAt: new Date('2026-09-30T10:05:00.000Z') },
      data: { nextReminderAt: new Date('2026-09-30T10:05:00.000Z') },
    });
  });

  it('notifies the backup approver and active admin contacts when reminders are exhausted', async () => {
    const now = new Date('2026-09-30T10:00:00.000Z');
    prisma.stepInstance.findMany.mockResolvedValue([{
      id: 'step-1', batchId: 'batch-1', reminderCount: 2,
      stage: {
        maxReminders: 3,
        reminderIntervalHours: 24,
        contact: { id: 'approver-1', email: 'approver@example.test' },
        backupContact: { id: 'backup-1', email: 'backup@example.test' },
      },
      batch: {
        organizationId: 'demo-org',
        organization: { contacts: [{ id: 'admin-1', email: 'admin@example.test' }] },
      },
    }]);
    prisma.notification.create
      .mockResolvedValueOnce({ id: 'notification-primary' })
      .mockResolvedValueOnce({ id: 'notification-backup' })
      .mockResolvedValueOnce({ id: 'notification-admin' });

    const result = await service.processDueReminders(now);

    expect(result[0]).toMatchObject({ status: 'sent', nextReminderAt: null });
    expect(emailService.sendReminderEmail).toHaveBeenCalledTimes(3);
    expect(emailService.sendReminderEmail).toHaveBeenNthCalledWith(2, expect.objectContaining({ to: 'backup@example.test' }));
    expect(emailService.sendReminderEmail).toHaveBeenNthCalledWith(3, expect.objectContaining({ to: 'admin@example.test' }));
    expect(prisma.stepInstance.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reminderCount: 3, status: 'ESCALATED', nextReminderAt: null }),
    }));
  });
});
