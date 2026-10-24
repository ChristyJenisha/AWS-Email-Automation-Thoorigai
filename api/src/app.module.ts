import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { ContactsModule } from './contacts/contacts.module.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    S3Module,
    WorkflowsModule,
    BatchesModule,
    BillsModule,
    PaymentsModule,
    NotificationsModule,
    RemindersModule,
    AuditModule,
    AuthModule,
    ContactsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
