import { Injectable, Logger, Optional } from '@nestjs/common';
import { OutboxStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';

export type EnqueueEmailInput = {
  recipient: string;
  subject: string;
  body: string;
  html?: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly emailService?: EmailService,
  ) {}

  async enqueue(
    input: EnqueueEmailInput,
    transaction?: Prisma.TransactionClient,
  ) {
    const client = transaction ?? this.prisma;
    return client.outbox.create({
      data: {
        channel: 'email',
        recipient: input.recipient.trim(),
        subject: input.subject.trim(),
        body: input.body,
        html: input.html ?? null,
        metadata: input.metadata as Prisma.InputJsonValue ?? undefined,
        status: OutboxStatus.PENDING,
      },
    });
  }

  async processPending(limit = 25): Promise<{ processed: number; sent: number; failed: number }> {
    if (!this.emailService) {
      return { processed: 0, sent: 0, failed: 0 };
    }

    const now = new Date();
    const pendingItems = await this.prisma.outbox.findMany({
      where: {
        status: OutboxStatus.PENDING,
        OR: [
          { nextRetryAt: null },
          { nextRetryAt: { lte: now } },
        ],
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });

    let sent = 0;
    let failed = 0;

    for (const item of pendingItems) {
      try {
        await this.emailService.sendReminderEmail({
          to: item.recipient,
          subject: item.subject,
          body: item.body,
          html: item.html ?? undefined,
        });

        await this.prisma.outbox.update({
          where: { id: item.id },
          data: {
            status: OutboxStatus.SENT,
            sentAt: new Date(),
            lastError: null,
          },
        });
        sent++;
      } catch (error) {
        failed++;
        const nextAttempts = item.attempts + 1;
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isDead = nextAttempts >= 5;

        // Exponential backoff: 1m, 2m, 4m, 8m
        const backoffMs = Math.pow(2, nextAttempts - 1) * 60_000;
        const nextRetryAt = isDead ? null : new Date(Date.now() + backoffMs);

        await this.prisma.outbox.update({
          where: { id: item.id },
          data: {
            attempts: nextAttempts,
            status: isDead ? OutboxStatus.DEAD : OutboxStatus.PENDING,
            lastError: errorMessage.slice(0, 500),
            nextRetryAt,
          },
        });

        this.logger.warn(`[OUTBOX_DELIVERY_FAILED] id=${item.id} to=${item.recipient} attempts=${nextAttempts} dead=${isDead}`);
      }
    }

    return { processed: pendingItems.length, sent, failed };
  }
}
