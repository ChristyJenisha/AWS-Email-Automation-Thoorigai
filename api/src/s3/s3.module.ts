import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { S3HealthController } from './s3-health.controller.js';
import { S3StorageService } from './s3-storage.service.js';

@Module({
  imports: [AuthModule],
  controllers: [S3HealthController],
  providers: [S3StorageService],
  exports: [S3StorageService],
})
export class S3Module {}
