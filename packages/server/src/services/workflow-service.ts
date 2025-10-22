/**
 * Generic Workflow Execution Service
 * 
 * Provides a unified interface for triggering, monitoring, and processing
 * results from any GitHub Actions workflow.
 */

import AdmZip from 'adm-zip';
import crypto from 'crypto';
import {
  WorkflowConfig,
  WorkflowExecutionRequest,
  WorkflowExecutionResponse,
  WorkflowStatusResponse,
  WorkflowJob,
  WorkflowJobLog,
} from '../types/workflow.js';
import { getParser } from './workflow-parser-registry.js';

/**
 * Trigger a generic workflow execution
 */
export async function triggerWorkflow(
  config: WorkflowConfig,
  request: WorkflowExecutionRequest,
  token: string,
  owner?: string,
  repo?: string,
): Promise<WorkflowExecutionResponse> {
  // Generate unique run ID
  const runId = crypto.randomUUID();

  // Derive owner/repo from environment if not provided
  if (!owner || !repo) {
    const slug = process.env.GITHUB_REPOSITORY || 'Template-Doctor/template-doctor';
    [owner, repo] = slug.split('/');
  }

  const branch = process.env.GITHUB_REPO_BRANCH || 'main';

  // Merge default inputs with request inputs
  const inputs = {
    ...config.defaultInputs,
    ...request.inputs,
    run_id: runId,
    callback_url: request.callbackUrl || '',
  };

  // Construct GitHub API URL
  const ghUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(config.workflowFile)}/dispatches`;

  // Prepare workflow dispatch payload
  const payload = {
    ref: branch,
    inputs,
  };

  console.log('[workflow-service] triggering workflow', {
    workflowId: config.id,
    workflowFile: config.workflowFile,
    runId,
    ghUrl,
  });

  // Trigger workflow dispatch
  const response = await fetch(ghUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[workflow-service] dispatch failed', {
      status: response.status,
      text,
    });

    throw new Error(`GitHub dispatch failed: ${response.status} ${response.statusText}`);
  }

  // Wait for GitHub to create the run
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Try to get the workflow run ID
  let workflowRunId: number | null = null;
  let githubRunUrl: string | null = null;

  try {
    const runsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(config.workflowFile)}/runs?per_page=10`;
    const runsResponse = await fetch(runsUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (runsResponse.ok) {
      const runsData = await runsResponse.json();
      const recentRun = runsData.workflow_runs?.[0];
      if (recentRun) {
        workflowRunId = recentRun.id;
        githubRunUrl = recentRun.html_url;
        console.log('[workflow-service] found workflow run', {
          workflowRunId,
          githubRunUrl,
        });
      }
    }
  } catch (err) {
    console.error('[workflow-service] failed to get workflow run ID', { error: err });
    // Non-fatal, continue without workflow run ID
  }

  return {
    runId,
    workflowRunId,
    githubRunUrl,
    workflowOrgRepo: `${owner}/${repo}`,
    config,
    requestId: `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

/**
 * Get workflow execution status with optional logs and parsed results
 */
export async function getWorkflowStatus(
  workflowRunId: number,
  config: WorkflowConfig,
  token: string,
  owner: string,
  repo: string,
  streamLogs?: boolean,
): Promise<WorkflowStatusResponse> {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Fetch workflow run status
  const ghUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${workflowRunId}`;

  console.log('[workflow-service] checking status', {
    requestId,
    ghUrl,
    workflowRunId,
  });

  const response = await fetch(ghUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Fetch jobs for detailed error information
  let jobs: WorkflowJob[] = [];
  let failedJobs: WorkflowJob[] = [];
  let errorSummary = '';

  try {
    const jobsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${workflowRunId}/jobs`;
    const jobsResponse = await fetch(jobsUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (jobsResponse.ok) {
      const jobsData = await jobsResponse.json();
      jobs = (jobsData.jobs || []).map((job: any) => ({
        id: job.id,
        name: job.name,
        status: job.status,
        conclusion: job.conclusion,
        html_url: job.html_url,
        started_at: job.started_at,
        completed_at: job.completed_at,
      }));

      failedJobs = jobs.filter((job) => job.conclusion === 'failure').map((job: any) => {
        const originalJob = jobsData.jobs.find((j: any) => j.id === job.id);
        return {
          ...job,
          failedSteps: (originalJob?.steps || [])
            .filter((step: any) => step.conclusion === 'failure')
            .map((step: any) => ({
              name: step.name,
              conclusion: step.conclusion,
              number: step.number,
            })),
        };
      });

      // Build error summary
      if (failedJobs.length > 0) {
        const errorLines: string[] = [];
        failedJobs.forEach((job) => {
          errorLines.push(`Job: ${job.name} - ${job.conclusion}`);
          job.failedSteps?.forEach((step) => {
            errorLines.push(`  Step: ${step.name} - Failed`);
          });
        });
        errorSummary = errorLines.join('\n');
      }
    }
  } catch (err) {
    console.error('[workflow-service] failed to fetch jobs', {
      requestId,
      error: err,
    });
  }

  // Fetch job logs if requested
  let logs: WorkflowJobLog[] | undefined;
  const shouldStreamLogs = streamLogs ?? config.streamLogs;

  if (shouldStreamLogs && jobs.length > 0) {
    logs = await fetchJobLogs(owner, repo, jobs, token);
  }

  // Fetch and parse artifact if workflow completed
  let result: any;
  if (data.status === 'completed') {
    const artifactContent = await downloadArtifact(
      owner,
      repo,
      workflowRunId,
      token,
      config.artifactNamePattern,
      config.artifactCompressed,
    );

    if (artifactContent) {
      const parser = getParser(config.customParser, getFileExtension(artifactContent.filename));
      result = parser(artifactContent.content, config);
      console.log('[workflow-service] parsed artifact', {
        requestId,
        workflowId: config.id,
        parser: config.customParser || 'auto-detected',
      });
    }
  }

  return {
    status: data.status,
    conclusion: data.conclusion,
    html_url: data.html_url,
    created_at: data.created_at,
    updated_at: data.updated_at,
    jobs,
    failedJobs,
    errorSummary,
    result,
    logs,
    requestId,
  };
}

/**
 * Cancel a running workflow
 */
export async function cancelWorkflow(
  workflowRunId: number,
  token: string,
  owner: string,
  repo: string,
): Promise<void> {
  const ghUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${workflowRunId}/cancel`;

  console.log('[workflow-service] cancelling workflow', {
    ghUrl,
    workflowRunId,
  });

  const response = await fetch(ghUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API failed: ${response.status} ${response.statusText}`);
  }
}

/**
 * Download and extract workflow artifact
 */
async function downloadArtifact(
  owner: string,
  repo: string,
  runId: number,
  token: string,
  namePattern?: string,
  isCompressed = true,
): Promise<{ filename: string; content: string } | null> {
  try {
    // Fetch artifacts list
    const artifactsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`;
    const artifactsResponse = await fetch(artifactsUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!artifactsResponse.ok) {
      console.error('[workflow-service] fetch artifacts failed', {
        status: artifactsResponse.status,
        runId,
      });
      return null;
    }

    const artifactsData = await artifactsResponse.json();
    
    // Find artifact matching pattern
    let artifact = artifactsData.artifacts?.[0]; // Default to first artifact
    
    if (namePattern) {
      const pattern = new RegExp(namePattern.replace('*', '.*'));
      artifact = artifactsData.artifacts?.find((a: any) => pattern.test(a.name));
    }

    if (!artifact) {
      return null;
    }

    // Download artifact
    const downloadUrl = `https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${artifact.id}/zip`;
    const downloadResponse = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!downloadResponse.ok) {
      console.error('[workflow-service] artifact download failed', {
        status: downloadResponse.status,
        artifactId: artifact.id,
      });
      return null;
    }

    const buffer = Buffer.from(await downloadResponse.arrayBuffer());

    // Check if content is actually compressed
    const isActuallyCompressed = isCompressed || isZipFile(buffer);

    if (isActuallyCompressed) {
      // Extract from ZIP
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries();

      const resultEntry =
        entries.find((e) => !e.isDirectory && (e.entryName.endsWith('.md') || e.entryName.endsWith('.log'))) ||
        entries.find((e) => !e.isDirectory && e.entryName.endsWith('.json')) ||
        entries.find((e) => !e.isDirectory);

      if (!resultEntry) {
        console.error('[workflow-service] no result file in artifact ZIP', {
          artifactId: artifact.id,
          entries: entries.map((e) => e.entryName),
        });
        return null;
      }

      return {
        filename: resultEntry.entryName,
        content: resultEntry.getData().toString('utf8'),
      };
    } else {
      // Not compressed, return as-is
      return {
        filename: artifact.name,
        content: buffer.toString('utf8'),
      };
    }
  } catch (error) {
    console.error('[workflow-service] artifact processing error', {
      error,
      runId,
    });
    return null;
  }
}

/**
 * Fetch logs for all jobs
 */
async function fetchJobLogs(
  owner: string,
  repo: string,
  jobs: WorkflowJob[],
  token: string,
): Promise<WorkflowJobLog[]> {
  const logs: WorkflowJobLog[] = [];

  for (const job of jobs) {
    try {
      const logUrl = `https://api.github.com/repos/${owner}/${repo}/actions/jobs/${job.id}/logs`;
      const logResponse = await fetch(logUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (logResponse.ok) {
        const logText = await logResponse.text();
        logs.push({
          jobId: job.id,
          jobName: job.name,
          log: logText,
          downloadUrl: logUrl,
        });
      }
    } catch (err) {
      console.error('[workflow-service] failed to fetch job log', {
        jobId: job.id,
        error: err,
      });
    }
  }

  return logs;
}

/**
 * Check if buffer is a ZIP file
 */
function isZipFile(buffer: Buffer): boolean {
  // ZIP files start with 'PK' (0x50 0x4B)
  return buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4B;
}

/**
 * Get file extension from filename or content
 */
function getFileExtension(filename: string): string {
  const match = filename.match(/\.([^.]+)$/);
  return match ? match[0] : '';
}
