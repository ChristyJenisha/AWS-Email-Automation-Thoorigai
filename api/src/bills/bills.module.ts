import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BatchesModule } from '../batches/batches.module.js';
import { BillsController } from './bills.controller.js';
import { BillsService } from './bills.service.js';

@Module({
  imports: [AuthModule, BatchesModule],
  controllers: [BillsController],
  providers: [BillsService],
  exports: [BillsService],
})
export class BillsModule {}
