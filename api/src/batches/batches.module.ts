import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RemindersModule } from '../reminders/reminders.module.js';
import { WorkflowsModule } from '../workflows/workflows.module.js';
import { BatchesController } from './batches.controller.js';
import { BatchesService } from './batches.service.js';

@Module({
  imports: [AuthModule, RemindersModule, WorkflowsModule],
  controllers: [BatchesController],
  providers: [BatchesService],
  exports: [BatchesService],
})
export class BatchesModule {}
