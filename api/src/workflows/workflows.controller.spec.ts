import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth/auth.service.js';
import { WorkflowsController } from './workflows.controller.js';
import { WorkflowsService } from './workflows.service.js';
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
});
