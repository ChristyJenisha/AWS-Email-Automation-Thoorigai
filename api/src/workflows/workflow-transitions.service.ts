import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BatchStatus, Prisma, StepStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

const transitionContext = {
  id: true,
  batchId: true,
  status: true,
  batch: { select: { id: true, status: true, organizationId: true } },
  stage: {
    select: {
      templateId: true,
      order: true,
      contactId: true,
      backupContactId: true,
      contact: { select: { id: true, email: true } },
      backupContact: { select: { id: true, email: true } },
    },
  },
} satisfies Prisma.StepInstanceSelect;

@Injectable()
export class WorkflowTransitionsService {
  constructor(private readonly prisma: PrismaService) {}

  async complete(stepInstanceId: string, actor: string, organizationId?: string) {
    this.validateActor(actor);
    const step = await this.getActiveStep(stepInstanceId);
    this.validateOrganizationForStep(step, organizationId);
    this.validateActorForStep(step, actor);
    const now = new Date();

    return this.prisma.$transaction(async (transaction) => {
      await this.claimActiveStep(transaction, step.id, {
        status: StepStatus.COMPLETED,
        completedAt: now,
        nextReminderAt: null,
      });

      const nextStage = await transaction.workflowStage.findFirst({
        where: { templateId: step.stage.templateId, order: { gt: step.stage.order } },
        orderBy: { order: 'asc' },
        select: { id: true, reminderIntervalHours: true },
      });

      if (nextStage) {
        const activated = await transaction.stepInstance.updateMany({
          where: {
            batchId: step.batchId,
            stageId: nextStage.id,
            status: { in: [StepStatus.PENDING, StepStatus.RETURNED] },
          },
          data: {
            status: StepStatus.ALERTED,
            alertedAt: now,
            nextReminderAt: this.nextReminderAt(now, nextStage.reminderIntervalHours),
            reminderCount: 0,
            completedAt: null,
            lastComment: null,
          },
        });
        if (activated.count !== 1) {
          throw new ConflictException('The next workflow stage is not pending');
        }
      } else {
        const updatedBatch = await transaction.batch.updateMany({
          where: { id: step.batchId, status: BatchStatus.IN_PROGRESS },
          data: { status: BatchStatus.READY_FOR_PAYMENT },
        });
        if (updatedBatch.count !== 1) {
          throw new ConflictException('The batch is no longer in progress');
        }
        await transaction.auditLog.create({
          data: {
            entityType: 'batch',
            entityId: step.batchId,
            action: 'ready_for_payment',
            actor: actor.trim(),
            detail: { finalStepInstanceId: step.id },
          },
        });
      }

      await transaction.auditLog.create({
        data: {
          entityType: 'step_instance',
          entityId: step.id,
          action: 'completed',
          actor: actor.trim(),
          detail: { batchId: step.batchId, nextStageId: nextStage?.id ?? null },
        },
      });

      return { stepInstanceId: step.id, status: StepStatus.COMPLETED, nextStageId: nextStage?.id ?? null };
    });
  }

  async returnToPrevious(stepInstanceId: string, actor: string, comment: string, organizationId?: string) {
    this.validateActor(actor);
    const normalizedComment = comment.trim();
    if (!normalizedComment) throw new BadRequestException('A comment is required when returning a step');

    const step = await this.getActiveStep(stepInstanceId);
    this.validateOrganizationForStep(step, organizationId);
    this.validateActorForStep(step, actor);
    const previousStage = await this.prisma.workflowStage.findFirst({
      where: { templateId: step.stage.templateId, order: { lt: step.stage.order } },
      orderBy: { order: 'desc' },
      select: { id: true, reminderIntervalHours: true },
    });
    if (!previousStage) throw new BadRequestException('The first workflow stage cannot be returned to a previous stage');

    const now = new Date();
    return this.prisma.$transaction(async (transaction) => {
      await this.claimActiveStep(transaction, step.id, {
        status: StepStatus.RETURNED,
        completedAt: null,
        nextReminderAt: null,
        lastComment: normalizedComment,
      });

      const reactivated = await transaction.stepInstance.updateMany({
        where: { batchId: step.batchId, stageId: previousStage.id, status: StepStatus.COMPLETED },
        data: {
          status: StepStatus.ALERTED,
          alertedAt: now,
          nextReminderAt: this.nextReminderAt(now, previousStage.reminderIntervalHours),
          reminderCount: 0,
          completedAt: null,
          lastComment: normalizedComment,
        },
      });
      if (reactivated.count !== 1) {
        throw new ConflictException('The previous workflow stage is not completed');
      }

      await transaction.auditLog.create({
        data: {
          entityType: 'step_instance',
          entityId: step.id,
          action: 'returned',
          actor: actor.trim(),
          detail: { batchId: step.batchId, previousStageId: previousStage.id, comment: normalizedComment },
        },
      });

      return { stepInstanceId: step.id, status: StepStatus.RETURNED, previousStageId: previousStage.id };
    });
  }

  private async getActiveStep(stepInstanceId: string) {
    const step = await this.prisma.stepInstance.findUnique({
      where: { id: stepInstanceId },
      select: transitionContext,
    });
    if (!step) throw new NotFoundException('Workflow step not found');
    if (step.status !== StepStatus.ALERTED) {
      throw new ConflictException('Only an alerted workflow step can be actioned');
    }
    if (step.batch.status !== BatchStatus.IN_PROGRESS) {
      throw new ConflictException('The batch is no longer in progress');
    }
    return step;
  }

  private async claimActiveStep(
    transaction: Prisma.TransactionClient,
    stepInstanceId: string,
    data: Prisma.StepInstanceUpdateManyMutationInput,
  ) {
    const updated = await transaction.stepInstance.updateMany({
      where: { id: stepInstanceId, status: StepStatus.ALERTED },
      data,
    });
    if (updated.count !== 1) {
      throw new ConflictException('This workflow step has already been actioned');
    }
  }

  private nextReminderAt(from: Date, intervalHours: number): Date {
    return new Date(from.getTime() + intervalHours * 60 * 60 * 1000);
  }

  private validateActor(actor: string) {
    if (!actor.trim()) throw new BadRequestException('An actor is required for workflow actions');
  }

  private validateOrganizationForStep(step: Awaited<ReturnType<typeof this.getActiveStep>>, organizationId?: string) {
    if (!organizationId?.trim()) return;

    if (step.batch.organizationId !== organizationId.trim()) {
      throw new ForbiddenException('This actor is not authorized for the batch organization');
    }
  }

  private validateActorForStep(step: Awaited<ReturnType<typeof this.getActiveStep>>, actor: string) {
    const targetActor = actor.trim();
    const allowedActors = new Set<string>([
      step.stage.contactId,
      step.stage.backupContactId,
      step.stage.contact?.id,
      step.stage.contact?.email,
      step.stage.backupContact?.id,
      step.stage.backupContact?.email,
    ].filter((value): value is string => Boolean(value)));

    if (!allowedActors.has(targetActor)) {
      throw new ForbiddenException('Only the assigned approver or backup approver can act on this workflow step');
    }
  }
}