/**
 * Generic Workflow Execution System - Type Definitions
 * 
 * This module defines the types for a generic workflow execution system
 * that can trigger, monitor, and process results from any GitHub Actions workflow.
 */

/**
 * Workflow configuration loaded from setup endpoint
 */
export interface WorkflowConfig {
  /** Unique identifier for this workflow type */
  id: string;
  
  /** Display name for UI */
  name: string;
  
  /** GitHub workflow filename (e.g., 'validation-template.yml') */
  workflowFile: string;
  
  /** Description of what this workflow does */
  description?: string;
  
  /** Whether artifacts are compressed (zip) */
  artifactCompressed: boolean;
  
  /** Expected artifact name pattern (supports wildcards) */
  artifactNamePattern?: string;
  
  /** Whether to stream job logs in real-time */
  streamLogs: boolean;
  
  /** Custom parser function name (optional, defaults to built-in parsers) */
  customParser?: string;
  
  /** Path to result HTML template (optional) */
  resultTemplate?: string;
  
  /** Default inputs for workflow dispatch */
  defaultInputs?: Record<string, string>;
  
  /** Timeout in milliseconds (default: 300000 = 5 minutes) */
  timeout?: number;
}

/**
 * Workflow execution request
 */
export interface WorkflowExecutionRequest {
  /** Workflow type ID from configuration */
  workflowId: string;
  
  /** Workflow inputs (merged with defaultInputs from config) */
  inputs: Record<string, string>;
  
  /** Optional callback URL for workflow completion notification */
  callbackUrl?: string;
  
  /** Whether to stream logs (overrides config) */
  streamLogs?: boolean;
}

/**
 * Workflow execution response
 */
export interface WorkflowExecutionResponse {
  /** Internal run ID (UUID) */
  runId: string;
  
  /** GitHub workflow run ID (numeric) */
  workflowRunId: number | null;
  
  /** GitHub workflow run URL */
  githubRunUrl: string | null;
  
  /** Workflow org/repo */
  workflowOrgRepo: string;
  
  /** Workflow configuration used */
  config: WorkflowConfig;
  
  /** Request ID for debugging */
  requestId: string;
}

/**
 * Workflow status response
 */
export interface WorkflowStatusResponse {
  /** Workflow status (queued, in_progress, completed) */
  status: string;
  
  /** Workflow conclusion (success, failure, cancelled, etc.) */
  conclusion: string | null;
  
  /** GitHub workflow run URL */
  html_url: string;
  
  /** Creation timestamp */
  created_at: string;
  
  /** Last update timestamp */
  updated_at: string;
  
  /** Job details */
  jobs: WorkflowJob[];
  
  /** Failed jobs with details */
  failedJobs: WorkflowJob[];
  
  /** Error summary from failed jobs */
  errorSummary: string;
  
  /** Parsed artifact result (if workflow completed and parser available) */
  result?: any;
  
  /** Job logs (if streamLogs enabled) */
  logs?: WorkflowJobLog[];
  
  /** Request ID for debugging */
  requestId: string;
}

/**
 * Workflow job information
 */
export interface WorkflowJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  started_at: string | null;
  completed_at: string | null;
  failedSteps?: WorkflowJobStep[];
}

/**
 * Workflow job step
 */
export interface WorkflowJobStep {
  name: string;
  conclusion: string | null;
  number: number;
}

/**
 * Workflow job log
 */
export interface WorkflowJobLog {
  jobId: number;
  jobName: string;
  log: string;
  downloadUrl: string;
}

/**
 * Artifact parser function signature
 */
export type ArtifactParser = (content: string, config: WorkflowConfig) => any;

/**
 * Parser registry entry
 */
export interface ParserRegistryEntry {
  name: string;
  parser: ArtifactParser;
  description?: string;
}
