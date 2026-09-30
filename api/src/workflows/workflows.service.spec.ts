import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { WorkflowsService } from './workflows.service.js';

describe('WorkflowsService', () => {
  let service: WorkflowsService;
  let prisma: {
    organization: { findUnique: ReturnType<typeof vi.fn> };
    contact: { findMany: ReturnType<typeof vi.fn> };
    workflowTemplate: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    workflowStage: { deleteMany: ReturnType<typeof vi.fn> };
    auditLog: { create: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    prisma = {
      organization: { findUnique: vi.fn() },
      contact: { findMany: vi.fn() },
      workflowTemplate: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      workflowStage: { deleteMany: vi.fn() },
      auditLog: { create: vi.fn() },
      $transaction: vi.fn((callback) => callback(prisma)),
    };
    service = new WorkflowsService(prisma as unknown as PrismaService);
  });

  it('requires an organization when listing workflows', async () => {
    await expect(service.list()).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.workflowTemplate.findMany).not.toHaveBeenCalled();
  });

  it('creates ordered stages and records the workflow creation', async () => {
    prisma.organization.findUnique.mockResolvedValue({ id: 'org-1' });
    prisma.contact.findMany.mockResolvedValue([{ id: 'contact-1' }, { id: 'contact-2' }]);
    prisma.workflowTemplate.create.mockImplementation(async ({ data }) => ({
      id: 'workflow-1',
      name: data.name,
      stages: data.stages.create,
    }));

    const workflow = await service.create({
      organizationId: 'org-1',
      name: '  Invoice approval  ',
      stages: [{ contactId: 'contact-1' }, { contactId: 'contact-2', maxReminders: 5 }],
    });

    expect(workflow).toMatchObject({
      name: 'Invoice approval',
      stages: [
        { order: 1, contactId: 'contact-1', reminderIntervalHours: 24, maxReminders: 3 },
        { order: 2, contactId: 'contact-2', reminderIntervalHours: 24, maxReminders: 5 },
      ],
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ entityId: 'workflow-1', action: 'created' }),
    });
  });

  it('rejects a stage contact outside the selected organization', async () => {
    prisma.organization.findUnique.mockResolvedValue({ id: 'org-1' });
    prisma.contact.findMany.mockResolvedValue([]);

    await expect(
      service.create({ organizationId: 'org-1', name: 'Invalid', stages: [{ contactId: 'foreign-contact' }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.workflowTemplate.create).not.toHaveBeenCalled();
  });

  it('does not replace a workflow already used by a batch', async () => {
    prisma.workflowTemplate.findUnique.mockResolvedValue({
      id: 'workflow-1',
      organizationId: 'org-1',
      _count: { batches: 1 },
    });

    await expect(service.replace('workflow-1', { name: 'Changed', stages: [{ contactId: 'contact-1' }] })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.workflowStage.deleteMany).not.toHaveBeenCalled();
  });

  it('returns not found when deleting a missing workflow', async () => {
    prisma.workflowTemplate.findUnique.mockResolvedValue(null);

    await expect(service.delete('missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});