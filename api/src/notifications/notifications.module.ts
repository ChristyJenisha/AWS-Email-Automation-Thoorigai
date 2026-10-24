import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { EmailModule } from '../email/email.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { NotificationsController } from './notifications.controller.js';
import { SesWebhookController } from './ses-webhook.controller.js';
import { NotificationsService } from './notifications.service.js';
import { OutboxService } from './outbox.service.js';

@Module({
  imports: [PrismaModule, AuthModule, EmailModule],
  controllers: [NotificationsController, SesWebhookController],
  providers: [NotificationsService, OutboxService],
  exports: [NotificationsService, OutboxService],
})
export class NotificationsModule {}
