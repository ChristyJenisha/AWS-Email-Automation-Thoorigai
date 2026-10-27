import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { RemindersService } from './reminders/reminders.service.js';
import { OutboxService } from './notifications/outbox.service.js';

// Load .env if present
for (const envPath of [resolve(process.cwd(), '.env'), resolve(process.cwd(), 'api/.env'), resolve(process.cwd(), '../.env')]) {
  if (existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
    } catch {
      // ignore
    }
  }
}

async function runWorker() {
  console.log('[WORKER_INIT] Starting CollectFlow Background Worker Process...');

  // Disable in-process cron inside API module to prevent double-scheduling
  process.env.ENABLE_SCHEDULER = 'false';

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const remindersService = app.get(RemindersService);
  const outboxService = app.get(OutboxService);

  let isRunning = true;

  const handleShutdown = async (signal: string) => {
    console.log(`[WORKER_SHUTDOWN] Received ${signal}. Shutting down worker gracefully...`);
    isRunning = false;
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void handleShutdown('SIGTERM'));
  process.on('SIGINT', () => void handleShutdown('SIGINT'));

  console.log('[WORKER_READY] Background worker active. Polling Outbox & Reminders...');

  // Outbox polling loop (runs every 15 seconds)
  const runOutboxSweep = async () => {
    if (!isRunning) return;
    try {
      const stats = await outboxService.processPending();
      if (stats.sent > 0 || stats.failed > 0) {
        console.log(`[WORKER_OUTBOX] Sent: ${stats.sent}, Failed: ${stats.failed}`);
      }
    } catch (err) {
      console.error('[WORKER_OUTBOX_ERROR]', err instanceof Error ? err.message : String(err));
    }
  };

  // Reminders polling loop (runs every 60 seconds)
  const runRemindersSweep = async () => {
    if (!isRunning) return;
    try {
      const results = await remindersService.processDueReminders();
      if (results.length > 0) {
        console.log(`[WORKER_REMINDERS] Processed ${results.length} due reminder(s)`);
      }
    } catch (err) {
      console.error('[WORKER_REMINDERS_ERROR]', err instanceof Error ? err.message : String(err));
    }
  };

  // Immediate initial run
  await runOutboxSweep();
  await runRemindersSweep();

  // Intervals
  setInterval(() => void runOutboxSweep(), 15_000);
  setInterval(() => void runRemindersSweep(), 60_000);

  app.enableShutdownHooks();
}

void runWorker();
