import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import cron, { type ScheduledTask } from 'node-cron';
import { RemindersService } from './reminders.service.js';

@Injectable()
export class RemindersSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemindersSchedulerService.name);
  private task: ScheduledTask | undefined;

  constructor(private readonly remindersService: RemindersService) {}

  onModuleInit() {
    this.task = cron.schedule('* * * * *', async () => {
      try {
        const results = await this.remindersService.processDueReminders();
        if (results.length > 0) this.logger.log(`Processed ${results.length} due reminder(s)`);
      } catch (error) {
        this.logger.error('Reminder sweep failed', error instanceof Error ? error.stack : String(error));
      }
    }, { name: 'reminder-sweeper', noOverlap: true });
  }

  async onModuleDestroy() {
    await this.task?.stop();
  }
}