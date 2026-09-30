import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StepStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateBatchDto } from './batch.dto.js';

const batchDetails = {
  organization: { select: { id: true, name: true } },
  template: { select: { id: true, name: true } },
  bills: { orderBy: { createdAt: 'asc' as const } },
  stepInstances: {
    orderBy: { stage: { order: 'asc' as const } },
    include: {
      stage: {
        include: {
          contact: { select: { id: true, name: true, email: true, role: true } },
          backupContact: { select: { id: true, name: true, email: true, role: true } },
        },
      },
    },
  },
} satisfies Prisma.BatchInclude;

@Injectable()
export class BatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId?: string) {
    if (!organizationId?.trim()) {
      throw new BadRequestException('organizationId is required');
    }

    return this.prisma.batch.findMany({
      where: { organizationId },
      include: batchDetails,
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const batch = await this.prisma.batch.findUnique({ where: { id }, include: batchDetails });
    if (!batch) throw new NotFoundException('Batch not found');
    return batch;
  }

  async create(input: CreateBatchDto) {
    const billNumbers = input.bills.map((bill) => bill.billNumber.trim());
    if (billNumbers.some((number) => !number)) {
      throw new BadRequestException('Bill numbers cannot be empty');
    }
    if (new Set(billNumbers.map((number) => number.toLowerCase())).size !== billNumbers.length) {
      throw new BadRequestException('Bill numbers must be unique within a batch');
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true },
    });
    if (!organization) throw new NotFoundException('Organization not found');

    const template = await this.prisma.workflowTemplate.findFirst({
      where: { id: input.templateId, organizationId: input.organizationId },
      include: {
        stages: {
          orderBy: { order: 'asc' },
          include: { contact: { select: { id: true, isActive: true } } },
        },
      },
    });
    if (!template) throw new NotFoundException('Workflow not found for this organization');
    if (template.stages.length === 0) throw new BadRequestException('Workflow must contain at least one stage');
    if (template.stages.some((stage) => !stage.contact.isActive)) {
      throw new BadRequestException('Workflow contains an inactive approver');
    }

    const now = new Date();
    const stepInstances = template.stages.map((stage, index) => {
      const isFirst = index === 0;
      return {
        stageId: stage.id,
        status: isFirst ? StepStatus.ALERTED : StepStatus.PENDING,
        alertedAt: isFirst ? now : null,
        nextReminderAt: isFirst
          ? new Date(now.getTime() + stage.reminderIntervalHours * 60 * 60 * 1000)
          : null,
      };
    });

    return this.prisma.$transaction(async (transaction) => {
      const batch = await transaction.batch.create({
        data: {
          organizationId: input.organizationId,
          templateId: input.templateId,
          bills: {
            create: input.bills.map((bill, index) => ({
              billNumber: billNumbers[index],
              amount: bill.amount,
              balanceDue: bill.amount,
              dueDate: bill.dueDate ? new Date(bill.dueDate) : undefined,
            })),
          },
          stepInstances: { create: stepInstances },
        },
        include: batchDetails,
      });
      await transaction.auditLog.create({
        data: {
          entityType: 'batch',
          entityId: batch.id,
          action: 'created',
          actor: 'local-admin',
          detail: { billCount: batch.bills.length, workflowId: input.templateId },
        },
      });
      return batch;
    });
  }
}