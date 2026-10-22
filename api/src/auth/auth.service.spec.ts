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

  it('rejects demo logins when DEMO_MODE is false or in production without explicit DEMO_MODE=true', async () => {
    const originalEnv = { ...process.env };
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.DEMO_MODE;
      const service = new AuthService();
      await expect(service.login({ email: 'approver@example.test', password: 'demo123' })).rejects.toThrow(
        'Invalid email or password',
      );
    } finally {
      process.env = originalEnv;
    }
  });

  it('allows bootstrap admin to sign in and resolve session in production with DEMO_MODE unset', async () => {
    const originalEnv = { ...process.env };
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.DEMO_MODE;
      process.env.ADMIN_EMAIL = 'superadmin@company.com';
      process.env.ADMIN_PASSWORD = 'ProductionSecurePassword999!';
      process.env.ADMIN_NAME = 'Primary Superadmin';
      process.env.ADMIN_ORG_ID = 'prod-org-1';

      const service = new AuthService();

      // Successful login with configured bootstrap credentials
      const result = await service.login({
        email: 'superadmin@company.com',
        password: 'ProductionSecurePassword999!',
      });

      expect(result.user).toMatchObject({
        email: 'superadmin@company.com',
        name: 'Primary Superadmin',
        role: 'Admin',
        organizationId: 'prod-org-1',
      });
      expect(result.token).toBeTruthy();

      // Session resolution works with the generated token
      const session = await service.resolveSession(result.token);
      expect(session).toMatchObject({
        email: 'superadmin@company.com',
        role: 'Admin',
      });

      // Wrong password fails
      await expect(
        service.login({ email: 'superadmin@company.com', password: 'WrongPassword!' }),
      ).rejects.toThrow('Invalid email or password');

      // Demo accounts still fail
      await expect(
        service.login({ email: 'admin@example.test', password: 'demo123' }),
      ).rejects.toThrow('Invalid email or password');
    } finally {
      process.env = originalEnv;
    }
  });
});
