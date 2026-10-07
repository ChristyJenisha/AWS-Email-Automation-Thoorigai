import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  it('logs in a valid demo approver and returns a usable session token', async () => {
    const service = new AuthService();

    const result = await service.login({ email: 'approver@example.test', password: 'demo123' });

    expect(result.user).toMatchObject({
      id: 'demo-approver',
      email: 'approver@example.test',
      role: 'Approver',
      organizationId: 'demo-org',
    });
    expect(result.token).toBeTruthy();
    expect(await service.resolveSession(result.token)).toMatchObject({
      id: 'demo-approver',
      email: 'approver@example.test',
    });
  });

  it('rejects an invalid login', async () => {
    const service = new AuthService();

    await expect(service.login({ email: 'unknown@example.test', password: 'wrong' })).rejects.toThrow('Invalid email or password');
  });

  it('blocks cross-organization access for protected resources', () => {
    const service = new AuthService();

    expect(() => service.assertOrganizationAccess({ organizationId: 'demo-org' }, 'demo-org')).not.toThrow();
    expect(() => service.assertOrganizationAccess({ organizationId: 'demo-org' }, 'other-org')).toThrow(ForbiddenException);
    expect(() => service.assertOrganizationAccess(undefined, 'demo-org')).toThrow(UnauthorizedException);
  });

  it('restricts contact administration to authenticated admin users', () => {
    const service = new AuthService();

    expect(() => service.assertAdminAccess({ role: 'Admin' })).not.toThrow();
    expect(() => service.assertAdminAccess({ role: 'Approver' })).toThrow('Administrator access is required');
    expect(() => service.assertAdminAccess(undefined)).toThrow(UnauthorizedException);
  });
});
