import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BatchStatus, StepStatus } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { WorkflowTransitionsService } from './workflow-transitions.service.js';

describe('WorkflowTransitionsService', () => {
  let service: WorkflowTransitionsService;
  let prisma: {
    stepInstance: { findUnique: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
    workflowStage: { findFirst: ReturnType<typeof vi.fn> };
    batch: { updateMany: ReturnType<typeof vi.fn> };
    auditLog: { create: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    prisma = {
      stepInstance: { findUnique: vi.fn(), updateMany: vi.fn() },
      workflowStage: { findFirst: vi.fn() },
      batch: { updateMany: vi.fn() },
      auditLog: { create: vi.fn() },
      $transaction: vi.fn((callback) => callback(prisma)),
    };
    service = new WorkflowTransitionsService(prisma as unknown as PrismaService);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function activeStep(order: number) {
    return {
      id: 'step-current',
      batchId: 'batch-1',
      status: StepStatus.ALERTED,
      batch: {
        id: 'batch-1',
        status: BatchStatus.IN_PROGRESS,
        organizationId: 'demo-org',
        organization: { name: 'Demo Organization' },
        bills: [{ billNumber: 'INV-1001', amount: 1200, balanceDue: 1200, dueDate: null }],
      },
      stage: {
        templateId: 'workflow-1',
        order,
        contactId: 'approver-1',
        backupContactId: 'backup-approver-1',
        contact: { id: 'approver-1', email: 'approver@example.test' },
        backupContact: { id: 'backup-approver-1', email: 'backup@example.test' },
      },
    };
  }

  it('completes the active step and alerts the next stage with its reminder', async () => {
    prisma.stepInstance.findUnique.mockResolvedValue(activeStep(1));
    prisma.stepInstance.updateMany.mockResolvedValue({ count: 1 });
    prisma.workflowStage.findFirst.mockResolvedValue({ id: 'stage-2', reminderIntervalHours: 12 });

    const result = await service.complete('step-current', 'approver@example.test');

    expect(result).toEqual({ stepInstanceId: 'step-current', status: StepStatus.COMPLETED, nextStageId: 'stage-2' });
    expect(prisma.stepInstance.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        batchId: 'batch-1',
        stageId: 'stage-2',
        status: { in: [StepStatus.PENDING, StepStatus.RETURNED] },
      },
      data: {
        status: StepStatus.ALERTED,
        alertedAt: new Date('2026-09-30T10:00:00.000Z'),
        nextReminderAt: new Date('2026-09-30T22:00:00.000Z'),
        reminderCount: 0,
        completedAt: null,
        lastComment: null,
      },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ entityId: 'step-current', action: 'completed', actor: 'approver@example.test' }),
    });
  });

  it('moves the batch to ready for payment after the final stage', async () => {
    prisma.stepInstance.findUnique.mockResolvedValue(activeStep(2));
    prisma.stepInstance.updateMany.mockResolvedValue({ count: 1 });
    prisma.workflowStage.findFirst.mockResolvedValue(null);
    prisma.batch.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.complete('step-current', 'approver@example.test');

    expect(result).toEqual({ stepInstanceId: 'step-current', status: StepStatus.COMPLETED, nextStageId: null });
    expect(prisma.batch.updateMany).toHaveBeenCalledWith({
      where: { id: 'batch-1', status: BatchStatus.IN_PROGRESS },
      data: { status: BatchStatus.READY_FOR_PAYMENT },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ entityType: 'batch', action: 'ready_for_payment' }),
    });
  });

  it('reactivates a returned next stage after the previous stage completes again', async () => {
    prisma.stepInstance.findUnique.mockResolvedValue(activeStep(1));
    prisma.stepInstance.updateMany.mockResolvedValue({ count: 1 });
    prisma.workflowStage.findFirst.mockResolvedValue({ id: 'stage-2', reminderIntervalHours: 12 });

    await service.complete('step-current', 'approver@example.test');

    expect(prisma.stepInstance.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        batchId: 'batch-1',
        stageId: 'stage-2',
        status: { in: [StepStatus.PENDING, StepStatus.RETURNED] },
      },
      data: expect.objectContaining({
        status: StepStatus.ALERTED,
        reminderCount: 0,
        completedAt: null,
        lastComment: null,
      }),
    });
  });

  it('returns a step to the previous stage and preserves the required comment', async () => {
    prisma.stepInstance.findUnique.mockResolvedValue(activeStep(2));
    prisma.workflowStage.findFirst.mockResolvedValue({ id: 'stage-1', reminderIntervalHours: 24 });
    prisma.stepInstance.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.returnToPrevious('step-current', 'approver@example.test', 'Please correct the invoice total');

    expect(result).toEqual({ stepInstanceId: 'step-current', status: StepStatus.RETURNED, previousStageId: 'stage-1' });
    expect(prisma.stepInstance.updateMany).toHaveBeenNthCalledWith(2, {
      where: { batchId: 'batch-1', stageId: 'stage-1', status: StepStatus.COMPLETED },
      data: expect.objectContaining({
        status: StepStatus.ALERTED,
        nextReminderAt: new Date('2026-10-01T10:00:00.000Z'),
        lastComment: 'Please correct the invoice total',
      }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ entityId: 'step-current', action: 'returned' }),
    });
  });

  it('rejects a return without a comment before database writes', async () => {
    await expect(service.returnToPrevious('step-current', 'approver@example.test', '  ')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.stepInstance.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a second action on a step already claimed by another request', async () => {
    prisma.stepInstance.findUnique.mockResolvedValue(activeStep(1));
    prisma.stepInstance.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.complete('step-current', 'approver@example.test')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.workflowStage.findFirst).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects a missing step', async () => {
    prisma.stepInstance.findUnique.mockResolvedValue(null);

    await expect(service.complete('missing', 'approver@example.test')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an actor who is not assigned to the active stage', async () => {
    prisma.stepInstance.findUnique.mockResolvedValue(activeStep(1));

    await expect(service.complete('step-current', 'unauthorized-user')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a workflow action when the actor organization does not match the batch organization', async () => {
    prisma.stepInstance.findUnique.mockResolvedValue(activeStep(1));

    await expect(service.complete('step-current', 'approver@example.test', 'other-org')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('inspects a valid approval token and returns the authorized batch bill context', async () => {
    vi.stubEnv('TOKEN_SIGNING_SECRET', 'test-token-signing-secret-with-sufficient-entropy');
    const token = service.generateApprovalToken('step-current', 'approver-1', 'demo-org');
    prisma.stepInstance.findUnique.mockResolvedValue(activeStep(1));

    await expect(service.inspectApprovalToken(token)).resolves.toEqual({
      stepInstanceId: 'step-current',
      batchId: 'batch-1',
      organizationName: 'Demo Organization',
      stageOrder: 1,
      bills: [{ billNumber: 'INV-1001', amount: 1200, balanceDue: 1200, dueDate: null }],
    });
  });
});