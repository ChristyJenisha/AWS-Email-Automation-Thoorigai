import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../auth/auth.service.js';
import { RemindersController } from './reminders.controller.js';
import { RemindersService } from './reminders.service.js';

describe('RemindersController', () => {
  const remindersService = {
    processDueReminders: vi.fn().mockResolvedValue({ processed: 2 }),
  };
  const authService = {
    assertAdminAccess: vi.fn(),
  };

  const controller = new RemindersController(
    remindersService as unknown as RemindersService,
    authService as unknown as AuthService,
  );

  it('checks admin access before getting due reminders', async () => {
    const user = { id: 'admin-1', role: 'Admin' };
    const result = await controller.getDue({ user });

    expect(authService.assertAdminAccess).toHaveBeenCalledWith(user);
    expect(remindersService.processDueReminders).toHaveBeenCalled();
    expect(result).toEqual({ processed: 2 });
  });

  it('checks admin access before running reminders sweep', async () => {
    const user = { id: 'admin-1', role: 'Admin' };
    const result = await controller.run({ user });

    expect(authService.assertAdminAccess).toHaveBeenCalledWith(user);
    expect(remindersService.processDueReminders).toHaveBeenCalled();
    expect(result).toEqual({ processed: 2 });
  });
});

