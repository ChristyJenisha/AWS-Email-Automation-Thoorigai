import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import cron, { type ScheduledTask } from 'node-cron';
import { RemindersService } from './reminders.service.js';
import { OutboxService } from '../notifications/outbox.service.js';

@Injectable()
export class RemindersSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemindersSchedulerService.name);
  private task: ScheduledTask | undefined;

  constructor(
    private readonly remindersService: RemindersService,
    @Optional() private readonly outboxService?: OutboxService,
  ) {}

  onModuleInit() {
    this.task = cron.schedule(
      '* * * * *',
      async () => {
        try {
          const results = await this.remindersService.processDueReminders();
          if (results.length > 0) this.logger.log(`Processed ${results.length} due reminder(s)`);
        } catch (error) {
          this.logger.error('Reminder sweep failed', error instanceof Error ? error.stack : String(error));
        }

        try {
          if (this.outboxService) {
            const outboxStats = await this.outboxService.processPending();
            if (outboxStats.sent > 0 || outboxStats.failed > 0) {
              this.logger.log(`Outbox sweep: sent ${outboxStats.sent}, failed ${outboxStats.failed}`);
            }
          }
        } catch (error) {
          this.logger.error('Outbox sweep failed', error instanceof Error ? error.stack : String(error));
        }
      },
      { name: 'reminder-sweeper', noOverlap: true },
    );
  }

  async onModuleDestroy() {
    await this.task?.stop();
  }
}
