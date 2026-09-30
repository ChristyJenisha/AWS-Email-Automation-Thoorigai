import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { RemindersService } from './reminders.service.js';

@Controller('reminders')
@UseGuards(AuthGuard)
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get('due')
  getDue(@Req() request: any) {
    void request;
    return this.remindersService.processDueReminders(new Date());
  }

  @Post('run')
  run(@Req() request: any) {
    void request;
    return this.remindersService.processDueReminders(new Date());
  }
}
