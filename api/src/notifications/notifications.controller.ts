import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('batch/:batchId')
  listByBatch(@Req() request: any, @Param('batchId') batchId: string) {
    void request;
    return this.notificationsService.listByBatch(batchId);
  }

  @Post('batch/:batchId/send/:notificationId')
  markSent(@Req() request: any, @Param('notificationId') notificationId: string) {
    void request;
    return this.notificationsService.markSent(notificationId);
  }
}
