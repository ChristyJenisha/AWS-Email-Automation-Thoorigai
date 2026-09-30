import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { WorkflowsModule } from './workflows/workflows.module.js';
import { BatchesModule } from './batches/batches.module.js';
import { BillsModule } from './bills/bills.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { RemindersModule } from './reminders/reminders.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { S3Module } from './s3/s3.module.js';

@Module({
  imports: [PrismaModule, S3Module, WorkflowsModule, BatchesModule, BillsModule, PaymentsModule, NotificationsModule, RemindersModule, AuditModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
