import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { EmailModule } from '../email/email.module.js';
import { ApprovalsController } from './approvals.controller.js';
import { WorkflowsController } from './workflows.controller.js';
import { WorkflowsService } from './workflows.service.js';
import { WorkflowTransitionsService } from './workflow-transitions.service.js';

@Module({
  imports: [AuthModule, EmailModule],
  controllers: [WorkflowsController, ApprovalsController],
  providers: [WorkflowsService, WorkflowTransitionsService],
  exports: [WorkflowTransitionsService],
})
export class WorkflowsModule {}
