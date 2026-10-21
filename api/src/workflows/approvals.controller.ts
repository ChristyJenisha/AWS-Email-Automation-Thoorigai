import { Body, Controller, Post, Req, UsePipes, ValidationPipe } from '@nestjs/common';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { WorkflowTransitionsService } from './workflow-transitions.service.js';

class ApprovalTokenActionDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsOptional()
  @IsString()
  comment?: string;
}

class ApprovalOtpRequestDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}

class ApprovalOtpVerifyDto extends ApprovalOtpRequestDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}

class ApprovalReassignDto extends ApprovalOtpRequestDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  @IsEmail()
  requestedContactEmail?: string;
}

@Controller('approvals')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class ApprovalsController {
  constructor(private readonly transitions: WorkflowTransitionsService) {}

  @Post('complete')
  complete(@Body() input: ApprovalTokenActionDto, @Req() req?: any) {
    const requireOtp = process.env.REQUIRE_APPROVAL_OTP !== 'false';
    const approval = this.transitions.verifyApprovalToken(input.token, requireOtp);
    const ip = (req?.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req?.ip || 'unknown';
    const userAgent = (req?.headers?.['user-agent'] as string) || 'unknown';
    return this.transitions.complete(approval.stepInstanceId, approval.actorId, approval.organizationId, {
      ip,
      userAgent,
      source: 'magic_link',
    });
  }

  @Post('inspect')
  inspect(@Body() input: ApprovalTokenActionDto) {
    return this.transitions.inspectApprovalToken(input.token);
  }

  @Post('request-otp')
  requestOtp(@Body() input: ApprovalOtpRequestDto) {
    return this.transitions.requestApprovalOtp(input.token);
  }

  @Post('verify-otp')
  verifyOtp(@Body() input: ApprovalOtpVerifyDto) {
    return this.transitions.verifyApprovalOtp(input.token, input.code);
  }

  @Post('return')
  returnToPrevious(@Body() input: ApprovalTokenActionDto, @Req() req?: any) {
    const requireOtp = process.env.REQUIRE_APPROVAL_OTP !== 'false';
    const approval = this.transitions.verifyApprovalToken(input.token, requireOtp);
    const ip = (req?.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req?.ip || 'unknown';
    const userAgent = (req?.headers?.['user-agent'] as string) || 'unknown';
    return this.transitions.returnToPrevious(
      approval.stepInstanceId,
      approval.actorId,
      input.comment ?? '',
      approval.organizationId,
      { ip, userAgent, source: 'magic_link' },
    );
  }

  @Post('reassign')
  reassign(@Body() input: ApprovalReassignDto, @Req() req?: any) {
    const ip = (req?.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req?.ip || 'unknown';
    const userAgent = (req?.headers?.['user-agent'] as string) || 'unknown';
    return this.transitions.requestReassignment(
      input.token,
      input.reason,
      input.requestedContactEmail,
      { ip, userAgent, source: 'magic_link' },
    );
  }
}
