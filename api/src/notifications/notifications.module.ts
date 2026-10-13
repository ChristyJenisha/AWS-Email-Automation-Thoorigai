import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { NotificationsController } from './notifications.controller.js';
import { SesWebhookController } from './ses-webhook.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [NotificationsController, SesWebhookController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
