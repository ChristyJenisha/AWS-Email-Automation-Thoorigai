import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StepStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { BatchesService } from './batches.service.js';

describe('BatchesService', () => {
  let service: BatchesService;
  let prisma: {
    organization: { findUnique: ReturnType<typeof vi.fn> };
    workflowTemplate: { findFirst: ReturnType<typeof vi.fn> };
    batch: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update?: ReturnType<typeof vi.fn>;
    };
    auditLog: { create: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };
  const remindersService = { sendInitialApproval: vi.fn().mockResolvedValue({ status: 'sent' }) };

  beforeEach(() => {
    prisma = {
      organization: { findUnique: vi.fn() },
      workflowTemplate: { findFirst: vi.fn() },
      batch: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
      auditLog: { create: vi.fn(), findMany: vi.fn() },
      $transaction: vi.fn((callback) => callback(prisma)),
    };
    remindersService.sendInitialApproval.mockClear();
    service = new BatchesService(prisma as unknown as PrismaService, remindersService as any);
  });

  it('creates bills and ordered approval steps atomically and audits the batch', async () => {
    const now = new Date();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    prisma.organization.findUnique.mockResolvedValue({ id: 'org-1' });
    prisma.workflowTemplate.findFirst.mockResolvedValue({
      id: 'workflow-1',
      stages: [
        { id: 'stage-1', order: 1, reminderIntervalHours: 24, contact: { id: 'contact-1', isActive: true } },
        { id: 'stage-2', order: 2, reminderIntervalHours: 12, contact: { id: 'contact-2', isActive: true } },
      ],
    });
    prisma.batch.create.mockImplementation(async ({ data, include }) => ({
      id: 'batch-1',
      ...data,
      bills: data.bills.create,
      stepInstances: data.stepInstances.create,
      include,
    }));

    const batch = await service.create({
      organizationId: 'org-1',
      templateId: 'workflow-1',
      bills: [{ billNumber: ' INV-1 ', amount: 1200 }],
    });

    expect(batch.bills[0]).toMatchObject({ billNumber: 'INV-1', amount: 1200, balanceDue: 1200 });
    expect(batch.stepInstances).toMatchObject([
      { stageId: 'stage-1', status: StepStatus.ALERTED, alertedAt: now, nextReminderAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
      { stageId: 'stage-2', status: StepStatus.PENDING, alertedAt: null, nextReminderAt: null },
    ]);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ entityType: 'batch', entityId: 'batch-1', action: 'created' }),
    });
    expect(remindersService.sendInitialApproval).toHaveBeenCalledWith('batch-1');
    vi.useRealTimers();
  });

  it('rejects duplicate bill numbers before writing', async () => {
    await expect(
      service.create({
        organizationId: 'org-1',
        templateId: 'workflow-1',
        bills: [{ billNumber: 'INV-1', amount: 100 }, { billNumber: ' inv-1 ', amount: 200 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.organization.findUnique).not.toHaveBeenCalled();
    expect(prisma.batch.create).not.toHaveBeenCalled();
  });

  it('does not create a batch from another organization workflow', async () => {
    prisma.organization.findUnique.mockResolvedValue({ id: 'org-1' });
    prisma.workflowTemplate.findFirst.mockResolvedValue(null);

    await expect(
      service.create({ organizationId: 'org-1', templateId: 'foreign-workflow', bills: [{ billNumber: 'INV-1', amount: 100 }] }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.batch.create).not.toHaveBeenCalled();
  });

  it('does not create a batch without an active approver', async () => {
    prisma.organization.findUnique.mockResolvedValue({ id: 'org-1' });
    prisma.workflowTemplate.findFirst.mockResolvedValue({
      id: 'workflow-1',
      stages: [{ id: 'stage-1', order: 1, reminderIntervalHours: 24, contact: { id: 'contact-1', isActive: false } }],
    });

    await expect(
      service.create({ organizationId: 'org-1', templateId: 'workflow-1', bills: [{ billNumber: 'INV-1', amount: 100 }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.batch.create).not.toHaveBeenCalled();
  });
  it('retrieves full batch history with notifications, payments, and audit logs', async () => {
    prisma.batch.findUnique.mockResolvedValue({
      id: 'batch-1',
      organizationId: 'org-1',
      stepInstances: [{ id: 'step-1' }, { id: 'step-2' }],
      notifications: [{ id: 'notif-1', recipient: 'approver@example.test', status: 'SENT' }],
      payments: [{ id: 'pmt-1', amount: 1200 }],
    });
    prisma.auditLog.findMany.mockResolvedValue([
      { id: 'audit-1', entityType: 'batch', entityId: 'batch-1', action: 'created' },
    ]);

    const history = await service.getHistory('batch-1');

    expect(history.id).toBe('batch-1');
    expect(history.notifications).toHaveLength(1);
    expect(history.payments).toHaveLength(1);
    expect(history.auditLogs).toHaveLength(1);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { entityType: 'batch', entityId: 'batch-1' },
          { entityType: 'step_instance', entityId: { in: ['step-1', 'step-2'] } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('throws NotFoundException if batch does not exist in getHistory', async () => {
    prisma.batch.findUnique.mockResolvedValue(null);

    await expect(service.getHistory('unknown-batch')).rejects.toBeInstanceOf(NotFoundException);
  });
});