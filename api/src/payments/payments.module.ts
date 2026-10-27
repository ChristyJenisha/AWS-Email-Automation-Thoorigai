import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { S3Module } from '../s3/s3.module.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsProofService } from './payments-proof.service.js';
import { PaymentsService } from './payments.service.js';

@Module({
  imports: [PrismaModule, AuthModule, S3Module],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsProofService],
  exports: [PaymentsService, PaymentsProofService],
})
export class PaymentsModule {}
