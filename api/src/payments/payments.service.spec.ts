import { BatchStatus, BillStatus, DeductionType } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaymentsService } from './payments.service.js';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let transaction: {
    batch: { findUnique: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
    payment: { create: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    paymentAllocation: { createMany: ReturnType<typeof vi.fn> };
    bill: { updateMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };
    auditLog: { create: ReturnType<typeof vi.fn> };
  };
  let prisma: typeof transaction & { $transaction: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    transaction = {
      batch: { findUnique: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      payment: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
      paymentAllocation: { createMany: vi.fn() },
      bill: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), count: vi.fn().mockResolvedValue(1) },
      auditLog: { create: vi.fn() },
    };
    prisma = {
      ...transaction,
      $transaction: vi.fn((callback) => callback(transaction)),
    };
    service = new PaymentsService(prisma as unknown as PrismaService);
  });

  const input = {
    batchId: 'batch-1',
    amount: 250,
    allocations: [{ billId: 'bill-1', amount: 200, deductionAmount: 50, deductionType: DeductionType.TDS }],
  };

  it('records a partial allocation and updates the remaining bill balance atomically', async () => {
    transaction.batch.findUnique.mockResolvedValue({
      id: 'batch-1',
      status: BatchStatus.READY_FOR_PAYMENT,
      bills: [{ id: 'bill-1', billNumber: 'INV-1', balanceDue: 500 }],
    });
    transaction.payment.create.mockResolvedValue({ id: 'payment-1' });

    await service.create(input, 'demo-admin');

    expect(transaction.payment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        amount: expect.objectContaining({ d: expect.any(Array) }),
        allocations: { create: [expect.objectContaining({ billId: 'bill-1', deductionType: DeductionType.TDS })] },
      }),
    }));
    expect(transaction.bill.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'bill-1', batchId: 'batch-1' }),
      data: expect.objectContaining({ status: BillStatus.PARTIALLY_PAID }),
    }));
    expect(transaction.bill.updateMany.mock.calls[0][0].data.balanceDue.decrement.toString()).toBe('250');
    expect(transaction.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ entityType: 'payment', entityId: 'payment-1', action: 'recorded', actor: 'demo-admin' }),
    }));
  });

  it('marks the batch completed when the payment clears the final bill balance', async () => {
    transaction.batch.findUnique.mockResolvedValue({
      id: 'batch-1',
      status: BatchStatus.READY_FOR_PAYMENT,
      bills: [{ id: 'bill-1', billNumber: 'INV-1', balanceDue: 200 }],
    });
    transaction.payment.create.mockResolvedValue({ id: 'payment-2' });
    transaction.bill.count.mockResolvedValue(0);

    await service.create({
      batchId: 'batch-1',
      amount: 200,
      allocations: [{ billId: 'bill-1', amount: 200 }],
    }, 'demo-admin');

    expect(transaction.bill.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: BillStatus.PAID }),
    }));
    expect(transaction.batch.updateMany).toHaveBeenCalledWith({
      where: { id: 'batch-1', status: BatchStatus.READY_FOR_PAYMENT },
      data: { status: BatchStatus.COMPLETED },
    });
  });

  it('rejects payment totals lower than allocated cash plus deductions', async () => {
    await expect(service.create({ ...input, amount: 249 }, 'demo-admin')).rejects.toThrow(
      'Allocated cash plus deductions cannot exceed the payment amount',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects payments before final approval without creating a payment', async () => {
    transaction.batch.findUnique.mockResolvedValue({
      id: 'batch-1',
      status: BatchStatus.IN_PROGRESS,
      bills: [{ id: 'bill-1', billNumber: 'INV-1', balanceDue: 500 }],
    });

    await expect(service.create(input, 'demo-admin')).rejects.toThrow(
      'Payments can only be recorded after all approval stages are complete',
    );
    expect(transaction.payment.create).not.toHaveBeenCalled();
  });

  it('rejects allocations that exceed the selected bill balance', async () => {
    transaction.batch.findUnique.mockResolvedValue({
      id: 'batch-1',
      status: BatchStatus.READY_FOR_PAYMENT,
      bills: [{ id: 'bill-1', billNumber: 'INV-1', balanceDue: 100 }],
    });

    await expect(service.create(input, 'demo-admin')).rejects.toThrow('Allocation exceeds the balance due for bill INV-1');
    expect(transaction.payment.create).not.toHaveBeenCalled();
  });

  it('records a payment without bill allocations as on-account funds', async () => {
    transaction.batch.findUnique.mockResolvedValue({ id: 'batch-1', status: BatchStatus.READY_FOR_PAYMENT, bills: [] });
    transaction.payment.create.mockResolvedValue({ id: 'payment-on-account', unallocatedAmount: 300 });

    await service.create({ batchId: 'batch-1', amount: 300 }, 'demo-admin');

    expect(transaction.payment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        amount: expect.objectContaining({ d: expect.any(Array) }),
        unallocatedAmount: expect.objectContaining({ d: expect.any(Array) }),
        allocations: { create: [] },
      }),
    }));
    expect(transaction.bill.updateMany).not.toHaveBeenCalled();
    expect(transaction.batch.updateMany).not.toHaveBeenCalled();
  });

  it('allocates on-account cash and deductions later, completing only when no balance remains', async () => {
    transaction.payment.findUnique.mockResolvedValue({
      id: 'payment-on-account',
      batchId: 'batch-1',
      unallocatedAmount: 150,
      batch: {
        id: 'batch-1',
        status: BatchStatus.READY_FOR_PAYMENT,
        bills: [{ id: 'bill-1', billNumber: 'INV-1', balanceDue: 500 }],
      },
      allocations: [],
    });
    transaction.payment.update.mockResolvedValue({ id: 'payment-on-account', unallocatedAmount: 30 });

    await service.allocateOnAccount('payment-on-account', [
      { billId: 'bill-1', amount: 100, deductionAmount: 20, deductionType: DeductionType.TDS },
    ], 'demo-admin');

    expect(transaction.paymentAllocation.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ paymentId: 'payment-on-account', billId: 'bill-1', deductionType: DeductionType.TDS })],
    });
    expect(transaction.payment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'payment-on-account' },
      data: { unallocatedAmount: expect.objectContaining({ d: expect.any(Array) }) },
    }));
    expect(transaction.payment.update.mock.calls[0][0].data.unallocatedAmount.toString()).toBe('30');
    expect(transaction.bill.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ balanceDue: { decrement: expect.anything() }, status: BillStatus.PARTIALLY_PAID }),
    }));
    expect(transaction.batch.updateMany).not.toHaveBeenCalled();
  });

  it('rejects on-account allocations that exceed the remaining on-account balance', async () => {
    transaction.payment.findUnique.mockResolvedValue({
      id: 'payment-on-account',
      batchId: 'batch-1',
      unallocatedAmount: 50,
      batch: { id: 'batch-1', status: BatchStatus.READY_FOR_PAYMENT, bills: [{ id: 'bill-1', billNumber: 'INV-1', balanceDue: 500 }] },
      allocations: [],
    });

    await expect(service.allocateOnAccount('payment-on-account', [{ billId: 'bill-1', amount: 100 }], 'demo-admin'))
      .rejects.toThrow('Allocation must be positive and cannot exceed the on-account balance');
    expect(transaction.paymentAllocation.createMany).not.toHaveBeenCalled();
  });
});
