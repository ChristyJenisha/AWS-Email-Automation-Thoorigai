import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthService } from '../auth/auth.service.js';
import type { AuthedRequest } from '../auth/authed-request.interface.js';
import { CreateWorkflowDto, ReplaceWorkflowDto, WorkflowActionDto } from './workflow.dto.js';
import { WorkflowTransitionsService } from './workflow-transitions.service.js';
import { WorkflowsService } from './workflows.service.js';

@Controller('workflows')
@UseGuards(AuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class WorkflowsController {
  constructor(
    private readonly workflowsService: WorkflowsService,
    private readonly workflowTransitionsService: WorkflowTransitionsService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  list(@Req() request: AuthedRequest, @Query('organizationId') organizationId?: string) {
    this.authService.assertOrganizationAccess(request?.user, organizationId);
    return this.workflowsService.list(organizationId);
  }

  @Get(':id')
  async get(@Req() request: AuthedRequest, @Param('id') id: string) {
    const workflow = await this.workflowsService.get(id);
    this.authService.assertOrganizationAccess(request?.user, workflow.organizationId);
    return workflow;
  }

  @Post()
  create(@Req() request: AuthedRequest, @Body() input: CreateWorkflowDto) {
    this.authService.assertAdminAccess(request?.user);
    this.authService.assertOrganizationAccess(request?.user, input.organizationId);
    return this.workflowsService.create(input);
  }

  @Put(':id')
  async replace(@Req() request: AuthedRequest, @Param('id') id: string, @Body() input: ReplaceWorkflowDto) {
    this.authService.assertAdminAccess(request?.user);
    const workflow = await this.workflowsService.get(id);
    this.authService.assertOrganizationAccess(request?.user, workflow.organizationId);
    return this.workflowsService.replace(id, input);
  }

  @Delete(':id')
  async delete(@Req() request: AuthedRequest, @Param('id') id: string) {
    this.authService.assertAdminAccess(request?.user);
    const workflow = await this.workflowsService.get(id);
    this.authService.assertOrganizationAccess(request?.user, workflow.organizationId);
    return this.workflowsService.delete(id);
  }

  @Get('steps/:stepInstanceId/approval-link')
  async getApprovalLink(@Req() request: AuthedRequest, @Param('stepInstanceId') stepInstanceId: string) {
    const link = await this.workflowTransitionsService.getApprovalLink(stepInstanceId);
    this.authService.assertOrganizationAccess(request?.user, link.organizationId);
    return { token: link.token, url: link.url, approverEmail: link.approverEmail };
  }

  @Post('steps/:stepInstanceId/complete')
  completeStep(@Req() request: AuthedRequest, @Param('stepInstanceId') stepInstanceId: string, @Body() input: WorkflowActionDto) {
    const actualRequest = typeof request === 'string' || request === undefined ? { user: undefined } : request;
    const actualStepInstanceId = typeof request === 'string' ? request : stepInstanceId;
    const actualInput = typeof request === 'string' ? (stepInstanceId as unknown as WorkflowActionDto) : input;
    const actor = actualRequest?.user?.id ?? actualInput?.actor ?? 'system';
    const organizationId = actualRequest?.user?.organizationId;

    if (actualRequest?.user) {
      return this.workflowTransitionsService.complete(actualStepInstanceId, actor, organizationId);
    }

    return this.workflowTransitionsService.complete(actualStepInstanceId, actor);
  }

  @Post('steps/:stepInstanceId/return')
  returnStep(@Req() request: AuthedRequest, @Param('stepInstanceId') stepInstanceId: string, @Body() input: WorkflowActionDto) {
    const actualRequest = typeof request === 'string' || request === undefined ? { user: undefined } : request;
    const actualStepInstanceId = typeof request === 'string' ? request : stepInstanceId;
    const actualInput = typeof request === 'string' ? (stepInstanceId as unknown as WorkflowActionDto) : input;
    const actor = actualRequest?.user?.id ?? actualInput?.actor ?? 'system';
    const organizationId = actualRequest?.user?.organizationId;

    if (actualRequest?.user) {
      return this.workflowTransitionsService.returnToPrevious(actualStepInstanceId, actor, actualInput?.comment ?? '', organizationId);
    }

    return this.workflowTransitionsService.returnToPrevious(actualStepInstanceId, actor, actualInput?.comment ?? '');
  }
}
