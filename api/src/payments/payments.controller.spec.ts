import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../auth/auth.service.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';

describe('PaymentsController', () => {
  const paymentsService = {
    getBatch: vi.fn().mockResolvedValue({ id: 'batch-1', organizationId: 'demo-org' }),
    listByBatch: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 'payment-1' }),
    getPayment: vi.fn().mockResolvedValue({ id: 'payment-1', batch: { id: 'batch-1', organizationId: 'demo-org' } }),
    allocateOnAccount: vi.fn().mockResolvedValue({ id: 'payment-1' }),
  };
  const authService = { assertOrganizationAccess: vi.fn() };
  const controller = new PaymentsController(
    paymentsService as unknown as PaymentsService,
    authService as unknown as AuthService,
  );

  it('checks organization access before listing payments', async () => {
    await expect(controller.listByBatch({ user: { organizationId: 'demo-org' } }, 'batch-1')).resolves.toEqual([]);
    expect(authService.assertOrganizationAccess).toHaveBeenCalledWith({ organizationId: 'demo-org' }, 'demo-org');
    expect(paymentsService.listByBatch).toHaveBeenCalledWith('batch-1');
  });

  it('records the authenticated user as the payment actor', async () => {
    const input = { batchId: 'batch-1', amount: 100, allocations: [{ billId: 'bill-1', amount: 100 }] };

    await expect(controller.create({ user: { id: 'admin-1', organizationId: 'demo-org' } }, input as any)).resolves.toEqual({
      id: 'payment-1',
    });
    expect(authService.assertOrganizationAccess).toHaveBeenCalledWith({ id: 'admin-1', organizationId: 'demo-org' }, 'demo-org');
    expect(paymentsService.create).toHaveBeenCalledWith(input, 'admin-1');
  });

  it('checks organization access before allocating on-account funds', async () => {
    const input = { allocations: [{ billId: 'bill-1', amount: 100 }] };
    await expect(controller.allocateOnAccount(
      { user: { id: 'admin-1', organizationId: 'demo-org' } },
      'payment-1',
      input as any,
    )).resolves.toEqual({ id: 'payment-1' });
    expect(authService.assertOrganizationAccess).toHaveBeenCalledWith(
      { id: 'admin-1', organizationId: 'demo-org' },
      'demo-org',
    );
    expect(paymentsService.allocateOnAccount).toHaveBeenCalledWith('payment-1', input.allocations, 'admin-1');
  });
});
