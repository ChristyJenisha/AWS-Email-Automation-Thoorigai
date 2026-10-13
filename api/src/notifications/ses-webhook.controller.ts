import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications/ses-events')
export class SesWebhookController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleSesEvent(@Body() payload: any) {
    return this.notificationsService.handleSnsEvent(payload);
  }
}
