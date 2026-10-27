import { Injectable } from '@nestjs/common';
import { NotificationStatus, Role, StepStatus } from '@prisma/client';
import { EmailService, buildApprovalEmailHtml } from '../email/email.service.js';
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
            contact: { select: { id: true, email: true, name: true, isActive: true } },
            backupContact: { select: { id: true, email: true, name: true, isActive: true } },
          },
        },
        batch: {
          select: {
            id: true,
            organizationId: true,
            template: { select: { id: true, name: true } },
            bills: { select: { billNumber: true }, orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });

    if (!step) return { status: 'skipped' as const, reason: 'no_active_step' };
    const contactActive = step.stage.contact?.isActive !== false;
    const backupActive = step.stage.backupContact?.isActive !== false;
    const approver = (contactActive && step.stage.contact?.email)
      ? step.stage.contact
      : (backupActive && step.stage.backupContact?.email)
        ? step.stage.backupContact
        : null;
    if (!approver?.email || !approver.id) return { status: 'skipped' as const, reason: 'no_approver_email' };

    const batchBills = (step.batch as any)?.bills;
    const rawBatchId = (step.batch as any)?.id || step.batchId || '';
    const batchName =
      batchBills?.length === 1 && batchBills[0]?.billNumber
        ? batchBills[0].billNumber
        : batchBills && batchBills.length > 1
          ? batchBills.map((b: any) => b.billNumber).join(', ')
          : ((step.batch as any)?.template?.name || (rawBatchId.length > 8 ? `B-${rawBatchId.slice(-6).toUpperCase()}` : (rawBatchId || 'Batch')));

    const notification = await this.prisma.notification.create({
      data: {
        batchId: step.batchId,
        stepInstanceId: step.id,
        recipient: approver.email,
        status: NotificationStatus.PENDING,
      },
    });

    try {
      let initialOtpCode: string | undefined;
      if (typeof this.workflowTransitions.issueApprovalOtp === 'function') {
        try {
          const otpResult = await this.workflowTransitions.issueApprovalOtp(step.id, 30);
          initialOtpCode = otpResult?.code;
        } catch (otpErr) {
          console.warn('[INITIAL_OTP_ISSUE_WARN]', otpErr);
        }
      }

      const token = this.workflowTransitions.generateApprovalToken(step.id, approver.id, step.batch.organizationId);
      const approvalUrl = new URL('/approve', process.env.APPROVAL_APP_URL ?? 'http://localhost:3000');
      approvalUrl.searchParams.set('token', token);
      if (initialOtpCode) {
        approvalUrl.searchParams.set('otp', initialOtpCode);
      }
      console.log('[APPROVAL_URL_DEBUG] hasToken=', approvalUrl.searchParams.has('token'), 'url=', approvalUrl.origin + approvalUrl.pathname + '?token-present');

      const html = buildApprovalEmailHtml({
        headline: 'Stage 1 Review Request',
        recipientName: approver.name,
        leadMessage: 'A new batch has been prepared and is ready for your Stage 1 review.',
        batchId: step.batchId,
        batchName: batchName,
        stageOrder: 1,
        otpCode: initialOtpCode,
        otpExpiresMinutes: 30,
        ctaUrl: approvalUrl.toString(),
        ctaText: 'Review Batch →',
        subNotice: 'Click above to open the batch details. Your authorization code is applied automatically.',
      });

      await this.emailService.sendReminderEmail({
        to: approver.email,
        subject: `Approval required for batch ${step.batchId}`,
        body: `Hello ${approver.name},\n\nA batch is ready for your review.${initialOtpCode ? `\nAuthorization Code: ${initialOtpCode}` : ''}\n\nReview it here: ${approvalUrl.toString()}`,
        html,
      });
      
      // Also notify backup approver if present so either approver can review & authorize
      if (
        step.stage.backupContact?.email &&
        step.stage.backupContact.id &&
        step.stage.backupContact.email !== approver.email
      ) {
        try {
          const backupToken = this.workflowTransitions.generateApprovalToken(
            step.id,
            step.stage.backupContact.id,
            step.batch.organizationId,
          );
          const backupApprovalUrl = new URL(
            '/approve',
            process.env.APPROVAL_APP_URL ?? 'http://localhost:3000',
          );
          backupApprovalUrl.searchParams.set('token', backupToken);
          if (initialOtpCode) {
            backupApprovalUrl.searchParams.set('otp', initialOtpCode);
          }

          const backupHtml = buildApprovalEmailHtml({
            headline: 'Action Required (Backup Approver): Stage 1 Workflow Approval',
            recipientName: step.stage.backupContact.name,
            leadMessage:
              'A new bill collection batch has been initialized. As assigned backup approver, you can also review and authorize this batch.',
            batchId: step.batchId,
            batchName: batchName,
            batchLabel: 'Batch Name:',
            stageOrder: 1,
            ctaUrl: backupApprovalUrl.toString(),
            ctaText: 'Review & Approve Batch',
            subNotice: 'Click above to securely review and approve this batch.',
          });

          await this.emailService.sendReminderEmail({
            to: step.stage.backupContact.email,
            subject: `Approval required (Backup Approver) for batch ${batchName}`,
            body: `Hello ${step.stage.backupContact.name},\n\nA new bill collection batch has been initialized. As assigned backup approver, you can also review and authorize this batch.\n\nBatch Name: ${batchName}\nWorkflow Stage: Stage 1\n\nReview & Approve Batch: ${backupApprovalUrl.toString()}\n\nClick above to securely review and approve this batch.`,
            html: backupHtml,
          });
        } catch (backupErr) {
          console.warn('[BACKUP_APPROVER_EMAIL_WARN]', backupErr);
        }
      }

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

  isQuietHours(date: Date = new Date()): boolean {
    if (process.env.QUIET_HOURS_ENABLED === 'false') return false;

    const startHour = Number(process.env.QUIET_HOURS_START ?? 21); // 9 PM
    const endHour = Number(process.env.QUIET_HOURS_END ?? 8);      // 8 AM
    const timezone = process.env.QUIET_HOURS_TIMEZONE || 'Asia/Kolkata';

    try {
      const timeStr = date.toLocaleTimeString('en-US', { timeZone: timezone, hour12: false, hour: 'numeric' });
      const currentHour = parseInt(timeStr, 10);

      if (startHour > endHour) {
        return currentHour >= startHour || currentHour < endHour;
      }
      return currentHour >= startHour && currentHour < endHour;
    } catch {
      const istHour = (date.getUTCHours() + 5 + Math.floor((date.getUTCMinutes() + 30) / 60)) % 24;
      return istHour >= 21 || istHour < 8;
    }
  }

  async processDueReminders(now: Date = new Date()) {
    if (this.isQuietHours(now)) {
      console.log(`[REMINDERS_QUIET_HOURS] Skipping due reminder processing during quiet hours (${now.toISOString()})`);
      return [];
    }
    const dueSteps = await this.prisma.stepInstance.findMany({
      where: {
        status: StepStatus.ALERTED,
        nextReminderAt: { lte: now },
        batch: { deletedAt: null },
      },
      include: {
        stage: {
          include: {
            contact: { select: { id: true, email: true, isActive: true } },
            backupContact: { select: { id: true, email: true, isActive: true } },
          },
        },
        batch: {
          select: {
            organizationId: true,
            organization: {
              select: {
                contacts: {
                  where: { isActive: true, role: Role.ADMIN },
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
      const contactActive = step.stage.contact?.isActive !== false;
      const backupActive = step.stage.backupContact?.isActive !== false;
      const approver = (contactActive && step.stage.contact?.email)
        ? step.stage.contact
        : (backupActive && step.stage.backupContact?.email)
          ? step.stage.backupContact
          : null;
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

  private createApprovalUrl(stepInstanceId: string, actorId: string, organizationId: string, otpCode?: string): string {
    const token = this.workflowTransitions.generateApprovalToken(stepInstanceId, actorId, organizationId);
    const approvalUrl = new URL('/approve', process.env.APPROVAL_APP_URL ?? 'http://localhost:3000');
    approvalUrl.searchParams.set('token', token);
    if (otpCode) {
      approvalUrl.searchParams.set('otp', otpCode);
    }
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
