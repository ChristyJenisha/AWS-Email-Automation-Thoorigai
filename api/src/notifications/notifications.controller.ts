import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthService } from '../auth/auth.service.js';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly authService: AuthService,
  ) {}

  @Get('batch/:batchId')
  async listByBatch(@Req() request: any, @Param('batchId') batchId: string) {
    const organizationId = await this.notificationsService.getBatchOrganizationId(batchId);
    this.authService.assertOrganizationAccess(request?.user, organizationId);
    return this.notificationsService.listByBatch(batchId);
  }

  @Post('batch/:batchId/send/:notificationId')
  async markSent(
    @Req() request: any,
    @Param('batchId') batchId: string,
    @Param('notificationId') notificationId: string,
  ) {
    const organizationId = await this.notificationsService.getBatchOrganizationId(batchId);
    this.authService.assertOrganizationAccess(request?.user, organizationId);
    this.authService.assertAdminAccess(request?.user);
    await this.notificationsService.assertNotificationBelongsToBatch(notificationId, batchId);
    return this.notificationsService.markSent(notificationId, batchId);
  }
}
