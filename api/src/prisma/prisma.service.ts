import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    let url = process.env.DATABASE_URL || 'postgresql://tracker:local-dev-only@localhost:5432/bill_tracker?schema=public';
    if (url.includes('@db:5432') && process.platform === 'win32') {
      url = url.replace('@db:5432', '@localhost:5432');
    }
    super({
      datasources: {
        db: {
          url,
        },
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
