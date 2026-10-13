import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

@Injectable()
export class AppService {
  constructor(@Optional() private readonly prisma?: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getHealth() {
    let dbStatus = 'disconnected';
    if (this.prisma) {
      try {
        await this.prisma.$queryRawUnsafe('SELECT 1');
        dbStatus = 'connected';
      } catch {
        dbStatus = 'unhealthy';
      }
    }

    const isHealthy = !this.prisma || dbStatus === 'connected';

    return {
      status: isHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      database: dbStatus,
      version: '0.1.0',
    };
  }
}
