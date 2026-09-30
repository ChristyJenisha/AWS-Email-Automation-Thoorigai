import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateWorkflowDto, ReplaceWorkflowDto, WorkflowStageInputDto } from './workflow.dto.js';

const workflowDetails = {
  organization: { select: { id: true, name: true } },
  stages: {
    orderBy: { order: 'asc' as const },
    include: {
      contact: { select: { id: true, name: true, email: true, role: true } },
      backupContact: { select: { id: true, name: true, email: true, role: true } },
    },
  },
} satisfies Prisma.WorkflowTemplateInclude;

@Injectable()
export class WorkflowsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId?: string) {
    if (!organizationId?.trim()) {
      throw new BadRequestException('organizationId is required');
    }

    return this.prisma.workflowTemplate.findMany({
      where: { organizationId },
      include: workflowDetails,
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const workflow = await this.prisma.workflowTemplate.findUnique({
      where: { id },
      include: workflowDetails,
    });
    if (!workflow) throw new NotFoundException('Workflow not found');
    return workflow;
  }

  async create(input: CreateWorkflowDto) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true },
    });
    if (!organization) throw new NotFoundException('Organization not found');
    await this.validateContacts(input.organizationId, input.stages);

    return this.prisma.$transaction(async (transaction) => {
      const workflow = await transaction.workflowTemplate.create({
        data: {
          organizationId: input.organizationId,
          name: input.name.trim(),
          stages: { create: this.toStageRecords(input.stages) },
        },
        include: workflowDetails,
      });
      await transaction.auditLog.create({
        data: {
          entityType: 'workflow_template',
          entityId: workflow.id,
          action: 'created',
          actor: 'local-admin',
          detail: { name: workflow.name, stageCount: workflow.stages.length },
        },
      });
      return workflow;
    });
  }

  async replace(id: string, input: ReplaceWorkflowDto) {
    const existing = await this.prisma.workflowTemplate.findUnique({
      where: { id },
      select: { id: true, organizationId: true, _count: { select: { batches: true } } },
    });
    if (!existing) throw new NotFoundException('Workflow not found');
    if (existing._count.batches > 0) {
      throw new ConflictException('A workflow used by a batch cannot be changed');
    }
    await this.validateContacts(existing.organizationId, input.stages);

    return this.prisma.$transaction(async (transaction) => {
      await transaction.workflowStage.deleteMany({ where: { templateId: id } });
      const workflow = await transaction.workflowTemplate.update({
        where: { id },
        data: {
          name: input.name.trim(),
          stages: { create: this.toStageRecords(input.stages) },
        },
        include: workflowDetails,
      });
      await transaction.auditLog.create({
        data: {
          entityType: 'workflow_template',
          entityId: workflow.id,
          action: 'replaced',
          actor: 'local-admin',
          detail: { name: workflow.name, stageCount: workflow.stages.length },
        },
      });
      return workflow;
    });
  }

  async delete(id: string): Promise<{ deleted: true }> {
    const existing = await this.prisma.workflowTemplate.findUnique({
      where: { id },
      select: { id: true, name: true, _count: { select: { batches: true } } },
    });
    if (!existing) throw new NotFoundException('Workflow not found');
    if (existing._count.batches > 0) {
      throw new ConflictException('A workflow used by a batch cannot be deleted');
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.workflowTemplate.delete({ where: { id } });
      await transaction.auditLog.create({
        data: {
          entityType: 'workflow_template',
          entityId: id,
          action: 'deleted',
          actor: 'local-admin',
          detail: { name: existing.name },
        },
      });
    });
    return { deleted: true };
  }

  private async validateContacts(organizationId: string, stages: WorkflowStageInputDto[]) {
    const contactIds = [...new Set(stages.flatMap((stage) => [stage.contactId, stage.backupContactId].filter((id): id is string => Boolean(id))))];
    const contacts = await this.prisma.contact.findMany({
      where: { id: { in: contactIds }, organizationId, isActive: true },
      select: { id: true },
    });
    if (contacts.length !== contactIds.length) {
      throw new BadRequestException('Every stage contact must be active and belong to the workflow organization');
    }
  }

  private toStageRecords(stages: WorkflowStageInputDto[]) {
    return stages.map((stage, index) => ({
      order: index + 1,
      contactId: stage.contactId,
      backupContactId: stage.backupContactId,
      reminderIntervalHours: stage.reminderIntervalHours ?? 24,
      maxReminders: stage.maxReminders ?? 3,
    }));
  }
}