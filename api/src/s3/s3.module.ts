import { Module } from '@nestjs/common';
import { S3HealthController } from './s3-health.controller.js';
import { S3StorageService } from './s3-storage.service.js';

@Module({
  controllers: [S3HealthController],
  providers: [S3StorageService],
  exports: [S3StorageService],
})
export class S3Module {}