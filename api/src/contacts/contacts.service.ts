import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BatchStatus, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateContactDto, UpdateContactDto } from './contact.dto.js';

const contactFields = { id: true, organizationId: true, name: true, email: true, role: true, isActive: true } as const;

export function parseRole(roleInput?: string): Role {
  if (!roleInput) return Role.APPROVER;
  const upper = String(roleInput).trim().toUpperCase().replace(/[\s_-]+/g, '_');
  if (upper === 'ADMIN') return Role.ADMIN;
  if (upper === 'BACKUP_APPROVER' || upper.includes('BACKUP')) return Role.BACKUP_APPROVER;
  return Role.APPROVER;
}

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  listByOrganization(organizationId: string) {
    return this.prisma.contact.findMany({
      where: { organizationId },
      select: contactFields,
      orderBy: { name: 'asc' },
    });
  }

  async create(input: CreateContactDto) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.contact.findFirst({
      where: { organizationId: input.organizationId, email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) throw new ConflictException('A contact with this email already exists in the organization');

    const passwordHash = input.password?.trim()
      ? await bcrypt.hash(input.password.trim(), 10)
      : null;

    return this.prisma.contact.create({
      data: {
        organizationId: input.organizationId,
        name: input.name.trim(),
        email,
        role: parseRole(input.role),
        ...(passwordHash ? { passwordHash } : {}),
      },
      select: contactFields,
    });
  }

  async update(id: string, organizationId: string, input: UpdateContactDto) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    if (input.email) {
      const existing = await this.prisma.contact.findFirst({
        where: { id: { not: id }, organizationId, email: { equals: input.email.trim(), mode: 'insensitive' } },
        select: { id: true },
      });
      if (existing) throw new ConflictException('A contact with this email already exists in the organization');
    }

    let passwordHash: string | undefined;
    if (input.password && input.password.trim().length > 0) {
      passwordHash = await bcrypt.hash(input.password.trim(), 10);
    }

    const data = {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
      ...(input.role !== undefined ? { role: parseRole(input.role) } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(passwordHash !== undefined ? { passwordHash } : {}),
    };
    if (Object.keys(data).length === 0) throw new ConflictException('Provide at least one contact field to update');

    return this.prisma.contact.update({ where: { id }, data, select: contactFields });
  }

  async delete(id: string, organizationId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, organizationId },
      select: { id: true, name: true },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    // 1. Check if there are any active in-flight bills currently held by this contact
    const activeBatches = await this.prisma.batch.findMany({
      where: {
        template: {
          stages: {
            some: { contactId: id },
          },
        },
        status: { in: [BatchStatus.IN_PROGRESS, BatchStatus.READY_FOR_PAYMENT] },
      },
      select: { id: true },
    });

    if (activeBatches.length > 0) {
      throw new ConflictException(
        `Cannot delete "${contact.name}". There are ${activeBatches.length} active bill(s) in progress using this approver. Settle or cancel those bills first.`,
      );
    }

    // 2. Check if this contact is currently assigned as a primary approver in any workflow template
    const stagesWherePrimary = await this.prisma.workflowStage.findMany({
      where: { contactId: id },
      include: {
        template: {
          select: { id: true, name: true },
        },
      },
    });

    if (stagesWherePrimary.length > 0) {
      const templateNames = Array.from(
        new Set(stagesWherePrimary.map((s) => s.template?.name || 'Untitled Workflow')),
      ).join(', ');
      throw new ConflictException(
        `Cannot delete "${contact.name}" because they are currently assigned as the primary approver in workflow template: "${templateNames}". Please reassign that stage to another approver in Workflow Templates first, or use "Deactivate" to suspend this contact.`,
      );
    }

    // 3. Unlink any backup approver references safely
    await this.prisma.workflowStage.updateMany({
      where: { backupContactId: id },
      data: { backupContactId: null },
    });

    // 4. Permanently delete the contact
    await this.prisma.contact.delete({ where: { id } });
    return { message: `Contact "${contact.name}" deleted permanently`, id };
  }
}