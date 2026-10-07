import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RemindersModule } from '../reminders/reminders.module.js';
import { BatchesController } from './batches.controller.js';
import { BatchesService } from './batches.service.js';

@Module({
  imports: [AuthModule, RemindersModule],
  controllers: [BatchesController],
  providers: [BatchesService],
})
export class BatchesModule {}
