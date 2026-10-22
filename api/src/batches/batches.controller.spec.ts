import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../auth/auth.service.js';
import { WorkflowTransitionsService } from '../workflows/workflow-transitions.service.js';
import { BatchesController } from './batches.controller.js';
import { BatchesService } from './batches.service.js';

describe('BatchesController', () => {
  const batchesService = {
    list: vi.fn(),
    get: vi.fn(),
    getHistory: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  };
  const authService = {
    assertOrganizationAccess: vi.fn(),
    assertAdminAccess: vi.fn(),
  };
  const transitions = {
    confirmOnBehalf: vi.fn(),
    reassignStep: vi.fn(),
  };

  const controller = new BatchesController(
    batchesService as unknown as BatchesService,
    authService as unknown as AuthService,
    transitions as unknown as WorkflowTransitionsService,
  );

  it('enforces admin access and organization access on batch creation', async () => {
    const input = {
      organizationId: 'org-1',
      templateId: 'template-1',
      bills: [{ billNumber: 'INV-1', amount: 500, dueDate: '2026-11-01' }],
    };
    const user = { id: 'admin-1', role: 'Admin', organizationId: 'org-1' };
    batchesService.create.mockResolvedValue({ id: 'batch-1' });

    const result = await controller.create({ user }, input as any);

    expect(authService.assertAdminAccess).toHaveBeenCalledWith(user);
    expect(authService.assertOrganizationAccess).toHaveBeenCalledWith(user, 'org-1');
    expect(batchesService.create).toHaveBeenCalledWith(input);
    expect(result).toEqual({ id: 'batch-1' });
  });

  it('enforces admin access on batch deletion', async () => {
    const user = { id: 'admin-1', role: 'Admin', organizationId: 'org-1' };
    batchesService.get.mockResolvedValue({ id: 'batch-1', organizationId: 'org-1' });
    batchesService.delete.mockResolvedValue({ id: 'batch-1' });

    const result = await controller.delete({ user }, 'batch-1');

    expect(authService.assertAdminAccess).toHaveBeenCalledWith(user);
    expect(authService.assertOrganizationAccess).toHaveBeenCalledWith(user, 'org-1');
    expect(batchesService.delete).toHaveBeenCalledWith('batch-1');
    expect(result).toEqual({ id: 'batch-1' });
  });
});

