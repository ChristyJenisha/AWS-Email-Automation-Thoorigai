import { Controller, Get, UseGuards } from '@nestjs/common';
import { S3StorageService } from './s3-storage.service.js';
import { AuthGuard } from '../auth/auth.guard.js';

@Controller('health/aws')
@UseGuards(AuthGuard)
export class S3HealthController {
  constructor(private readonly s3StorageService: S3StorageService) {}

  @Get()
  checkAwsStorage() {
    return this.s3StorageService.checkConnection();
  }
}
