import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../auth/auth.service.js';
import { ContactsController } from './contacts.controller.js';
import { ContactsService } from './contacts.service.js';

describe('ContactsController', () => {
  const contactsService = { listByOrganization: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn() };
  const authService = { assertOrganizationAccess: vi.fn(), assertAdminAccess: vi.fn() };
  const controller = new ContactsController(contactsService as unknown as ContactsService, authService as unknown as AuthService);

  it('requires organization-scoped admin access to list contacts', async () => {
    await expect(controller.list({ user: { role: 'Admin', organizationId: 'org-1' } }, 'org-1')).resolves.toEqual([]);
    expect(authService.assertOrganizationAccess).toHaveBeenCalledWith({ role: 'Admin', organizationId: 'org-1' }, 'org-1');
    expect(authService.assertAdminAccess).toHaveBeenCalledWith({ role: 'Admin', organizationId: 'org-1' });
  });

  it('requires admin access before creating a contact', async () => {
    const input = { organizationId: 'org-1', name: 'Approver', email: 'approver@example.com', role: 'Approver' };
    await controller.create({ user: { role: 'Admin', organizationId: 'org-1' } }, input);
    expect(contactsService.create).toHaveBeenCalledWith(input);
  });

  it('requires admin access before updating a contact', async () => {
    const input = { email: 'real@example.com' };
    await controller.update({ user: { role: 'Admin', organizationId: 'org-1' } }, 'contact-1', input, 'org-1');
    expect(contactsService.update).toHaveBeenCalledWith('contact-1', 'org-1', input);
  });
});
