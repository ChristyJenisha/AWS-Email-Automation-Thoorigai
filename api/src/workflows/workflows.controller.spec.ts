import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth/auth.service.js';
import { WorkflowsController } from './workflows.controller.js';
import { WorkflowsService } from './workflows.service.js';
import { ApprovalsController } from './approvals.controller.js';
import { WorkflowTransitionsService } from './workflow-transitions.service.js';

describe('WorkflowsController', () => {
  let controller: WorkflowsController;
  const workflowsService = { list: vi.fn(), get: vi.fn(), create: vi.fn(), replace: vi.fn(), delete: vi.fn() };
  const authService = { assertOrganizationAccess: vi.fn() };
  const workflowTransitionsService = {
    complete: vi.fn(),
    returnToPrevious: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkflowsController],
      providers: [
        { provide: WorkflowsService, useValue: workflowsService },
        { provide: WorkflowTransitionsService, useValue: workflowTransitionsService },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    controller = module.get<WorkflowsController>(WorkflowsController);
  });

  it('delegates a workflow completion action to the transition service', async () => {
    workflowTransitionsService.complete.mockResolvedValue({ stepInstanceId: 'step-1', status: 'COMPLETED' });

    await expect(controller.completeStep('step-1', { actor: 'approver@example.test' })).resolves.toEqual({
      stepInstanceId: 'step-1',
      status: 'COMPLETED',
    });
    expect(workflowTransitionsService.complete).toHaveBeenCalledWith('step-1', 'approver@example.test');
  });

  it('delegates a return action with the required comment', async () => {
    workflowTransitionsService.returnToPrevious.mockResolvedValue({ stepInstanceId: 'step-1', status: 'RETURNED' });

    await expect(
      controller.returnStep('step-1', { actor: 'approver@example.test', comment: 'Please correct the invoice total' }),
    ).resolves.toEqual({ stepInstanceId: 'step-1', status: 'RETURNED' });
    expect(workflowTransitionsService.returnToPrevious).toHaveBeenCalledWith(
      'step-1',
      'approver@example.test',
      'Please correct the invoice total',
    );
  });

  it('inspects an approval token before allowing a public approval action', async () => {
    workflowTransitionsService.inspectApprovalToken = vi.fn().mockResolvedValue({ batchId: 'batch-1' });
    const approvalsController = new ApprovalsController(workflowTransitionsService as any);

    await expect(approvalsController.inspect({ token: 'signed-token' })).resolves.toEqual({ batchId: 'batch-1' });
    expect(workflowTransitionsService.inspectApprovalToken).toHaveBeenCalledWith('signed-token');
  });

  it('completes the step identified by a valid approval token', async () => {
    workflowTransitionsService.verifyApprovalToken = vi.fn().mockReturnValue({
      stepInstanceId: 'step-1',
      actorId: 'approver-1',
      organizationId: 'demo-org',
    });
    workflowTransitionsService.complete.mockResolvedValue({ status: 'COMPLETED' });
    const approvalsController = new ApprovalsController(workflowTransitionsService as any);

    await expect(approvalsController.complete({ token: 'signed-token' })).resolves.toEqual({ status: 'COMPLETED' });
    expect(workflowTransitionsService.complete).toHaveBeenCalledWith('step-1', 'approver-1', 'demo-org');
  });

  it('returns the token-scoped step with the approver comment', async () => {
    workflowTransitionsService.verifyApprovalToken = vi.fn().mockReturnValue({
      stepInstanceId: 'step-1',
      actorId: 'approver-1',
      organizationId: 'demo-org',
    });
    workflowTransitionsService.returnToPrevious.mockResolvedValue({ status: 'RETURNED' });
    const approvalsController = new ApprovalsController(workflowTransitionsService as any);

    await expect(approvalsController.returnToPrevious({ token: 'signed-token', comment: 'Correct the total' })).resolves.toEqual({
      status: 'RETURNED',
    });
    expect(workflowTransitionsService.returnToPrevious).toHaveBeenCalledWith(
      'step-1',
      'approver-1',
      'Correct the total',
      'demo-org',
    );
  });
});
