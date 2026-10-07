import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { EmailModule } from '../email/email.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { WorkflowsModule } from '../workflows/workflows.module.js';
import { RemindersController } from './reminders.controller.js';
import { RemindersSchedulerService } from './reminders-scheduler.service.js';
import { RemindersService } from './reminders.service.js';

@Module({
  imports: [PrismaModule, AuthModule, EmailModule, WorkflowsModule],
  controllers: [RemindersController],
  providers: [RemindersService, RemindersSchedulerService],
  exports: [RemindersService],
})
export class RemindersModule {}
