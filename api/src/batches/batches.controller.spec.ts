import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BatchesController } from './batches.controller.js';

describe('BatchesController', () => {
  let controller: BatchesController;
  let batchesService: {
    list: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let authService: {
    assertOrganizationAccess: ReturnType<typeof vi.fn>;
    assertAdminAccess: ReturnType<typeof vi.fn>;
  };
  let transitions: any;

  beforeEach(() => {
    batchesService = {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    };
    authService = {
      assertOrganizationAccess: vi.fn(),
      assertAdminAccess: vi.fn(),
    };
    transitions = {
      confirmOnBehalf: vi.fn(),
      reassignStep: vi.fn(),
    };
    controller = new BatchesController(batchesService as any, authService as any, transitions);
  });

  it('enforces admin access and organization access on batch creation', async () => {
    const user = { id: 'admin-1', role: 'Admin', organizationId: 'org-1' };
    const input = {
      organizationId: 'org-1',
      templateId: 'tpl-1',
      bills: [{ billNumber: 'INV-1', amount: 500 }],
    };
    batchesService.create.mockResolvedValue({ id: 'batch-1' });

    const result = await controller.create({ user } as any, input as any);

    expect(authService.assertAdminAccess).toHaveBeenCalledWith(user);
    expect(authService.assertOrganizationAccess).toHaveBeenCalledWith(user, 'org-1');
    expect(batchesService.create).toHaveBeenCalledWith(input);
    expect(result).toEqual({ id: 'batch-1' });
  });

  it('enforces admin access on batch deletion', async () => {
    const user = { id: 'admin-1', role: 'Admin', organizationId: 'org-1' };
    batchesService.get.mockResolvedValue({ id: 'batch-1', organizationId: 'org-1' });
    batchesService.delete.mockResolvedValue({ id: 'batch-1' });

    const result = await controller.delete({ user } as any, 'batch-1');

    expect(authService.assertAdminAccess).toHaveBeenCalledWith(user);
    expect(authService.assertOrganizationAccess).toHaveBeenCalledWith(user, 'org-1');
    expect(batchesService.delete).toHaveBeenCalledWith('batch-1', 'admin-1');
    expect(result).toEqual({ id: 'batch-1' });
  });
});
