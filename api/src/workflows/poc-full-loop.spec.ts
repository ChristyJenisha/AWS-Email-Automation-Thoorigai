import { BatchStatus, DeductionType, StepStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { WorkflowTransitionsService } from './workflow-transitions.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { EmailService } from '../email/email.service.js';

describe('POC Full-Loop Verification (Phase 11 QA & Test Plan)', () => {
  let transitionsService: WorkflowTransitionsService;
  let paymentsService: PaymentsService;
  let prisma: any;
  let emailService: any;

  beforeEach(() => {
    vi.stubEnv('TOKEN_SIGNING_SECRET', 'test-signing-secret-with-sufficient-entropy-for-poc');
    vi.stubEnv('REQUIRE_APPROVAL_OTP', 'false'); // test runner direct token validation

    emailService = {
      sendReminderEmail: vi.fn().mockResolvedValue({ status: 'sent', provider: 'smtp' }),
    };

    prisma = {
      stepInstance: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn(),
      },
      workflowStage: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      batch: {
        findUnique: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      bill: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        count: vi.fn().mockResolvedValue(0), // no remaining unpaid bills
      },
      payment: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(prisma)),
    };

    transitionsService = new WorkflowTransitionsService(
      prisma as unknown as PrismaService,
      emailService as unknown as EmailService,
    );
    paymentsService = new PaymentsService(prisma as unknown as PrismaService);
  });

  it('executes the complete POC lifecycle: Stage 1 approval -> Stage 2 advance -> Payment with Idempotency', async () => {
    // -------------------------------------------------------------------------
    // 1. Stage 1 Alert & Approval
    // -------------------------------------------------------------------------
    const stage1Step = {
      id: 'step-stage-1',
      batchId: 'batch-poc-001',
      status: StepStatus.ALERTED,
      approvalOtpHash: null,
      approvalOtpExpiresAt: null,
      approvalOtpAttempts: 0,
      approvalOtpRequestedAt: null,
      batch: {
        id: 'batch-poc-001',
        status: BatchStatus.IN_PROGRESS,
        organizationId: 'demo-org',
        organization: { name: 'Thoorigai Client Org' },
        bills: [
          { id: 'bill-1', billNumber: 'INV-101', amount: 50000, balanceDue: 50000, dueDate: new Date() },
          { id: 'bill-2', billNumber: 'INV-102', amount: 75000, balanceDue: 75000, dueDate: new Date() },
        ],
      },
      stage: {
        templateId: 'tpl-1',
        order: 1,
        contactId: 'contact-approver-1',
        backupContactId: null,
        contact: { id: 'contact-approver-1', email: 'approver1@client.test' },
        backupContact: null,
      },
    };

    prisma.stepInstance.findUnique.mockResolvedValue(stage1Step);
    prisma.workflowStage.findFirst.mockResolvedValue({ id: 'stage-2', order: 2, reminderIntervalHours: 24 });

    const step1Result = await transitionsService.complete(
      'step-stage-1',
      'approver1@client.test',
      'demo-org',
      { ip: '127.0.0.1', userAgent: 'Browser', source: 'magic_link' },
    );

    expect(step1Result.status).toBe(StepStatus.COMPLETED);
    expect(step1Result.nextStageId).toBe('stage-2');

    // Verify Stage 2 was alerted
    expect(prisma.stepInstance.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          batchId: 'batch-poc-001',
          stageId: 'stage-2',
          status: { in: [StepStatus.PENDING, StepStatus.RETURNED] },
        },
        data: expect.objectContaining({
          status: StepStatus.ALERTED,
        }),
      }),
    );

    // -------------------------------------------------------------------------
    // 2. Final Stage Approval -> Transitions Batch to READY_FOR_PAYMENT
    // -------------------------------------------------------------------------
    const stage2Step = {
      ...stage1Step,
      id: 'step-stage-2',
      stage: {
        ...stage1Step.stage,
        order: 2,
        contactId: 'contact-approver-2',
        contact: { id: 'contact-approver-2', email: 'approver2@client.test' },
      },
    };

    prisma.stepInstance.findUnique.mockResolvedValue(stage2Step);
    // When Stage 2 completes, no further stages exist
    prisma.workflowStage.findFirst.mockResolvedValue(null);

    const step2Result = await transitionsService.complete(
      'step-stage-2',
      'approver2@client.test',
      'demo-org',
      { ip: '127.0.0.1', userAgent: 'Browser', source: 'magic_link' },
    );

    expect(step2Result.status).toBe(StepStatus.COMPLETED);
    expect(step2Result.nextStageId).toBeNull();

    // Verify batch status updated to READY_FOR_PAYMENT
    expect(prisma.batch.updateMany).toHaveBeenCalledWith({
      where: { id: 'batch-poc-001', status: BatchStatus.IN_PROGRESS },
      data: { status: BatchStatus.READY_FOR_PAYMENT },
    });

    // -------------------------------------------------------------------------
    // 3. Payment Recording with Idempotency Key
    // -------------------------------------------------------------------------
    prisma.payment.findUnique.mockResolvedValue(null);
    prisma.batch.findUnique.mockResolvedValue({
      id: 'batch-poc-001',
      status: BatchStatus.READY_FOR_PAYMENT,
      bills: [
        { id: 'bill-1', billNumber: 'INV-101', amount: 50000, balanceDue: 50000 },
        { id: 'bill-2', billNumber: 'INV-102', amount: 75000, balanceDue: 75000 },
      ],
    });

    const createdPaymentRecord = {
      id: 'pay-001',
      batchId: 'batch-poc-001',
      amount: 125000,
      idempotencyKey: 'idem-uuid-001',
      unallocatedAmount: 0,
    };
    prisma.payment.create.mockResolvedValue(createdPaymentRecord);

    const paymentInput = {
      batchId: 'batch-poc-001',
      amount: 125000,
      idempotencyKey: 'idem-uuid-001',
      reference: 'UTR987654321',
      allocations: [
        { billId: 'bill-1', amount: 49000, deductionAmount: 1000, deductionType: DeductionType.TDS },
        { billId: 'bill-2', amount: 73500, deductionAmount: 1500, deductionType: DeductionType.TDS },
      ],
    };

    const paymentResult = await paymentsService.create(paymentInput, 'admin@client.test');
    expect(paymentResult).toEqual(createdPaymentRecord);

    // Verify bills updated with remaining balanceDue decrements
    expect(prisma.bill.updateMany).toHaveBeenCalledTimes(2);

    // -------------------------------------------------------------------------
    // 4. Idempotency Verification: Repeated submission returns first payment
    // -------------------------------------------------------------------------
    prisma.payment.findUnique.mockResolvedValue(createdPaymentRecord);
    const duplicateResult = await paymentsService.create(paymentInput, 'admin@client.test');

    expect(duplicateResult).toBe(createdPaymentRecord);
    // Verify no additional database writes occurred on duplicate call
    expect(prisma.payment.create).toHaveBeenCalledTimes(1);
  });
});

