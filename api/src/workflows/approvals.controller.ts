import { Body, Controller, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { WorkflowTransitionsService } from './workflow-transitions.service.js';

class ApprovalTokenActionDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsOptional()
  @IsString()
  comment?: string;
}

@Controller('approvals')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class ApprovalsController {
  constructor(private readonly transitions: WorkflowTransitionsService) {}

  @Post('complete')
  complete(@Body() input: ApprovalTokenActionDto) {
    const approval = this.transitions.verifyApprovalToken(input.token);
    return this.transitions.complete(approval.stepInstanceId, approval.actorId, approval.organizationId);
  }

  @Post('inspect')
  inspect(@Body() input: ApprovalTokenActionDto) {
    return this.transitions.inspectApprovalToken(input.token);
  }

  @Post('return')
  returnToPrevious(@Body() input: ApprovalTokenActionDto) {
    const approval = this.transitions.verifyApprovalToken(input.token);
    return this.transitions.returnToPrevious(
      approval.stepInstanceId,
      approval.actorId,
      input.comment ?? '',
      approval.organizationId,
    );
  }
}