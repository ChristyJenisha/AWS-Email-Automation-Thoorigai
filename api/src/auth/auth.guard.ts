import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const headerToken = this.authService.getTokenFromHeader(request.headers?.authorization);
    const cookieToken = request.cookies?.thoorigai_token;
    const token = headerToken || cookieToken;

    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    request.user = await this.authService.resolveSession(token);
    return true;
  }
}
