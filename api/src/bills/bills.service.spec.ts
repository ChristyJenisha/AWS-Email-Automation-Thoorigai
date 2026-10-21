import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { BatchesService } from '../batches/batches.service.js';
import { BillsService } from './bills.service.js';

describe('BillsService', () => {
  let service: BillsService;
  let prisma: {
    bill: { findMany: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
  };
  let batchesService: {
    create: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    prisma = {
      bill: { findMany: vi.fn(), findUnique: vi.fn() },
    };
    batchesService = {
      create: vi.fn(),
    };
    service = new BillsService(
      prisma as unknown as PrismaService,
      batchesService as unknown as BatchesService,
    );
  });

  it('submits an individual bill through the workflow batch engine', async () => {
    const mockBatch = {
      id: 'batch-single-1',
      organizationId: 'org-1',
      templateId: 'wf-1',
      bills: [{ id: 'bill-1', billNumber: 'INV-2026-999', amount: 45000, balanceDue: 45000 }],
      stepInstances: [{ id: 'step-1', status: 'ALERTED' }],
      organization: { id: 'org-1', name: 'Thoorigai' },
      template: { id: 'wf-1', name: 'Executive Flow' },
    };
    batchesService.create.mockResolvedValue(mockBatch);

    const result = await service.submitIndividualBill({
      organizationId: 'org-1',
      templateId: 'wf-1',
      billNumber: 'INV-2026-999',
      amount: 45000,
      dueDate: '2026-11-15',
    });

    expect(batchesService.create).toHaveBeenCalledWith({
      organizationId: 'org-1',
      templateId: 'wf-1',
      bills: [
        {
          billNumber: 'INV-2026-999',
          amount: 45000,
          dueDate: '2026-11-15',
        },
      ],
    });
    expect(result.batchId).toBe('batch-single-1');
    expect(result.bill.billNumber).toBe('INV-2026-999');
  });

  it('rejects invalid or empty bill number', async () => {
    await expect(
      service.submitIndividualBill({
        organizationId: 'org-1',
        templateId: 'wf-1',
        billNumber: '   ',
        amount: 5000,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects zero or negative amount', async () => {
    await expect(
      service.submitIndividualBill({
        organizationId: 'org-1',
        templateId: 'wf-1',
        billNumber: 'INV-001',
        amount: 0,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

