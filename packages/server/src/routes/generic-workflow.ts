/**
 * Generic Workflow Execution Routes
 * 
 * Provides unified API endpoints for executing any configured GitHub Actions workflow.
 * Workflows are configured via the setup endpoint and can be triggered/monitored generically.
 * 
 * This complements the existing validation endpoints by providing a flexible,
 * extensible system for any workflow type.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { strictRateLimit } from '../middleware/rate-limit.js';
import {
  WorkflowConfig,
  WorkflowExecutionRequest,
} from '../types/workflow.js';
import {
  triggerWorkflow,
  getWorkflowStatus,
  cancelWorkflow,
} from '../services/workflow-service.js';

const router = Router();

// Apply authentication to all workflow endpoints
router.use(requireAuth);

// In-memory workflow configuration registry (populated from setup endpoint)
const workflowRegistry = new Map<string, WorkflowConfig>();

/**
 * Register a workflow configuration
 * This is called by the setup endpoint when workflow configurations are loaded
 */
export function registerWorkflowConfig(config: WorkflowConfig): void {
  workflowRegistry.set(config.id, config);
  console.log('[workflow-routes] registered workflow config', {
    id: config.id,
    name: config.name,
    workflowFile: config.workflowFile,
  });
}

/**
 * Get all registered workflow configurations
 */
export function getWorkflowConfigs(): WorkflowConfig[] {
  return Array.from(workflowRegistry.values());
}

/**
 * GET /api/v4/workflows
 * List all available workflow configurations
 */
router.get('/workflows', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const configs = getWorkflowConfigs();
    res.json({
      workflows: configs.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        workflowFile: c.workflowFile,
        streamLogs: c.streamLogs,
        resultTemplate: c.resultTemplate,
      })),
      count: configs.length,
    });
  } catch (err: any) {
    console.error('[workflow-routes] list workflows error', { error: err?.message });
    next(err);
  }
});

/**
 * POST /api/v4/workflow-execute
 * Trigger execution of a configured workflow
 * 
 * Body:
 * {
 *   "workflowId": "azd-validation",
 *   "inputs": {
 *     "target_validate_template_url": "https://github.com/...",
 *     "customValidators": "azd-up,azd-down"
 *   },
 *   "callbackUrl": "https://...",
 *   "streamLogs": true
 * }
 */
router.post('/workflow-execute', strictRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const request: WorkflowExecutionRequest = req.body;

    // Validate required parameters
    if (!request.workflowId || typeof request.workflowId !== 'string') {
      return res.status(400).json({
        error: 'workflowId is required and must be a string',
        requestId,
      });
    }

    if (!request.inputs || typeof request.inputs !== 'object') {
      return res.status(400).json({
        error: 'inputs is required and must be an object',
        requestId,
      });
    }

    // Get workflow configuration
    const config = workflowRegistry.get(request.workflowId);
    if (!config) {
      return res.status(404).json({
        error: `Workflow configuration not found: ${request.workflowId}`,
        availableWorkflows: Array.from(workflowRegistry.keys()),
        requestId,
      });
    }

    const token = process.env.GH_WORKFLOW_TOKEN;
    if (!token) {
      return res.status(500).json({
        error: 'Server not configured (missing GH_WORKFLOW_TOKEN)',
        requestId,
      });
    }

    // Derive owner/repo from environment
    let owner = process.env.GITHUB_REPO_OWNER;
    let repo = process.env.GITHUB_REPO_NAME;

    if (!owner || !repo) {
      const slug = process.env.GITHUB_REPOSITORY || 'Template-Doctor/template-doctor';
      [owner, repo] = slug.split('/');
    }

    console.log('[workflow-routes] executing workflow', {
      requestId,
      workflowId: request.workflowId,
      workflowFile: config.workflowFile,
      owner,
      repo,
    });

    // Trigger workflow
    const result = await triggerWorkflow(config, request, token, owner, repo);

    res.json(result);
  } catch (err: any) {
    console.error('[workflow-routes] workflow-execute exception', {
      requestId,
      error: err?.message,
    });
    next(err);
  }
});

/**
 * GET /api/v4/workflow-status
 * Check status of a workflow execution
 * 
 * Query params:
 * - workflowRunId: GitHub workflow run ID (required)
 * - workflowId: Workflow configuration ID (required for parsing)
 * - workflowOrgRepo: GitHub org/repo (optional, defaults to env)
 * - streamLogs: Whether to include job logs (optional, defaults to config)
 */
router.get('/workflow-status', async (req: Request, res: Response, next: NextFunction) => {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const { workflowRunId, workflowId, workflowOrgRepo, streamLogs } = req.query;

    // Validate required parameters
    if (!workflowRunId) {
      return res.status(400).json({
        error: 'workflowRunId is required',
        requestId,
      });
    }

    if (!workflowId || typeof workflowId !== 'string') {
      return res.status(400).json({
        error: 'workflowId is required',
        requestId,
      });
    }

    const runId = parseInt(workflowRunId as string, 10);
    if (!Number.isFinite(runId)) {
      return res.status(400).json({
        error: 'workflowRunId must be numeric',
        requestId,
      });
    }

    // Get workflow configuration
    const config = workflowRegistry.get(workflowId);
    if (!config) {
      return res.status(404).json({
        error: `Workflow configuration not found: ${workflowId}`,
        requestId,
      });
    }

    // Derive owner/repo
    let owner: string;
    let repo: string;

    if (workflowOrgRepo && typeof workflowOrgRepo === 'string') {
      const parts = workflowOrgRepo.split('/');
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return res.status(400).json({
          error: 'workflowOrgRepo must be in owner/repo format',
          requestId,
        });
      }
      [owner, repo] = parts;
    } else {
      owner = process.env.GITHUB_REPO_OWNER || '';
      repo = process.env.GITHUB_REPO_NAME || '';

      if (!owner || !repo) {
        const slug = process.env.GITHUB_REPOSITORY || 'Template-Doctor/template-doctor';
        [owner, repo] = slug.split('/');
      }
    }

    const token = process.env.GH_WORKFLOW_TOKEN;
    if (!token) {
      return res.status(500).json({
        error: 'Server not configured (missing GH_WORKFLOW_TOKEN)',
        requestId,
      });
    }

    const shouldStreamLogs = streamLogs === 'true' || streamLogs === '1';

    console.log('[workflow-routes] checking workflow status', {
      requestId,
      workflowRunId: runId,
      workflowId,
      streamLogs: shouldStreamLogs,
    });

    // Get workflow status
    const status = await getWorkflowStatus(runId, config, token, owner, repo, shouldStreamLogs);

    res.json(status);
  } catch (err: any) {
    console.error('[workflow-routes] workflow-status exception', {
      requestId,
      error: err?.message,
    });
    next(err);
  }
});

/**
 * POST /api/v4/workflow-cancel
 * Cancel a running workflow
 * 
 * Body:
 * {
 *   "workflowRunId": 123456789,
 *   "workflowOrgRepo": "owner/repo"
 * }
 */
router.post('/workflow-cancel', async (req: Request, res: Response, next: NextFunction) => {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const { workflowRunId, workflowOrgRepo } = req.body;

    // Validate required parameters
    if (!workflowRunId) {
      return res.status(400).json({
        error: 'workflowRunId is required',
        requestId,
      });
    }

    const runId = typeof workflowRunId === 'string' ? parseInt(workflowRunId, 10) : workflowRunId;
    if (!Number.isFinite(runId)) {
      return res.status(400).json({
        error: 'workflowRunId must be numeric',
        requestId,
      });
    }

    // Derive owner/repo
    let owner: string;
    let repo: string;

    if (workflowOrgRepo && typeof workflowOrgRepo === 'string') {
      const parts = workflowOrgRepo.split('/');
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return res.status(400).json({
          error: 'workflowOrgRepo must be in owner/repo format',
          requestId,
        });
      }
      [owner, repo] = parts;
    } else {
      owner = process.env.GITHUB_REPO_OWNER || '';
      repo = process.env.GITHUB_REPO_NAME || '';

      if (!owner || !repo) {
        const slug = process.env.GITHUB_REPOSITORY || 'Template-Doctor/template-doctor';
        [owner, repo] = slug.split('/');
      }
    }

    const token = process.env.GH_WORKFLOW_TOKEN;
    if (!token) {
      return res.status(500).json({
        error: 'Server not configured (missing GH_WORKFLOW_TOKEN)',
        requestId,
      });
    }

    console.log('[workflow-routes] cancelling workflow', {
      requestId,
      workflowRunId: runId,
      owner,
      repo,
    });

    // Cancel workflow
    await cancelWorkflow(runId, token, owner, repo);

    res.json({
      message: 'Workflow cancelled',
      workflowRunId: runId,
      requestId,
    });
  } catch (err: any) {
    console.error('[workflow-routes] workflow-cancel exception', {
      requestId,
      error: err?.message,
    });
    next(err);
  }
});

export { router as genericWorkflowRouter };
