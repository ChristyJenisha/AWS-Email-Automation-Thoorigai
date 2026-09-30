import { Injectable } from '@nestjs/common';
import { NotificationStatus, StepStatus } from '@prisma/client';
import { EmailService } from '../email/email.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService = new EmailService(),
  ) {}

  async processDueReminders(now: Date = new Date()) {
    const dueSteps = await this.prisma.stepInstance.findMany({
      where: {
        status: StepStatus.ALERTED,
        nextReminderAt: { lte: now },
      },
      include: {
        stage: {
          include: {
            contact: { select: { email: true } },
            backupContact: { select: { email: true } },
          },
        },
      },
    });

    const results: Array<{ stepInstanceId: string; notificationId: string; recipient: string; nextReminderAt: Date | null }> = [];

    for (const step of dueSteps) {
      const recipient = step.stage.contact?.email ?? step.stage.backupContact?.email;
      if (!recipient) {
        continue;
      }

      const nextReminderCount = step.reminderCount + 1;
      const shouldEscalate = nextReminderCount >= step.stage.maxReminders;
      const nextReminderAt = shouldEscalate ? null : new Date(now.getTime() + step.stage.reminderIntervalHours * 60 * 60 * 1000);

      const notification = await this.prisma.notification.create({
        data: {
          batchId: step.batchId,
          stepInstanceId: step.id,
          recipient,
          status: NotificationStatus.PENDING,
        },
      });

      await this.emailService.sendReminderEmail({
        to: recipient,
        subject: `Reminder: pending workflow step for batch ${step.batchId}`,
        body: `This is a reminder to review the pending workflow step for batch ${step.batchId}. Please complete or return the action before the next escalation window.`,
      });

      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
        },
      });

      await this.prisma.stepInstance.updateMany({
        where: { id: step.id, status: StepStatus.ALERTED },
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
          },
        },
      });

      results.push({
        stepInstanceId: step.id,
        notificationId: notification.id,
        recipient,
        nextReminderAt,
      });
    }

    return results;
  }
}
