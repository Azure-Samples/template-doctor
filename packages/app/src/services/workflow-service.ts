/**
 * Generic Workflow Execution Service
 * Provides a unified interface for executing any GitHub Actions workflow
 * via the generic workflow execution backend system.
 */

export interface WorkflowConfig {
  id: string;
  name: string;
  workflowFile: string;
  artifactCompressed?: boolean;
  streamLogs?: boolean;
  customParser?: string;
  resultTemplate?: string;
  defaultInputs?: Record<string, any>;
  timeout?: number;
  description?: string;
}

export interface WorkflowExecutionRequest {
  workflowId: string;
  inputs: Record<string, any>;
}

export interface WorkflowExecutionResponse {
  workflowRunId: string;
  status: string;
  message?: string;
}

export interface WorkflowJob {
  id: string;
  name: string;
  status: string;
  conclusion?: string;
  startedAt?: string;
  completedAt?: string;
  logsUrl?: string;
  logs?: string;
}

export interface WorkflowStatusResponse {
  workflowRunId: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out';
  jobs?: WorkflowJob[];
  logs?: string[];
  result?: any;
  runUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowCancelResponse {
  success: boolean;
  message: string;
}

const apiBase = () => (window as any).TemplateDoctorConfig?.apiBase || '/api';

function getAuthToken(): string | null {
  return localStorage.getItem('gh_access_token');
}

function buildApiUrl(path: string): string {
  return `${apiBase()}/v4${path}`;
}

async function httpJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const url = buildApiUrl(path);
  
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: response.statusText };
    }
    const error: any = new Error(
      errorData.error || `HTTP ${response.status}: ${response.statusText}`,
    );
    error.status = response.status;
    error.data = errorData;
    throw error;
  }

  return response.json();
}

export const WorkflowService = {
  /**
   * Get all workflow configurations
   */
  async getWorkflows(): Promise<{ workflows: WorkflowConfig[]; count: number }> {
    return httpJson<{ workflows: WorkflowConfig[]; count: number }>('/workflows');
  },

  /**
   * Get a specific workflow configuration
   */
  async getWorkflow(workflowId: string): Promise<WorkflowConfig | null> {
    const { workflows } = await this.getWorkflows();
    return workflows.find((w: { id: string; }) => w.id === workflowId) || null;
  },

  /**
   * Trigger a workflow execution
   */
  async executeWorkflow(
    request: WorkflowExecutionRequest,
  ): Promise<WorkflowExecutionResponse> {
    return httpJson<WorkflowExecutionResponse>('/workflow-execute', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Get workflow execution status
   */
  async getWorkflowStatus(
    workflowRunId: string,
    workflowId: string,
  ): Promise<WorkflowStatusResponse> {
    const params = new URLSearchParams({
      workflowRunId,
      workflowId,
    });
    return httpJson<WorkflowStatusResponse>(`/workflow-status?${params}`);
  },

  /**
   * Cancel a running workflow
   */
  async cancelWorkflow(workflowRunId: string): Promise<WorkflowCancelResponse> {
    return httpJson<WorkflowCancelResponse>('/workflow-cancel', {
      method: 'POST',
      body: JSON.stringify({ workflowRunId }),
    });
  },

  /**
   * Poll for workflow completion
   */
  async pollUntilComplete(
    workflowRunId: string,
    workflowId: string,
    options: {
      intervalMs?: number;
      maxAttempts?: number;
      onProgress?: (status: WorkflowStatusResponse) => void;
    } = {},
  ): Promise<WorkflowStatusResponse> {
    const { intervalMs = 10000, maxAttempts = 60, onProgress } = options;
    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;
      const status = await this.getWorkflowStatus(workflowRunId, workflowId);

      if (onProgress) {
        onProgress(status);
      }

      if (status.status === 'completed') {
        return status;
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error('Workflow polling timeout - maximum attempts reached');
  },
};

// Export for global window access (backward compatibility)
if (typeof window !== 'undefined') {
  (window as any).WorkflowService = WorkflowService;
}
