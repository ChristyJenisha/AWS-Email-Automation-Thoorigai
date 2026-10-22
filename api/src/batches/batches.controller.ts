import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthService } from '../auth/auth.service.js';
import { WorkflowTransitionsService } from '../workflows/workflow-transitions.service.js';
import { ConfirmOnBehalfDto, CreateBatchDto, ReassignStepDto } from './batch.dto.js';
import { BatchesService } from './batches.service.js';

@Controller('batches')
@UseGuards(AuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class BatchesController {
  constructor(
    private readonly batchesService: BatchesService,
    private readonly authService: AuthService,
    private readonly transitions: WorkflowTransitionsService,
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

  @Get(':id/history')
  async getHistory(@Req() request: any, @Param('id') id: string) {
    const batch = await this.batchesService.getHistory(id);
    this.authService.assertOrganizationAccess(request?.user, batch.organizationId);
    return batch;
  }

  @Post()
  create(@Req() request: any, @Body() input: CreateBatchDto) {
    this.authService.assertAdminAccess(request?.user);
    this.authService.assertOrganizationAccess(request?.user, input.organizationId);
    return this.batchesService.create(input);
  }

  @Post(':id/steps/:stepInstanceId/confirm-on-behalf')
  async confirmOnBehalf(
    @Req() request: any,
    @Param('id') batchId: string,
    @Param('stepInstanceId') stepInstanceId: string,
    @Body() input: ConfirmOnBehalfDto,
  ) {
    this.authService.assertAdminAccess(request?.user);
    const batch = await this.batchesService.get(batchId);
    this.authService.assertOrganizationAccess(request?.user, batch.organizationId);

    const ip = (request.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() || request.ip || 'unknown';
    const userAgent = (request.headers?.['user-agent'] as string) || 'unknown';

    return this.transitions.confirmOnBehalf(stepInstanceId, request.user, input.note, {
      ip,
      userAgent,
      source: 'manual',
    });
  }
@Post(':id/steps/:stepInstanceId/reassign')
  async reassignStep(
    @Req() request: any,
    @Param('id') batchId: string,
    @Param('stepInstanceId') stepInstanceId: string,
    @Body() input: ReassignStepDto,
  ) {
    this.authService.assertAdminAccess(request?.user);
    const batch = await this.batchesService.get(batchId);
    this.authService.assertOrganizationAccess(request?.user, batch.organizationId);

    const ip = (request.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() || request.ip || 'unknown';
    const userAgent = (request.headers?.['user-agent'] as string) || 'unknown';

    return this.transitions.reassignStep(
      stepInstanceId,
      input.newContactId,
      request.user,
      input.reason,
      { ip, userAgent, source: 'manual' },
    );
  }
@Delete(':id')
  async delete(@Req() request: any, @Param('id') id: string) {
    this.authService.assertAdminAccess(request?.user);
    const batch = await this.batchesService.get(id);
    this.authService.assertOrganizationAccess(request?.user, batch.organizationId);
    return this.batchesService.delete(id);
  }
}
