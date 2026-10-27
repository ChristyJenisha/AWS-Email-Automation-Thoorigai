import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const ORG_SCOPED_KEY = 'org_scoped';
export const OrgScoped = (paramName = 'organizationId') => SetMetadata(ORG_SCOPED_KEY, paramName);

@Injectable()
export class OrgScopedGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const paramName = this.reflector.getAllAndOverride<string | undefined>(ORG_SCOPED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!paramName) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return false;

    const targetOrgId =
      request.params?.[paramName] ||
      request.query?.[paramName] ||
      request.body?.[paramName] ||
      request.headers?.['x-organization-id'];

    if (!targetOrgId) {
      return true;
    }

    if (user.organizationId !== targetOrgId) {
      throw new ForbiddenException('Cross-organization access is strictly forbidden');
    }

    return true;
  }
}
