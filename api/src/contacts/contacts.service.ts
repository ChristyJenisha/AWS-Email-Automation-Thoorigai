import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateContactDto, UpdateContactDto } from './contact.dto.js';

const contactFields = { id: true, organizationId: true, name: true, email: true, role: true, isActive: true } as const;

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

    return this.prisma.contact.create({
      data: {
        organizationId: input.organizationId,
        name: input.name.trim(),
        email,
        role: input.role.trim(),
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

    const data = {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
      ...(input.role !== undefined ? { role: input.role.trim() } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    };
    if (Object.keys(data).length === 0) throw new ConflictException('Provide at least one contact field to update');

    return this.prisma.contact.update({ where: { id }, data, select: contactFields });
  }
}