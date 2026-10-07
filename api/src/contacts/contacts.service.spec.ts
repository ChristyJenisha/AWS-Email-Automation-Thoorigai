import { ConflictException, NotFoundException } from '@nestjs/common';
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
    };
  };

  beforeEach(() => {
    prisma = {
      contact: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
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
      data: { organizationId: 'org-1', name: 'Approver', email: 'approver@example.com', role: 'Approver' },
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
});
