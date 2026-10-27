import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac } from 'node:crypto';
import jwt from 'jsonwebtoken';

export interface ApprovalTokenPayload {
  stepInstanceId: string;
  actorId: string;
  organizationId?: string;
  otpVerified?: boolean;
}

@Injectable()
export class WorkflowCryptoService {
  getTokenSigningSecret(): string {
    const secret = process.env.TOKEN_SIGNING_SECRET;
    if (!secret) {
      throw new ServiceUnavailableException('Approval links are not configured');
    }
    return secret;
  }

  generateApprovalToken(stepInstanceId: string, actorId: string, organizationId?: string): string {
    return jwt.sign(
      { stepInstanceId, actorId, organizationId },
      this.getTokenSigningSecret(),
      { expiresIn: '7d' },
    );
  }

  verifyApprovalToken(token: string, requireOtp = false): ApprovalTokenPayload {
    try {
      const payload = jwt.verify(token, this.getTokenSigningSecret()) as Record<string, unknown>;

      if (typeof payload.stepInstanceId !== 'string' || typeof payload.actorId !== 'string') {
        throw new BadRequestException('Approval token is invalid');
      }

      if (requireOtp && payload.otpVerified !== true) {
        throw new UnauthorizedException('Email verification is required before this action');
      }

      return {
        stepInstanceId: payload.stepInstanceId,
        actorId: payload.actorId,
        organizationId: typeof payload.organizationId === 'string' ? payload.organizationId || undefined : undefined,
        otpVerified: payload.otpVerified === true,
      };
    } catch {
      throw new UnauthorizedException('Approval token is invalid');
    }
  }

  hashApprovalOtp(stepId: string, code: string): string {
    return createHmac('sha256', this.getTokenSigningSecret()).update(`${stepId}:${code}`).digest('hex');
  }

  generateActionToken(payload: Record<string, unknown>, options?: jwt.SignOptions): string {
    return jwt.sign(payload, this.getTokenSigningSecret(), { expiresIn: '10m', ...options });
  }
}
