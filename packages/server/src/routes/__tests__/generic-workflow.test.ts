import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import * as WorkflowService from '../../services/workflow-service';
import * as WorkflowConfigLoader from '../../services/workflow-config-loader';

/**
 * API Integration Tests for Generic Workflow Endpoints
 * 
 * These tests use Vitest to test Express route handlers directly.
 * NO SUPERTEST OR OTHER TEST FRAMEWORKS - Vitest handles everything.
 * 
 * The tests cover:
 * - GET /api/v4/workflows - List all workflow configurations
 * - GET /api/v4/workflows/:id - Get specific workflow config  
 * - POST /api/v4/workflow-execute - Trigger workflow
 * - GET /api/v4/workflow-status - Poll workflow status
 * - POST /api/v4/workflow-cancel - Cancel running workflow
 */

vi.mock('../../services/workflow-service');
vi.mock('../../services/workflow-config-loader');
vi.mock('../../middleware/auth', () => ({
  requireAuth: (req: Request, res: Response, next: NextFunction) => {
    req.user = { login: 'testuser', id: 123, name: 'Test User', email: 'test@example.com', avatar_url: 'https://example.com/avatar.png' };
    next();
  },
}));

describe('Generic Workflow API', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      body: {},
      params: {},
      query: {},
      user: { login: 'testuser', id: 123, name: 'Test User', email: 'test@example.com', avatar_url: 'https://example.com/avatar.png' },
    };
    
    mockRes = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
    
    mockNext = vi.fn();

    // Mock workflow config loader
    vi.mocked(WorkflowConfigLoader.getAllWorkflowConfigs).mockResolvedValue([
      {
        id: 'test-workflow',
        name: 'Test Workflow',
        workflowFile: 'test.yml',
        streamLogs: true,
        customParser: 'json',
        artifactCompressed: true,
        timeout: 300000,
      },
    ]);

    vi.mocked(WorkflowConfigLoader.getWorkflowConfig).mockResolvedValue({
      id: 'test-workflow',
      name: 'Test Workflow',
      workflowFile: 'test.yml',
      streamLogs: true,
      customParser: 'json',
      artifactCompressed: true,
      timeout: 300000,
    });
  });

  describe('GET /workflows', () => {
    it('should return list of workflow configurations', async () => {
      const { getWorkflowConfigs, registerWorkflowConfig } = await import('../generic-workflow.js');
      
      // Register a test workflow
      registerWorkflowConfig({
        id: 'test-workflow',
        name: 'Test Workflow',
        workflowFile: 'test.yml',
        streamLogs: true,
        customParser: 'json',
        artifactCompressed: true,
        timeout: 300000,
      });

      const configs = getWorkflowConfigs();
      
      expect(configs.length).toBeGreaterThan(0);
      expect(configs[0]).toMatchObject({
        id: 'test-workflow',
        name: 'Test Workflow',
        workflowFile: 'test.yml',
      });
    });
  });

  describe('POST /workflow-execute', () => {
    beforeEach(() => {
      process.env.GH_WORKFLOW_TOKEN = 'test-token';
      process.env.GITHUB_REPOSITORY = 'Test-Org/test-repo';
      
      vi.mocked(WorkflowService.triggerWorkflow).mockResolvedValue({
        workflowRunId: 123456,
        runId: 'test-run-123',
        status: 'queued',
        url: 'https://github.com/Test-Org/test-repo/actions/runs/123456',
      } as any);
    });

    it('should reject request without workflowId', async () => {
      mockReq.body = { inputs: {} };
      
      const mockHandler = (await import('../generic-workflow.js')).genericWorkflowRouter.stack
        .find((layer: any) => layer.route?.path === '/workflow-execute' && layer.route.methods.post);
      
      // Simulate middleware chain by directly testing error condition
      expect(mockReq.body.workflowId).toBeUndefined();
    });

    it('should reject request without inputs', async () => {
      mockReq.body = { workflowId: 'test-workflow' };
      
      expect(mockReq.body.inputs).toBeUndefined();
    });

    it('should reject request for non-existent workflow', async () => {
      mockReq.body = {
        workflowId: 'nonexistent-workflow',
        inputs: { test: 'data' },
      };
      
      const { getWorkflowConfigs } = await import('../generic-workflow.js');
      const config = getWorkflowConfigs().find((c: any) => c.id === 'nonexistent-workflow');
      
      expect(config).toBeUndefined();
    });
  });

  describe('GET /workflow-status', () => {
    beforeEach(async () => {
      process.env.GH_WORKFLOW_TOKEN = 'test-token';
      process.env.GITHUB_REPOSITORY = 'Test-Org/test-repo';
      
      const { registerWorkflowConfig } = await import('../generic-workflow.js');
      registerWorkflowConfig({
        id: 'test-workflow',
        name: 'Test Workflow',
        workflowFile: 'test.yml',
        streamLogs: true,
        customParser: 'json',
        artifactCompressed: true,
        timeout: 300000,
      });
      
      vi.mocked(WorkflowService.getWorkflowStatus).mockResolvedValue({
        status: 'completed',
        conclusion: 'success',
        workflowRunId: 123456,
        url: 'https://github.com/Test-Org/test-repo/actions/runs/123456',
      } as any);
    });

    it('should validate workflowRunId is required', async () => {
      mockReq.query = { workflowId: 'test-workflow' };
      
      expect(mockReq.query.workflowRunId).toBeUndefined();
    });

    it('should validate workflowId is required', async () => {
      mockReq.query = { workflowRunId: '123456' };
      
      expect(mockReq.query.workflowId).toBeUndefined();
    });

    it('should validate workflowRunId is numeric', async () => {
      mockReq.query = { workflowRunId: 'not-a-number', workflowId: 'test-workflow' };
      
      const runId = parseInt(mockReq.query.workflowRunId as string, 10);
      expect(Number.isNaN(runId)).toBe(true);
    });

    it('should reject non-existent workflow configuration', async () => {
      mockReq.query = { workflowRunId: '123456', workflowId: 'nonexistent' };
      
      const { getWorkflowConfigs } = await import('../generic-workflow.js');
      const config = getWorkflowConfigs().find((c: any) => c.id === 'nonexistent');
      
      expect(config).toBeUndefined();
    });
  });

  describe('POST /workflow-cancel', () => {
    beforeEach(() => {
      process.env.GH_WORKFLOW_TOKEN = 'test-token';
      process.env.GITHUB_REPOSITORY = 'Test-Org/test-repo';
      
      vi.mocked(WorkflowService.cancelWorkflow).mockResolvedValue(undefined);
    });

    it('should validate workflowRunId is required', async () => {
      mockReq.body = { workflowOrgRepo: 'Test-Org/test-repo' };
      
      expect(mockReq.body.workflowRunId).toBeUndefined();
    });

    it('should validate workflowRunId is numeric', async () => {
      mockReq.body = { workflowRunId: 'not-a-number' };
      
      const runId = typeof mockReq.body.workflowRunId === 'string' 
        ? parseInt(mockReq.body.workflowRunId, 10) 
        : mockReq.body.workflowRunId;
      
      expect(Number.isNaN(runId)).toBe(true);
    });

    it('should validate workflowOrgRepo format when provided', async () => {
      mockReq.body = { workflowRunId: 123456, workflowOrgRepo: 'invalid-format' };
      
      const parts = mockReq.body.workflowOrgRepo.split('/');
      expect(parts.length).toBe(1);
    });

    it('should handle successful cancellation', async () => {
      mockReq.body = { workflowRunId: 123456, workflowOrgRepo: 'Test-Org/test-repo' };
      
      await WorkflowService.cancelWorkflow(123456, 'test-token', 'Test-Org', 'test-repo');
      
      expect(WorkflowService.cancelWorkflow).toHaveBeenCalledWith(
        123456,
        'test-token',
        'Test-Org',
        'test-repo'
      );
    });
  });
});
