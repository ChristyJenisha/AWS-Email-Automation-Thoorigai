import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EmailService } from './email.service.js';

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(() => {
    delete process.env.AWS_SES_FROM;
    delete process.env.AWS_REGION;
    service = new EmailService();
  });

  it('falls back to a local stub when SES is not configured', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await service.sendReminderEmail({
      to: 'approver@example.test',
      subject: 'Workflow reminder',
      body: 'Please review the pending batch',
    });

    expect(result).toMatchObject({ status: 'simulated' });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
