import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrgScopedGuard } from './org-scoped.guard.js';

describe('OrgScopedGuard', () => {
  let guard: OrgScopedGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new OrgScopedGuard(reflector);
  });

  function createMockContext(user: any, requestData: { params?: any; query?: any; body?: any; headers?: any } = {}): ExecutionContext {
    return {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          params: requestData.params || {},
          query: requestData.query || {},
          body: requestData.body || {},
          headers: requestData.headers || {},
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('allows access when route is not org-scoped', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext({ id: 'user-1', organizationId: 'org-1' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access when user organization matches the target organizationId', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue('organizationId');
    const context = createMockContext(
      { id: 'user-1', organizationId: 'org-1' },
      { query: { organizationId: 'org-1' } },
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException on cross-organization access attempt', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue('organizationId');
    const context = createMockContext(
      { id: 'user-1', organizationId: 'org-1' },
      { query: { organizationId: 'org-2-evil' } },
    );

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow('Cross-organization access is strictly forbidden');
  });
});
