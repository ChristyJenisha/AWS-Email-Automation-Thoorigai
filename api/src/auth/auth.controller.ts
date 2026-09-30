import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() input: { email?: string; password?: string }) {
    return this.authService.login(input);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() request: any) {
    return request.user;
  }
}
