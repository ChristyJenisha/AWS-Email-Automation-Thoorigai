import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import type { AuthedRequest } from './authed-request.interface.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(
    @Body() input: { email?: string; password?: string },
    @Res({ passthrough: true }) response?: Response,
  ) {
    const result = await this.authService.login(input);
    if (response && result?.token) {
      const isProd = process.env.NODE_ENV === 'production';
      response.cookie('thoorigai_token', result.token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });
    }
    return result;
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) response?: Response) {
    if (response) {
      const isProd = process.env.NODE_ENV === 'production';
      response.clearCookie('thoorigai_token', {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        path: '/',
      });
    }
    return { ok: true, message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() request: AuthedRequest) {
    return request.user;
  }
}
