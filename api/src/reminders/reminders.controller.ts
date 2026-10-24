import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthService } from '../auth/auth.service.js';
import type { AuthedRequest } from '../auth/authed-request.interface.js';
import { RemindersService } from './reminders.service.js';

@Controller('reminders')
@UseGuards(AuthGuard)
export class RemindersController {
  constructor(
    private readonly remindersService: RemindersService,
    private readonly authService: AuthService,
  ) {}

  @Get('due')
  getDue(@Req() request: AuthedRequest) {
    this.authService.assertAdminAccess(request?.user);
    return this.remindersService.processDueReminders(new Date());
  }

  @Post('run')
  run(@Req() request: AuthedRequest) {
    this.authService.assertAdminAccess(request?.user);
    return this.remindersService.processDueReminders(new Date());
  }
}
