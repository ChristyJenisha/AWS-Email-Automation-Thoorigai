import { Controller, Get } from '@nestjs/common';
import { S3StorageService } from './s3-storage.service.js';

@Controller('health/aws')
export class S3HealthController {
  constructor(private readonly s3StorageService: S3StorageService) {}

  @Get()
  checkAwsStorage() {
    return this.s3StorageService.checkConnection();
  }
}