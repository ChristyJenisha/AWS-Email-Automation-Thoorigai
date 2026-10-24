import { ConflictException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { ContactsService } from './contacts.service.js';

describe('ContactsService', () => {
  let service: ContactsService;
  let prisma: {
    contact: {
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    batch: {
      findMany: ReturnType<typeof vi.fn>;
    };
    workflowStage: {
      findMany: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
    workflowTemplate: {
      deleteMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    prisma = {
      contact: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
      batch: { findMany: vi.fn().mockResolvedValue([]) },
      workflowStage: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn().mockResolvedValue({ count: 0 }), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      workflowTemplate: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };
    service = new ContactsService(prisma as unknown as PrismaService);
  });

  it('lists contacts only in the requested organization', async () => {
    prisma.contact.findMany.mockResolvedValue([]);

    await service.listByOrganization('org-1');

    expect(prisma.contact.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org-1' } }));
  });

  it('creates a normalized contact when its email is unique in the organization', async () => {
    prisma.contact.findFirst.mockResolvedValue(null);
    prisma.contact.create.mockResolvedValue({ id: 'contact-1', email: 'approver@example.com' });

    await service.create({ organizationId: 'org-1', name: '  Approver  ', email: ' Approver@Example.com ', role: ' Approver ' });

    expect(prisma.contact.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { organizationId: 'org-1', name: 'Approver', email: 'approver@example.com', role: Role.APPROVER },
    }));
  });

  it('rejects duplicate organization contact emails', async () => {
    prisma.contact.findFirst.mockResolvedValue({ id: 'contact-existing' });

    await expect(service.create({ organizationId: 'org-1', name: 'Other', email: 'same@example.com', role: 'Approver' }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(prisma.contact.create).not.toHaveBeenCalled();
  });

  it('updates a contact only when it belongs to the requested organization', async () => {
    prisma.contact.findFirst.mockResolvedValueOnce({ id: 'contact-1' }).mockResolvedValueOnce(null);
    prisma.contact.update.mockResolvedValue({ id: 'contact-1', email: 'real@example.com' });

    await service.update('contact-1', 'org-1', { email: ' Real@Example.com ', isActive: true });

    expect(prisma.contact.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'contact-1', organizationId: 'org-1' } }));
    expect(prisma.contact.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'contact-1' },
      data: { email: 'real@example.com', isActive: true },
    }));
  });

  it('rejects updates for contacts outside the organization', async () => {
    prisma.contact.findFirst.mockResolvedValue(null);

    await expect(service.update('foreign-contact', 'org-1', { email: 'real@example.com' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.contact.update).not.toHaveBeenCalled();
  });

  it('deletes a contact and cascades empty workflows when there are no active batches', async () => {
    prisma.contact.findFirst.mockResolvedValue({ id: 'contact-1', name: 'Jenisha' });
    prisma.batch.findMany.mockResolvedValue([]);
    prisma.workflowStage.findMany.mockResolvedValue([{ templateId: 'template-1' }]);
    prisma.workflowStage.updateMany.mockResolvedValue({ count: 1 });
    prisma.workflowStage.deleteMany.mockResolvedValue({ count: 1 });
    prisma.workflowTemplate.deleteMany.mockResolvedValue({ count: 1 });
    prisma.contact.delete.mockResolvedValue({ id: 'contact-1' });

    const result = await service.delete('contact-1', 'org-1');

    expect(prisma.contact.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'contact-1', organizationId: 'org-1' } }));
    expect(prisma.batch.findMany).toHaveBeenCalled();
    expect(prisma.workflowStage.updateMany).toHaveBeenCalledWith({
      where: { backupContactId: 'contact-1' },
      data: { backupContactId: null },
    });
    expect(prisma.workflowStage.deleteMany).toHaveBeenCalledWith({
      where: { templateId: { in: ['template-1'] } },
    });
    expect(prisma.workflowTemplate.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['template-1'] } },
    });
    expect(prisma.contact.delete).toHaveBeenCalledWith({ where: { id: 'contact-1' } });
    expect(result).toEqual({ message: 'Contact "Jenisha" deleted permanently', id: 'contact-1' });
  });

  it('rejects deletion when contact is assigned to an active in-flight batch', async () => {
    prisma.contact.findFirst.mockResolvedValue({ id: 'contact-1', name: 'Jenisha' });
    prisma.batch.findMany.mockResolvedValue([{ id: 'batch-active-1' }]);

    await expect(service.delete('contact-1', 'org-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.contact.delete).not.toHaveBeenCalled();
  });

  it('rejects deletion for contacts outside the organization', async () => {
    prisma.contact.findFirst.mockResolvedValue(null);

    await expect(service.delete('foreign-contact', 'org-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.contact.delete).not.toHaveBeenCalled();
  });
});
