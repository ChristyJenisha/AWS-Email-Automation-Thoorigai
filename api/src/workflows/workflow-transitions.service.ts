import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { BatchStatus, Prisma, StepStatus } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService, buildApprovalEmailHtml } from '../email/email.service.js';

const transitionContext = {
  id: true,
  batchId: true,
  status: true,
  approvalOtpHash: true,
  approvalOtpExpiresAt: true,
  approvalOtpAttempts: true,
  approvalOtpRequestedAt: true,
  batch: {
    select: {
      id: true,
      status: true,
      organizationId: true,
      organization: { select: { name: true } },
      bills: { select: { billNumber: true, amount: true, balanceDue: true, dueDate: true } },
    },
  },
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
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly emailService?: EmailService,
  ) {}

  async complete(
    stepInstanceId: string,
    actor: string,
    organizationId?: string,
    metadata?: Record<string, unknown>,
  ) {
    this.validateActor(actor);
    const step = await this.getActiveStep(stepInstanceId);
    this.validateOrganizationForStep(step, organizationId);
    this.validateActorForStep(step, actor);
    const now = new Date();

    const result = await this.prisma.$transaction(async (transaction) => {
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
            approvalOtpHash: null,
            approvalOtpExpiresAt: null,
            approvalOtpAttempts: 0,
            approvalOtpRequestedAt: null,
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
            detail: { finalStepInstanceId: step.id, ...metadata },
          },
        });
      }

      await transaction.auditLog.create({
        data: {
          entityType: 'step_instance',
          entityId: step.id,
          action: 'completed',
          actor: actor.trim(),
          detail: { batchId: step.batchId, nextStageId: nextStage?.id ?? null, ...metadata },
        },
      });

      return { stepInstanceId: step.id, status: StepStatus.COMPLETED, nextStageId: nextStage?.id ?? null };
    });

    if (this.emailService) {
      const approverEmail = step.stage.contact?.email ?? step.stage.backupContact?.email;
      if (approverEmail) {
        void this.notifyApproverCompletion(approverEmail, step, Boolean(result.nextStageId)).catch(() => {});
      }
      if (result.nextStageId) {
        void this.notifyNextStageApprover(step.batchId, result.nextStageId).catch(() => {});
      } else {
        void this.notifyPaymentWaitingAlert(step.batchId).catch(() => {});
      }
    }

    return result;
  }

  async returnToPrevious(
    stepInstanceId: string,
    actor: string,
    comment: string,
    organizationId?: string,
    metadata?: Record<string, unknown>,
  ) {
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
    const result = await this.prisma.$transaction(async (transaction) => {
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
          detail: { batchId: step.batchId, previousStageId: previousStage.id, comment: normalizedComment, ...metadata },
        },
      });

      return { stepInstanceId: step.id, status: StepStatus.RETURNED, previousStageId: previousStage.id };
    });

    if (this.emailService && previousStage?.id) {
      void this.notifyReturnedStageApprover(step.batchId, previousStage.id, normalizedComment).catch(() => {});
    }

    return result;
  }

  async confirmOnBehalf(
    stepInstanceId: string,
    adminUser: { id: string; email: string; role: string; organizationId: string },
    note?: string,
    metadata?: Record<string, unknown>,
  ) {
    if (adminUser.role.toLowerCase() !== 'admin') {
      throw new ForbiddenException('Only an administrator can confirm on behalf of an approver');
    }
    const trimmedNote = note?.trim();
    if (!trimmedNote || trimmedNote.length < 10) {
      throw new BadRequestException('An offline confirmation note of at least 10 characters is required');
    }
    const step = await this.getActiveStep(stepInstanceId);
    this.validateOrganizationForStep(step, adminUser.organizationId);

    const now = new Date();
    const result = await this.prisma.$transaction(async (transaction) => {
      await this.claimActiveStep(transaction, step.id, {
        status: StepStatus.COMPLETED,
        completedAt: now,
        nextReminderAt: null,
        lastComment: `Manual confirmation: ${trimmedNote}`,
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
            approvalOtpHash: null,
            approvalOtpExpiresAt: null,
            approvalOtpAttempts: 0,
            approvalOtpRequestedAt: null,
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
            actor: adminUser.email,
            detail: { finalStepInstanceId: step.id, source: 'manual' },
          },
        });
      }

      await transaction.auditLog.create({
        data: {
          entityType: 'step_instance',
          entityId: step.id,
          action: 'completed',
          actor: adminUser.email,
          detail: {
            batchId: step.batchId,
            nextStageId: nextStage?.id ?? null,
            source: 'manual',
            offlineConfirmation: true,
            originalApprover: step.stage.contact?.email ?? step.stage.contactId,
            note: note?.trim() ?? null,
            ...metadata,
          },
        },
      });

      return {
        stepInstanceId: step.id,
        status: StepStatus.COMPLETED,
        nextStageId: nextStage?.id ?? null,
        source: 'manual',
      };
    });

    if (this.emailService) {
      if (result.nextStageId) {
        void this.notifyNextStageApprover(step.batchId, result.nextStageId).catch(() => {});
      } else {
        void this.notifyPaymentWaitingAlert(step.batchId).catch(() => {});
      }
    }

    return result;
  }

  async requestReassignment(
    token: string,
    reason: string,
    requestedContactEmail?: string,
    metadata?: Record<string, unknown>,
  ) {
    const approval = this.verifyApprovalToken(token, false);
    const step = await this.getActiveStep(approval.stepInstanceId);
    this.validateOrganizationForStep(step, approval.organizationId);
    this.validateActorForStep(step, approval.actorId);

    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      throw new BadRequestException('A reason is required when requesting reassignment');
    }

    const lastComment = `Reassignment requested: ${normalizedReason}${
      requestedContactEmail ? ` (Suggested: ${requestedContactEmail.trim()})` : ''
    }`;

    await this.prisma.stepInstance.updateMany({
      where: { id: step.id },
      data: { lastComment },
    });

    await this.prisma.auditLog.create({
      data: {
        entityType: 'step_instance',
        entityId: step.id,
        action: 'reassignment_requested',
        actor: approval.actorId,
        detail: {
          batchId: step.batchId,
          requestedContactEmail: requestedContactEmail?.trim() ?? null,
          reason: normalizedReason,
          clientApprovalRequired: true,
          ...metadata,
        },
      },
    });

    return {
      stepInstanceId: step.id,
      status: 'reassignment_requested',
      message: 'Reassignment request recorded for client administrator review',
    };
  }

  async reassignStep(
    stepInstanceId: string,
    newContactId: string,
    adminUser: { id: string; email: string; role: string; organizationId?: string },
    reason?: string,
    metadata?: Record<string, unknown>,
  ) {
    if (adminUser.role.toLowerCase() !== 'admin') {
      throw new ForbiddenException('Only an organization administrator can reassign workflow steps');
    }

    const step = await this.prisma.stepInstance.findUnique({
      where: { id: stepInstanceId },
      include: {
        stage: { include: { contact: true } },
        batch: { include: { organization: true, bills: true } },
      },
    });
    if (!step) throw new NotFoundException('Workflow step not found');
    if (step.status !== StepStatus.ALERTED) {
      throw new ConflictException('Only an alerted workflow step can be reassigned');
    }
    if (adminUser.organizationId && step.batch.organizationId !== adminUser.organizationId) {
      throw new ForbiddenException('Administrator is not authorized for this batch organization');
    }

    const newContact = await this.prisma.contact.findFirst({
      where: { id: newContactId, organizationId: step.batch.organizationId, isActive: true },
    });
    if (!newContact) {
      throw new BadRequestException('Target contact is not an active member of this organization');
    }

    const normalizedReason = reason?.trim();
    const lastComment = `Reassigned by admin to ${newContact.name} (${newContact.email})${
      normalizedReason ? `: ${normalizedReason}` : ''
    }`;

    await this.prisma.$transaction(async (tx) => {
      await tx.workflowStage.update({
        where: { id: step.stageId },
        data: { contactId: newContact.id },
      });

      await tx.stepInstance.updateMany({
        where: { id: step.id },
        data: {
          lastComment,
          approvalOtpHash: null,
          approvalOtpExpiresAt: null,
          approvalOtpAttempts: 0,
          approvalOtpRequestedAt: null,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'step_instance',
          entityId: step.id,
          action: 'step_reassigned',
          actor: adminUser.email,
          detail: {
            batchId: step.batchId,
            previousContactId: step.stage.contactId,
            previousContactEmail: step.stage.contact?.email ?? null,
            newContactId: newContact.id,
            newContactEmail: newContact.email,
            reason: normalizedReason ?? null,
            source: 'manual',
            ...metadata,
          },
        },
      });
    });

    try {
      if (this.emailService && newContact.email) {
        const { code } = await this.issueApprovalOtp(step.id, 30);
        const link = await this.getApprovalLink(step.id, code);
        const totalAmount = step.batch.bills?.reduce((sum, b) => sum + Number(b.amount), 0) ?? 0;

        const html = buildApprovalEmailHtml({
          headline: `Stage ${step.stage.order} Review Reassigned`,
          recipientName: newContact.name,
          leadMessage: `A batch in ${step.batch.organization.name} has been reassigned to you for review.${
            normalizedReason ? ` Note from administrator: "${normalizedReason}".` : ''
          } Please review the details.`,
          batchId: step.batchId,
          stageOrder: step.stage.order,
          totalAmount: totalAmount > 0 ? totalAmount : undefined,
          otpCode: code,
          otpExpiresMinutes: 30,
          ctaUrl: link.url,
          ctaText: 'Review Batch →',
          subNotice: 'Click above to review the batch details.',
        });

        await this.emailService.sendReminderEmail({
          to: newContact.email,
          subject: `Thoorigai Ledger: Batch #${step.batch.id.slice(0, 8)} review reassigned to you`,
          body: `Hello ${newContact.name},\n\nYou have been assigned to review Batch #${step.batch.id.slice(0, 8)} in ${step.batch.organization.name}.${
            normalizedReason ? `\nNote: ${normalizedReason}` : ''
          }\n\nAuthorization Code: ${code} (valid for 30 minutes)\n\nReview the batch here:\n${link.url}`,
          html,
        });
      }
    } catch {
      // non-fatal email delivery failure logged in reminders/notifications
    }

    return {
      stepInstanceId: step.id,
      status: step.status,
      newContact: { id: newContact.id, name: newContact.name, email: newContact.email },
      lastComment,
      message: `Step successfully reassigned to ${newContact.name}`,
    };
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
      data: {
        ...data,
        approvalOtpHash: null,
        approvalOtpExpiresAt: null,
        approvalOtpAttempts: 0,
        approvalOtpRequestedAt: null,
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException('This workflow step has already been actioned');
    }
  }

  async getApprovalLink(stepInstanceId: string, otpCode?: string) {
    const step = await this.prisma.stepInstance.findUnique({
      where: { id: stepInstanceId },
      include: {
        stage: { include: { contact: true, backupContact: true } },
        batch: { select: { organizationId: true } },
      },
    });
    if (!step) throw new NotFoundException('Step not found');

    const approver = step.stage.contact?.email ? step.stage.contact : step.stage.backupContact;
    if (!approver) throw new BadRequestException('Approver contact not found');

    const token = this.generateApprovalToken(step.id, approver.id, step.batch.organizationId);
    const baseUrl = process.env.APPROVAL_APP_URL || 'http://localhost:3000';
    const url = new URL('/approve', baseUrl);
    url.searchParams.set('token', token);
    if (otpCode) {
      url.searchParams.set('otp', otpCode);
    }
    return { token, url: url.toString(), approverEmail: approver.email, organizationId: step.batch.organizationId };
  }

  generateApprovalToken(stepInstanceId: string, actorId: string, organizationId?: string) {
    const payload: Record<string, string> = {
      stepInstanceId,
      actorId,
      organizationId: organizationId ?? '',
    };
    // The approval step's active status is the link's validity window. This
    // also lets mail security scanners inspect a link without consuming it.
    return jwt.sign(payload, this.getTokenSigningSecret());
  }

  async issueApprovalOtp(stepId: string, ttlMinutes = 30): Promise<{ code: string; expiresAt: Date }> {
    const code = String(randomInt(100_000, 1_000_000));
    const codeHash = this.hashApprovalOtp(stepId, code);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);

    await this.prisma.stepInstance.update({
      where: { id: stepId },
      data: {
        approvalOtpHash: codeHash,
        approvalOtpExpiresAt: expiresAt,
        approvalOtpAttempts: 0,
        approvalOtpRequestedAt: now,
      },
    });

    return { code, expiresAt };
  }

  async requestApprovalOtp(token: string) {
    const approval = this.verifyApprovalToken(token);
    const step = await this.getActiveStep(approval.stepInstanceId);
    this.validateOrganizationForStep(step, approval.organizationId);
    this.validateActorForStep(step, approval.actorId);
    const recipient = step.stage.contactId === approval.actorId
      ? step.stage.contact?.email
      : step.stage.backupContact?.email;
    if (!recipient) throw new ServiceUnavailableException('The assigned approver has no email address');
    if (!this.emailService) throw new ServiceUnavailableException('Email delivery is not available');

    const now = new Date();
    const cooldownMs = 60_000;
    if (step.approvalOtpRequestedAt && now.getTime() - step.approvalOtpRequestedAt.getTime() < cooldownMs) {
      throw new HttpException('Please wait before requesting another verification code', HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = String(randomInt(100_000, 1_000_000));
    const codeHash = this.hashApprovalOtp(step.id, code);
    const configuredTtl = Number(process.env.OTP_TTL_SECONDS ?? 600);
    const ttlSeconds = Number.isFinite(configuredTtl) ? Math.max(60, Math.min(configuredTtl, 1800)) : 600;
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    const claimed = await this.prisma.stepInstance.updateMany({
      where: {
        id: step.id,
        status: StepStatus.ALERTED,
        OR: [
          { approvalOtpRequestedAt: null },
          { approvalOtpRequestedAt: { lte: new Date(now.getTime() - cooldownMs) } },
        ],
      },
      data: {
        approvalOtpHash: codeHash,
        approvalOtpExpiresAt: expiresAt,
        approvalOtpAttempts: 0,
        approvalOtpRequestedAt: now,
      },
    });
    if (claimed.count !== 1) {
      throw new HttpException('Please wait before requesting another verification code', HttpStatus.TOO_MANY_REQUESTS);
    }

    const baseUrl = process.env.APPROVAL_APP_URL || 'http://localhost:3000';
    const approvalUrlObj = new URL('/approve', baseUrl);
    approvalUrlObj.searchParams.set('token', token);
    approvalUrlObj.searchParams.set('otp', code);
    const approvalUrl = approvalUrlObj.toString();
    const remainingMinutes = Math.ceil((expiresAt.getTime() - now.getTime()) / 60_000);

    const html = buildApprovalEmailHtml({
      headline: 'Authorization Code',
      recipientName: recipient,
      leadMessage: 'Here is your authorization code to access the batch review portal.',
      otpCode: code,
      otpExpiresMinutes: remainingMinutes,
      ctaUrl: approvalUrl,
      ctaText: 'Open Batch Details →',
      subNotice: 'Click above or enter the 6-digit code on the review page.',
    });

    try {
      const delivery = await this.emailService.sendReminderEmail({
        to: recipient,
        subject: `Thoorigai Ledger: Authorization code ${code}`,
        body: `Your authorization code is ${code}. It expires in ${remainingMinutes} minutes.\n\nReview portal: ${approvalUrl}`,
        html,
        sensitive: true,
      });
      if (delivery.status === 'simulated') {
        if (process.env.NODE_ENV === 'production') {
          await this.clearApprovalOtp(step.id, codeHash);
          throw new ServiceUnavailableException('Email delivery is not configured');
        }
        return {
          status: 'simulated' as const,
          expiresAt,
          developmentCode: code,
          devCode: code,
          provider: delivery.provider,
          message: 'Simulation Mode: Email delivery simulated locally. Use the test code below.',
        };
      }
      return {
        status: 'sent' as const,
        expiresAt,
        provider: delivery.provider,
        message: `A 6-digit verification code has been dispatched to ${recipient}.`,
      };
    } catch (error) {
      await this.clearApprovalOtp(step.id, codeHash);
      throw error;
    }
  }

  async verifyApprovalOtp(token: string, code: string) {
    const approval = this.verifyApprovalToken(token);
    const step = await this.getActiveStep(approval.stepInstanceId);
    this.validateOrganizationForStep(step, approval.organizationId);
    this.validateActorForStep(step, approval.actorId);

    if (!/^\d{6}$/.test(code) || !step.approvalOtpHash || !step.approvalOtpExpiresAt) {
      throw new UnauthorizedException('The verification code is invalid or expired');
    }

    const now = new Date();
    const expected = Buffer.from(step.approvalOtpHash, 'hex');
    const provided = Buffer.from(this.hashApprovalOtp(step.id, code), 'hex');
    const matches = expected.length === provided.length && timingSafeEqual(expected, provided);
    if (!matches) {
      await this.prisma.stepInstance.updateMany({
        where: {
          id: step.id,
          status: StepStatus.ALERTED,
          approvalOtpHash: step.approvalOtpHash,
          approvalOtpExpiresAt: { gt: now },
          approvalOtpAttempts: { lt: 5 },
        },
        data: { approvalOtpAttempts: { increment: 1 } },
      });
      throw new UnauthorizedException('The verification code is invalid or expired');
    }

    const consumed = await this.prisma.stepInstance.updateMany({
      where: {
        id: step.id,
        status: StepStatus.ALERTED,
        approvalOtpHash: step.approvalOtpHash,
        approvalOtpExpiresAt: { gt: now },
        approvalOtpAttempts: { lt: 5 },
      },
      data: {
        approvalOtpHash: null,
        approvalOtpExpiresAt: null,
        approvalOtpAttempts: 0,
      },
    });
    if (consumed.count !== 1) throw new UnauthorizedException('The verification code is invalid or expired');

    return {
      actionToken: jwt.sign(
        { ...approval, otpVerified: true },
        this.getTokenSigningSecret(),
        { expiresIn: '10m' },
      ),
      expiresInSeconds: 600,
    };
  }

  private hashApprovalOtp(stepId: string, code: string) {
    return createHmac('sha256', this.getTokenSigningSecret()).update(`${stepId}:${code}`).digest('hex');
  }

  private async clearApprovalOtp(stepId: string, codeHash: string) {
    await this.prisma.stepInstance.updateMany({
      where: { id: stepId, approvalOtpHash: codeHash },
      data: { approvalOtpHash: null, approvalOtpExpiresAt: null, approvalOtpAttempts: 0 },
    });
  }

  verifyApprovalToken(token: string, requireOtp = false): { stepInstanceId: string; actorId: string; organizationId?: string; otpVerified?: boolean } {
    try {
      const payload = jwt.verify(token, this.getTokenSigningSecret()) as Record<string, unknown>;

      if (typeof payload.stepInstanceId !== 'string' || typeof payload.actorId !== 'string') {
        throw new BadRequestException('Approval token is invalid');
      }

      if (requireOtp && payload.otpVerified !== true) {
        throw new UnauthorizedException('Email verification is required before this action');
      }

      return {
        stepInstanceId: payload.stepInstanceId,
        actorId: payload.actorId,
        organizationId: typeof payload.organizationId === 'string' ? payload.organizationId || undefined : undefined,
        otpVerified: payload.otpVerified === true,
      };
    } catch {
      throw new UnauthorizedException('Approval token is invalid');
    }
  }

  async inspectApprovalToken(token: string) {
    const approval = this.verifyApprovalToken(token);
    const step = await this.prisma.stepInstance.findUnique({
      where: { id: approval.stepInstanceId },
      select: transitionContext,
    });
    if (!step) throw new NotFoundException('Workflow step not found');
    this.validateOrganizationForStep(step, approval.organizationId);
    this.validateActorForStep(step, approval.actorId);

    if (step.status === StepStatus.COMPLETED) {
      let activeStage: {
        order: number;
        approverName: string;
        approverEmail: string;
        token: string;
        url: string;
      } | null = null;

      if (step.batch.status === BatchStatus.IN_PROGRESS) {
        const nextActiveStep = await this.prisma.stepInstance.findFirst({
          where: { batchId: step.batchId, status: StepStatus.ALERTED },
          include: {
            stage: {
              include: {
                contact: { select: { id: true, email: true, name: true } },
                backupContact: { select: { id: true, email: true, name: true } },
              },
            },
            batch: { select: { organizationId: true } },
          },
        });
        if (nextActiveStep) {
          const approver = nextActiveStep.stage.contact?.email ? nextActiveStep.stage.contact : nextActiveStep.stage.backupContact;
          if (approver?.id && approver?.email) {
            const link = await this.getApprovalLink(nextActiveStep.id);
            activeStage = {
              order: nextActiveStep.stage.order,
              approverName: approver.name,
              approverEmail: approver.email,
              token: link.token,
              url: link.url,
            };
          }
        }
      }

      return {
        stepInstanceId: step.id,
        batchId: step.batch.id,
        organizationName: step.batch.organization.name,
        stageOrder: step.stage.order,
        status: StepStatus.COMPLETED,
        batchStatus: step.batch.status,
        activeStage,
        bills: step.batch.bills.map((bill) => ({
          billNumber: bill.billNumber,
          amount: bill.amount,
          balanceDue: bill.balanceDue,
          dueDate: bill.dueDate,
        })),
      };
    }

    if (step.status !== StepStatus.ALERTED) {
      throw new ConflictException('Only an alerted workflow step can be actioned');
    }
    if (step.batch.status !== BatchStatus.IN_PROGRESS) {
      throw new ConflictException('The batch is no longer in progress');
    }

    return {
      stepInstanceId: step.id,
      batchId: step.batch.id,
      organizationName: step.batch.organization.name,
      stageOrder: step.stage.order,
      bills: step.batch.bills.map((bill) => ({
        billNumber: bill.billNumber,
        amount: bill.amount,
        balanceDue: bill.balanceDue,
        dueDate: bill.dueDate,
      })),
    };
  }

  private nextReminderAt(from: Date, intervalHours: number): Date {
    return new Date(from.getTime() + intervalHours * 60 * 60 * 1000);
  }

  private getTokenSigningSecret() {
    const secret = process.env.TOKEN_SIGNING_SECRET;
    if (!secret) throw new ServiceUnavailableException('Approval links are not configured');
    return secret;
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

  private async notifyNextStageApprover(batchId: string, stageId: string) {
    if (!this.emailService) return;
    try {
      const nextStep = await this.prisma.stepInstance.findFirst({
        where: { batchId, stageId, status: StepStatus.ALERTED },
        include: {
          stage: {
            include: {
              contact: { select: { id: true, email: true, name: true } },
              backupContact: { select: { id: true, email: true, name: true } },
            },
          },
          batch: {
            select: {
              organizationId: true,
              organization: { select: { name: true } },
              bills: { select: { amount: true } },
            },
          },
        },
      });
      if (!nextStep) return;
      const approver = nextStep.stage.contact?.email ? nextStep.stage.contact : nextStep.stage.backupContact;
      if (!approver?.email || !approver.id) return;

      const { code } = await this.issueApprovalOtp(nextStep.id, 30);
      const link = await this.getApprovalLink(nextStep.id, code);
      const totalAmount = nextStep.batch.bills?.reduce((sum, b) => sum + Number(b.amount), 0) ?? 0;

      const html = buildApprovalEmailHtml({
        headline: `Stage ${nextStep.stage.order} Review Request`,
        recipientName: approver.name,
        leadMessage: `A batch in ${nextStep.batch.organization.name} has advanced to Stage ${nextStep.stage.order} and is ready for your review.`,
        batchId: nextStep.batchId,
        stageOrder: nextStep.stage.order,
        totalAmount: totalAmount > 0 ? totalAmount.toLocaleString('en-IN') : undefined,
        otpCode: code,
        otpExpiresMinutes: 30,
        ctaUrl: link.url,
        ctaText: 'Review Batch →',
        subNotice: 'Click above to open the batch details. Your authorization code is applied automatically.',
      });

      await this.emailService.sendReminderEmail({
        to: approver.email,
        subject: `Thoorigai Ledger: Stage ${nextStep.stage.order} review for batch #${nextStep.batchId.slice(0, 8)}`,
        body: `Hello ${approver.name},\n\nA batch has reached Stage ${nextStep.stage.order} and is ready for your review. Authorization Code: ${code}.\n\nReview here: ${link.url}`,
        html,
      });
    } catch (error) {
      console.warn('[AUTOMATED_NEXT_STAGE_EMAIL_FAILED]', error);
    }
  }

  private async notifyReturnedStageApprover(batchId: string, stageId: string, comment: string) {
    if (!this.emailService) return;
    try {
      const prevStep = await this.prisma.stepInstance.findFirst({
        where: { batchId, stageId, status: StepStatus.ALERTED },
        include: {
          stage: {
            include: {
              contact: { select: { id: true, email: true, name: true } },
              backupContact: { select: { id: true, email: true, name: true } },
            },
          },
          batch: {
            select: {
              organizationId: true,
              organization: { select: { name: true } },
            },
          },
        },
      });
      if (!prevStep) return;
      const approver = prevStep.stage.contact?.email ? prevStep.stage.contact : prevStep.stage.backupContact;
      if (!approver?.email || !approver.id) return;

      const { code } = await this.issueApprovalOtp(prevStep.id, 30);
      const link = await this.getApprovalLink(prevStep.id, code);

      const html = buildApprovalEmailHtml({
        headline: `Batch Returned for Revision: Stage ${prevStep.stage.order}`,
        recipientName: approver.name,
        leadMessage: `This batch was returned for revision with note: "${comment}". Please review and update.`,
        batchId: prevStep.batchId,
        stageOrder: prevStep.stage.order,
        otpCode: code,
        otpExpiresMinutes: 30,
        ctaUrl: link.url,
        ctaText: 'Review Batch →',
        subNotice: 'Click above to review the returned batch.',
      });

      await this.emailService.sendReminderEmail({
        to: approver.email,
        subject: `Thoorigai Ledger: Batch #${prevStep.batchId.slice(0, 8)} returned for revision`,
        body: `This batch was returned with note: "${comment}". Authorization Code: ${code}.\n\nReview and update here: ${link.url}`,
        html,
      });
    } catch (error) {
      console.warn('[AUTOMATED_RETURN_STAGE_EMAIL_FAILED]', error);
    }
  }

  private async notifyApproverCompletion(approverEmail: string, step: any, hasNextStage: boolean) {
    if (!this.emailService) return;
    try {
      const stageOrder = step.stage.order;
      const bills = step.batch?.bills ?? [];
      const totalAmount = bills.reduce((sum: number, b: any) => sum + Number(b.amount || 0), 0);
      const batchBills = step.batch?.bills;
      const rawBatchId = step.batch?.id || step.batchId || '';
      const batchName =
        batchBills?.length === 1 && batchBills[0]?.billNumber
          ? batchBills[0].billNumber
          : batchBills && batchBills.length > 1
            ? batchBills.map((b: any) => b.billNumber).join(', ')
            : (step.batch?.template?.name || (rawBatchId.length > 8 ? `B-${rawBatchId.slice(-6).toUpperCase()}` : (rawBatchId || 'Batch')));

      const subject = hasNextStage
        ? `Thoorigai Ledger: Stage ${stageOrder} Approval Recorded (Batch ${batchName})`
        : `Thoorigai Ledger: Batch ${batchName} Fully Approved`;

      const baseUrl = process.env.APPROVAL_APP_URL || 'http://localhost:3000';
      const html = buildApprovalEmailHtml({
        headline: hasNextStage
          ? `Stage ${stageOrder} Approval Recorded`
          : `Batch Approval Completed`,
        leadMessage: hasNextStage
          ? `Thank you. Your review for Stage ${stageOrder} of batch ${batchName} has been recorded. The batch has advanced to the next workflow stage.`
          : `Thank you. All review stages for batch ${batchName} have been approved. The batch is now ready for payment disbursement.`,
        batchId: step.batchId,
        batchName: batchName,
        batchLabel: 'Batch Name:',
        stageOrder,
        totalAmount: totalAmount > 0 ? totalAmount.toLocaleString('en-IN') : undefined,
        ctaUrl: hasNextStage ? undefined : `${baseUrl}/payments`,
        ctaText: hasNextStage ? undefined : 'Open Payment Queue →',
        subNotice: `Recorded at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST).`,
      });

      await this.emailService.sendReminderEmail({
        to: approverEmail,
        subject,
        body: `Your approval for Stage ${stageOrder} of batch ${batchName} was successfully recorded.${
          hasNextStage ? ' The batch has advanced to the next stage.' : ` All stages are complete; ready for payment: ${baseUrl}/payments`
        }`,
        html,
      });
    } catch (error) {
      console.warn('[NOTIFY_APPROVER_COMPLETION_WARN]', error);
    }
  }

  private async notifyPaymentWaitingAlert(batchId: string) {
    if (!this.emailService) return;
    try {
      const batch = await this.prisma.batch.findUnique({
        where: { id: batchId },
        include: {
          organization: {
            include: {
              contacts: {
                where: { isActive: true },
              },
            },
          },
          template: { select: { id: true, name: true } },
          bills: { orderBy: { createdAt: 'asc' } },
        },
      });
      if (!batch) return;

      const totalAmount = batch.bills.reduce((sum, b) => sum + Number(b.amount || 0), 0);
      const baseUrl = process.env.APPROVAL_APP_URL || 'http://localhost:3000';
      const paymentsUrl = `${baseUrl}/payments`;

      const batchName =
        batch.bills?.length === 1 && batch.bills[0]?.billNumber
          ? batch.bills[0].billNumber
          : batch.bills && batch.bills.length > 1
            ? batch.bills.map((b) => b.billNumber).join(', ')
            : (batch.template?.name || (batch.id.length > 8 ? `B-${batch.id.slice(-6).toUpperCase()}` : batch.id));

      const subject = `Action Required: Batch ${batchName} Fully Approved — Ready for Payment Recording`;
      const html = buildApprovalEmailHtml({
        headline: `Payment Recording Alert: Batch ${batchName}`,
        leadMessage: `All workflow verification stages have been completed for batch ${batchName} in ${batch.organization.name}. The batch is now waiting in the payment queue for bank disbursement and UTR reference recording.`,
        batchId: batch.id,
        batchName: batchName,
        batchLabel: 'Batch Name:',
        totalAmount: totalAmount > 0 ? totalAmount.toLocaleString('en-IN') : undefined,
        ctaUrl: paymentsUrl,
        ctaText: 'Record Payment',
        subNotice: `Prompt payment recording updates invoice balances to PAID and finalizes the settlement audit trail.`,
      });

      // Target admin / finance recipients:
      const adminEmails = new Set<string>();
      if (process.env.SMTP_USER) adminEmails.add(process.env.SMTP_USER.trim());
      if (process.env.AWS_SES_FROM) {
        const raw = process.env.AWS_SES_FROM.replace(/.*<([^>]+)>.*/, '$1').trim();
        if (raw) adminEmails.add(raw);
      }
      for (const contact of batch.organization.contacts) {
        if (contact.email) {
          adminEmails.add(contact.email.trim());
        }
      }

      for (const recipient of adminEmails) {
        await this.emailService.sendReminderEmail({
          to: recipient,
          subject,
          body: `All workflow verification stages have been completed for batch ${batchName} in ${batch.organization.name}. The batch is now waiting in the payment queue for bank disbursement and UTR reference recording. (Total: Rs. ${totalAmount.toLocaleString('en-IN')}). Disburse and record payment here: ${paymentsUrl}\n\nPrompt payment recording updates invoice balances to PAID and finalizes the settlement audit trail.`,
          html,
        });
      }
    } catch (error) {
      console.warn('[NOTIFY_PAYMENT_WAITING_ALERT_WARN]', error);
    }
  }
}
