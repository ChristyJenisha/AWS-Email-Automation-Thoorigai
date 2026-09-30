import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RemindersService } from './reminders.service.js';

describe('RemindersService', () => {
  let service: RemindersService;
  let prisma: {
    stepInstance: { findMany: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
    notification: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    auditLog: { create: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    prisma = {
      stepInstance: { findMany: vi.fn(), updateMany: vi.fn() },
      notification: { create: vi.fn(), update: vi.fn() },
      auditLog: { create: vi.fn() },
      $transaction: vi.fn((callback) => callback(prisma)),
    };
    service = new RemindersService(
      prisma as any,
      { sendReminderEmail: vi.fn().mockResolvedValue({ status: 'simulated', provider: 'local-dev' }) } as any,
    );
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
        stage: {
          id: 'stage-1',
          maxReminders: 3,
          reminderIntervalHours: 24,
          contact: { email: 'approver@example.test' },
          backupContact: { email: 'backup@example.test' },
        },
      },
    ]);
    prisma.notification.create.mockResolvedValue({ id: 'notification-1' });
    prisma.notification.update.mockResolvedValue({ id: 'notification-1', status: 'SENT' });
    prisma.stepInstance.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.processDueReminders(now);

    expect(result).toHaveLength(1);
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        batchId: 'batch-1',
        stepInstanceId: 'step-1',
        recipient: 'approver@example.test',
        status: 'PENDING',
      }),
    });
    expect(prisma.stepInstance.updateMany).toHaveBeenCalledWith({
      where: { id: 'step-1', status: 'ALERTED' },
      data: expect.objectContaining({
        reminderCount: 1,
        nextReminderAt: new Date('2026-10-01T10:00:00.000Z'),
      }),
    });
  });
});
