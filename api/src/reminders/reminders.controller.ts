import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthService } from '../auth/auth.service.js';
import { RemindersService } from './reminders.service.js';

@Controller('reminders')
@UseGuards(AuthGuard)
export class RemindersController {
  constructor(
    private readonly remindersService: RemindersService,
    private readonly authService: AuthService,
  ) {}

  @Get('due')
  getDue(@Req() request: any) {
    this.authService.assertAdminAccess(request?.user);
    return this.remindersService.processDueReminders(new Date());
  }

  @Post('run')
  run(@Req() request: any) {
    this.authService.assertAdminAccess(request?.user);
    return this.remindersService.processDueReminders(new Date());
  }
}
