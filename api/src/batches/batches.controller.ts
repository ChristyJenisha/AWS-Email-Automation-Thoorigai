import { Body, Controller, Get, Param, Post, Query, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthService } from '../auth/auth.service.js';
import { CreateBatchDto } from './batch.dto.js';
import { BatchesService } from './batches.service.js';

@Controller('batches')
@UseGuards(AuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class BatchesController {
  constructor(
    private readonly batchesService: BatchesService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  list(@Req() request: any, @Query('organizationId') organizationId?: string) {
    this.authService.assertOrganizationAccess(request?.user, organizationId);
    return this.batchesService.list(organizationId);
  }

  @Get(':id')
  get(@Req() request: any, @Param('id') id: string) {
    const original = this.batchesService.get(id);
    return Promise.resolve(original).then(async (batch) => {
      this.authService.assertOrganizationAccess(request?.user, batch.organizationId);
      return batch;
    });
  }

  @Post()
  create(@Req() request: any, @Body() input: CreateBatchDto) {
    this.authService.assertOrganizationAccess(request?.user, input.organizationId);
    return this.batchesService.create(input);
  }
}