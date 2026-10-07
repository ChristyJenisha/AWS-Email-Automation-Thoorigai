import { Injectable } from '@nestjs/common';
import { NotificationStatus, StepStatus } from '@prisma/client';
import { EmailService } from '../email/email.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WorkflowTransitionsService } from '../workflows/workflow-transitions.service.js';

@Injectable()
export class RemindersService {
  private readonly claimDurationMs = 5 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly workflowTransitions: WorkflowTransitionsService,
  ) {}

  async sendInitialApproval(batchId: string) {
    const step = await this.prisma.stepInstance.findFirst({
      where: { batchId, status: StepStatus.ALERTED },
      include: {
        stage: {
          include: {
            contact: { select: { id: true, email: true } },
            backupContact: { select: { id: true, email: true } },
          },
        },
        batch: { select: { organizationId: true } },
      },
    });

    if (!step) return { status: 'skipped' as const, reason: 'no_active_step' };
    const approver = step.stage.contact?.email ? step.stage.contact : step.stage.backupContact;
    if (!approver?.email || !approver.id) return { status: 'skipped' as const, reason: 'no_approver_email' };

    const notification = await this.prisma.notification.create({
      data: {
        batchId: step.batchId,
        stepInstanceId: step.id,
        recipient: approver.email,
        status: NotificationStatus.PENDING,
      },
    });

    try {
      const token = this.workflowTransitions.generateApprovalToken(step.id, approver.id, step.batch.organizationId);
      const approvalUrl = new URL('/approve', process.env.APPROVAL_APP_URL ?? 'http://localhost:3000');
      approvalUrl.searchParams.set('token', token); console.log('[APPROVAL_URL_DEBUG] hasToken=', approvalUrl.searchParams.has('token'), 'url=', approvalUrl.origin + approvalUrl.pathname + '?token-present');
      await this.emailService.sendReminderEmail({
        to: approver.email,
        subject: `Approval required for batch ${step.batchId}`,
        body: `A bill collection batch is ready for your review. Approve or return it here: ${approvalUrl.toString()}`,
      });
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.SENT, sentAt: new Date() },
      });
      return { status: 'sent' as const, notificationId: notification.id };
    } catch (error) {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.FAILED,
          error: error instanceof Error ? error.message.slice(0, 1000) : 'Approval email could not be sent',
        },
      });
      return { status: 'failed' as const, notificationId: notification.id };
    }
  }

  async processDueReminders(now: Date = new Date()) {
    const dueSteps = await this.prisma.stepInstance.findMany({
      where: {
        status: StepStatus.ALERTED,
        nextReminderAt: { lte: now },
      },
      include: {
        stage: {
          include: {
            contact: { select: { id: true, email: true } },
            backupContact: { select: { id: true, email: true } },
          },
        },
        batch: {
          select: {
            organizationId: true,
            organization: {
              select: {
                contacts: {
                  where: { isActive: true, role: { contains: 'admin', mode: 'insensitive' } },
                  select: { id: true, email: true },
                },
              },
            },
          },
        },
      },
    });

    const results: Array<{
      stepInstanceId: string;
      notificationId: string;
      recipient: string;
      nextReminderAt: Date | null;
      status: 'sent' | 'failed';
    }> = [];

    for (const step of dueSteps) {
      const approver = step.stage.contact?.email ? step.stage.contact : step.stage.backupContact;
      if (!approver?.email || !approver.id) {
        continue;
      }
      const recipient = approver.email;
      const leaseUntil = new Date(now.getTime() + this.claimDurationMs);
      const claim = await this.prisma.stepInstance.updateMany({
        where: { id: step.id, status: StepStatus.ALERTED, nextReminderAt: { lte: now } },
        data: { nextReminderAt: leaseUntil },
      });
      if (claim.count !== 1) continue;

      const nextReminderCount = step.reminderCount + 1;
      const shouldEscalate = nextReminderCount >= step.stage.maxReminders;
      const nextReminderAt = shouldEscalate ? null : new Date(now.getTime() + step.stage.reminderIntervalHours * 60 * 60 * 1000);
      const primaryDelivery = await this.sendTrackedEmail({
        batchId: step.batchId,
        stepInstanceId: step.id,
        recipient,
        subject: `Reminder: pending workflow step for batch ${step.batchId}`,
        body: `Please review the pending workflow step for batch ${step.batchId}. Approve or return it here: ${this.createApprovalUrl(step.id, approver.id, step.batch.organizationId)}`,
      });

      if (!primaryDelivery.sent) {
        await this.prisma.stepInstance.updateMany({
          where: { id: step.id, status: StepStatus.ALERTED, nextReminderAt: leaseUntil },
          data: { nextReminderAt: leaseUntil },
        });
        await this.prisma.auditLog.create({
          data: {
            entityType: 'step_instance',
            entityId: step.id,
            action: 'reminder_failed',
            actor: 'system',
            detail: { batchId: step.batchId, recipient, retryAt: leaseUntil },
          },
        });
        results.push({
          stepInstanceId: step.id,
          notificationId: primaryDelivery.notificationId,
          recipient,
          nextReminderAt: leaseUntil,
          status: 'failed',
        });
        continue;
      }

      const escalationRecipients = shouldEscalate
        ? [step.stage.backupContact, ...step.batch.organization.contacts]
            .filter((contact): contact is { id: string; email: string } => Boolean(contact?.id && contact.email))
            .filter((contact, index, contacts) =>
              contact.email.toLowerCase() !== recipient.toLowerCase() &&
              contacts.findIndex((candidate) => candidate.email.toLowerCase() === contact.email.toLowerCase()) === index,
            )
        : [];

      for (const escalationRecipient of escalationRecipients) {
        await this.sendTrackedEmail({
          batchId: step.batchId,
          stepInstanceId: step.id,
          recipient: escalationRecipient.email,
          subject: `Escalation: approval overdue for batch ${step.batchId}`,
          body: `The approval step for batch ${step.batchId} has reached its reminder limit. Review it here: ${this.createApprovalUrl(step.id, escalationRecipient.id, step.batch.organizationId)}`,
        });
      }

      await this.prisma.stepInstance.updateMany({
        where: { id: step.id, status: StepStatus.ALERTED, nextReminderAt: leaseUntil },
        data: {
          reminderCount: nextReminderCount,
          nextReminderAt,
          status: shouldEscalate ? StepStatus.ESCALATED : StepStatus.ALERTED,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          entityType: 'step_instance',
          entityId: step.id,
          action: 'reminder_sent',
          actor: 'system',
          detail: {
            batchId: step.batchId,
            recipient,
            reminderCount: nextReminderCount,
            escalated: shouldEscalate,
            escalationRecipients: escalationRecipients.map((contact) => contact.email),
          },
        },
      });

      results.push({
        stepInstanceId: step.id,
        notificationId: primaryDelivery.notificationId,
        recipient,
        nextReminderAt,
        status: 'sent',
      });
    }

    return results;
  }

  private createApprovalUrl(stepInstanceId: string, actorId: string, organizationId: string): string {
    const token = this.workflowTransitions.generateApprovalToken(stepInstanceId, actorId, organizationId);
    const approvalUrl = new URL('/approve', process.env.APPROVAL_APP_URL ?? 'http://localhost:3000');
    approvalUrl.searchParams.set('token', token); console.log('[APPROVAL_URL_DEBUG] hasToken=', approvalUrl.searchParams.has('token'), 'url=', approvalUrl.origin + approvalUrl.pathname + '?token-present');
    return approvalUrl.toString();
  }

  private async sendTrackedEmail(input: {
    batchId: string;
    stepInstanceId: string;
    recipient: string;
    subject: string;
    body: string;
  }): Promise<{ notificationId: string; sent: boolean }> {
    const notification = await this.prisma.notification.create({
      data: {
        batchId: input.batchId,
        stepInstanceId: input.stepInstanceId,
        recipient: input.recipient,
        status: NotificationStatus.PENDING,
      },
    });

    try {
      await this.emailService.sendReminderEmail({ to: input.recipient, subject: input.subject, body: input.body });
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.SENT, sentAt: new Date() },
      });
      return { notificationId: notification.id, sent: true };
    } catch (error) {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.FAILED,
          error: error instanceof Error ? error.message.slice(0, 1000) : 'Email delivery failed',
        },
      });
      return { notificationId: notification.id, sent: false };
    }
  }
}
