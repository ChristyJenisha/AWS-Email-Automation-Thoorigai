import cron from 'node-cron';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RemindersService } from './reminders.service.js';
import { RemindersSchedulerService } from './reminders-scheduler.service.js';

describe('RemindersSchedulerService', () => {
  afterEach(() => vi.restoreAllMocks());

  it('schedules a one-minute sweep and stops the task on module shutdown', async () => {
    const task = { stop: vi.fn() };
    const schedule = vi.spyOn(cron, 'schedule').mockReturnValue(task as never);
    const remindersService = { processDueReminders: vi.fn().mockResolvedValue([]) } as unknown as RemindersService;
    const service = new RemindersSchedulerService(remindersService);

    service.onModuleInit();

    expect(schedule).toHaveBeenCalledWith('* * * * *', expect.any(Function), {
      name: 'reminder-sweeper',
      noOverlap: true,
    });

    await service.onModuleDestroy();
    expect(task.stop).toHaveBeenCalledOnce();
  });
});
