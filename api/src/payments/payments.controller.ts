import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  PayloadTooLargeException,
  Post,
  Put,
  Req,
  StreamableFile,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { AuthService } from '../auth/auth.service.js';

import {
  AllocateOnAccountPaymentDto,
  ConfirmPaymentProofDto,
  CreatePaymentDto,
  CreatePaymentProofUploadUrlDto,
} from './payment.dto.js';

import { PaymentsService } from './payments.service.js';

@Controller('payments')
@UseGuards(AuthGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly authService: AuthService,
  ) {}

  @Get('batch/:batchId')
  async listByBatch(
    @Req() request: any,
    @Param('batchId') batchId: string,
  ) {
    const batch =
      await this.paymentsService.getBatch(batchId);

    this.authService.assertOrganizationAccess(
      request?.user,
      batch.organizationId,
    );

    return this.paymentsService.listByBatch(
      batchId,
    );
  }

  @Post()
  async create(
    @Req() request: any,
    @Body() input: CreatePaymentDto,
  ) {
    const batch =
      await this.paymentsService.getBatch(
        input.batchId,
      );

    this.authService.assertOrganizationAccess(
      request?.user,
      batch.organizationId,
    );

    return this.paymentsService.create(
      input,
      request.user.id,
    );
  }

  @Post(':paymentId/proof-upload-url')
  async createProofUploadUrl(
    @Req() request: any,
    @Param('paymentId') paymentId: string,
    @Body() input: CreatePaymentProofUploadUrlDto,
  ) {
    const payment =
      await this.paymentsService.getPayment(
        paymentId,
      );

    this.authService.assertOrganizationAccess(
      request?.user,
      payment.batch.organizationId,
    );

    return this.paymentsService.createProofUploadUrl(
      paymentId,
      input.contentType,
    );
  }

  @Put(':paymentId/proof-file')
  async uploadProofFile(
    @Req() request: any,
    @Param('paymentId') paymentId: string,
  ) {
    const payment = await this.paymentsService.getPayment(paymentId);
    this.authService.assertOrganizationAccess(request?.user, payment.batch.organizationId);

    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let exceededLimit = false;
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;
      if (totalBytes > 10 * 1024 * 1024) exceededLimit = true;
      else if (!exceededLimit) chunks.push(buffer);
    }
    if (exceededLimit) throw new PayloadTooLargeException('Payment proof must be 10 MB or smaller');
    return this.paymentsService.storeProofFile(
      paymentId,
      String(request.headers['content-type'] ?? ''),
      Buffer.concat(chunks),
    );
  }

  @Get(':paymentId/proof-download-url')
  async createProofDownloadUrl(
    @Req() request: any,
    @Param('paymentId') paymentId: string,
  ) {
    const payment = await this.paymentsService.getPayment(paymentId);

    this.authService.assertOrganizationAccess(
      request?.user,
      payment.batch.organizationId,
    );

    return this.paymentsService.createProofDownloadUrl(paymentId);
  }

  @Get(':paymentId/proof-file')
  @Header('Cache-Control', 'private, no-store')
  async getLocalProofFile(
    @Req() request: any,
    @Param('paymentId') paymentId: string,
  ) {
    const payment = await this.paymentsService.getPayment(paymentId);
    this.authService.assertOrganizationAccess(request?.user, payment.batch.organizationId);
    const proof = await this.paymentsService.getLocalProofFile(paymentId);
    return new StreamableFile(proof.content, {
      type: proof.contentType,
      disposition: 'inline; filename="payment-proof"',
    });
  }

  @Post(':paymentId/proof')
  async confirmProofUpload(
    @Req() request: any,
    @Param('paymentId') paymentId: string,
    @Body() input: ConfirmPaymentProofDto,
  ) {
    const payment = await this.paymentsService.getPayment(paymentId);

    this.authService.assertOrganizationAccess(
      request?.user,
      payment.batch.organizationId,
    );

    return this.paymentsService.confirmProofUpload(paymentId, input.key);
  }

  @Post(':paymentId/allocations')
  async allocateOnAccount(
    @Req() request: any,
    @Param('paymentId') paymentId: string,
    @Body() input: AllocateOnAccountPaymentDto,
  ) {
    const payment =
      await this.paymentsService.getPayment(
        paymentId,
      );

    this.authService.assertOrganizationAccess(
      request?.user,
      payment.batch.organizationId,
    );

    return this.paymentsService.allocateOnAccount(
      paymentId,
      input.allocations,
      request.user.id,
    );
  }
}
