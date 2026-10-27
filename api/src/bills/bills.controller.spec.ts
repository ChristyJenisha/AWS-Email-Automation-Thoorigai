import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../auth/auth.service.js';
import { BillsController } from './bills.controller.js';
import { BillsService } from './bills.service.js';

describe('BillsController', () => {
  const billsService = {
    submitIndividualBill: vi.fn(),
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn(),
  };
  const authService = {
    assertOrganizationAccess: vi.fn(),
    assertAdminAccess: vi.fn(),
  };
  const controller = new BillsController(
    billsService as unknown as BillsService,
    authService as unknown as AuthService,
  );

  it('submits an individual bill with organization authorization check', async () => {
    const input = {
      organizationId: 'org-1',
      templateId: 'wf-1',
      billNumber: 'INV-SINGLE-101',
      amount: 15000,
      dueDate: '2026-11-01',
    };
    const req = { user: { role: 'Admin', organizationId: 'org-1' } };
    billsService.submitIndividualBill.mockResolvedValue({
      message: 'Individual bill submitted for approval successfully',
      batchId: 'batch-1',
    });

    const result = await controller.submit(req, input);

    expect(authService.assertAdminAccess).toHaveBeenCalledWith(req.user);
    expect(authService.assertOrganizationAccess).toHaveBeenCalledWith(req.user, 'org-1');
    expect(billsService.submitIndividualBill).toHaveBeenCalledWith(input);
    expect(result).toHaveProperty('batchId', 'batch-1');
  });

  it('lists bills with organization access check', async () => {
    const req = { user: { role: 'Admin', organizationId: 'org-1' } };
    await expect(controller.list(req, 'org-1')).resolves.toEqual([]);
    expect(authService.assertOrganizationAccess).toHaveBeenCalledWith(req.user, 'org-1');
  });
});

