import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { Octokit } from '@octokit/rest';

export async function validationCancelHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  function corsHeaders() {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
  }

  if (request.method === 'OPTIONS') {
    return { status: 204, headers: corsHeaders() };
  }

  try {
    if (request.method !== 'POST') {
      return {
        status: 405,
        headers: corsHeaders(),
        jsonBody: { error: 'Method not allowed' }
      };
    }

    const requestBody = await request.json() as {
      runId?: string;
      githubRunId?: string;
    };

    // Check for required parameters
    if (!requestBody.runId && !requestBody.githubRunId) {
      return {
        status: 400,
        headers: corsHeaders(),
        jsonBody: { error: 'Missing required parameter: runId or githubRunId' }
      };
    }

    let runId = requestBody.runId;
    let githubRunId = requestBody.githubRunId;

    // Repo targeting: prefer explicit owner/name vars if provided, then GITHUB_REPOSITORY, then default
    let owner = process.env.GITHUB_REPO_OWNER;
    let repo = process.env.GITHUB_REPO_NAME;
    let repoSource = 'env:owner-name';
    if (!owner || !repo) {
      const repoSlug = process.env.GITHUB_REPOSITORY || "Template-Doctor/template-doctor";
      [owner, repo] = repoSlug.split("/");
      repoSource = process.env.GITHUB_REPOSITORY ? 'env:repository' : 'default';
    }

    // The isLocal and allowRepoOverride logic is unused here since we don't support
    // query params in POST body, but keeping it for consistency with other functions
    const isLocal = !process.env.WEBSITE_INSTANCE_ID;
    const allowRepoOverride = isLocal || process.env.ALLOW_REPO_OVERRIDE === '1';

    context.log(`validation-cancel: targeting repo ${owner}/${repo} (source: ${repoSource})`);

    const token = process.env.GH_WORKFLOW_TOKEN;
    let branch = process.env.GITHUB_REPO_BRANCH || 'main';
    // The workflow file in this repo is at .github/workflows/validation-template.yml
    let workflowFile = process.env.GITHUB_WORKFLOW_FILE || 'validation-template.yml';

    // Initialize Octokit
    if (!token) {
      return {
        status: 500,
        headers: corsHeaders(),
        jsonBody: { error: 'GitHub token not configured' }
      };
    }

    const octokit = new Octokit({ auth: token, userAgent: 'TemplateDoctorApp' });
    
    context.log(`validation-cancel: GitHub client mode: authenticated (octokit)`);
    context.log(`validation-cancel: using workflow '${workflowFile}' on branch '${branch}'`);

    // If we don't have a GitHub run id, try to discover it by correlating run metadata to local runId
    if (!githubRunId && runId) {
      let discoveredRun = null;
      let inspected = 0;

      // Try listing runs for the specific workflow first
      try {
        const runsResp = await octokit.actions.listWorkflowRuns({ 
          owner, 
          repo, 
          workflow_id: workflowFile, 
          branch, 
          event: 'workflow_dispatch', 
          per_page: 100 
        });
        const candidates = runsResp.data.workflow_runs || [];
        
        inspected += candidates.length;
        for (const r of candidates) {
          const title = r.display_title || r.name || '';
          const commitMsg = (r.head_commit && r.head_commit.message) ? String(r.head_commit.message) : '';
          if ((title && String(title).includes(runId)) || commitMsg.includes(runId)) {
            discoveredRun = r;
            break;
          }
        }

        // Fallback: list runs for the repo if workflow-specific search fails
        if (!discoveredRun) {
          const repoRuns = await octokit.actions.listWorkflowRunsForRepo({ 
            owner, 
            repo, 
            per_page: 100, 
            branch, 
            event: 'workflow_dispatch' 
          });
          const repoCandidates = repoRuns.data.workflow_runs || [];
          
          inspected += repoCandidates.length;
          for (const r of repoCandidates) {
            const title = r.display_title || r.name || '';
            const commitMsg = (r.head_commit && r.head_commit.message) ? String(r.head_commit.message) : '';
            if ((title && String(title).includes(runId)) || commitMsg.includes(runId)) {
              discoveredRun = r;
              break;
            }
          }
        }
      } catch (err) {
        context.log(`Error searching for workflow runs: ${err instanceof Error ? err.message : String(err)}`);
      }

      if (discoveredRun) {
        githubRunId = String(discoveredRun.id);
        context.log(`Discovered workflow run ${githubRunId} for ${owner}/${repo} and local runId ${runId}`);
      } else {
        context.log(`validation-cancel: no matching workflow run found for runId ${runId} after inspecting ${inspected} runs; returning failure.`);
        return {
          status: 404,
          headers: corsHeaders(),
          jsonBody: { 
            error: 'Run not found',
            runId,
            message: `No matching workflow run found for runId ${runId}`
          }
        };
      }
    }

    // Cancel the workflow run
    try {
      await octokit.actions.cancelWorkflowRun({
        owner,
        repo,
        run_id: Number(githubRunId)
      });

      return {
        status: 200,
        headers: corsHeaders(),
        jsonBody: {
          success: true,
          message: `Workflow run ${githubRunId} has been cancelled`,
          runId,
          githubRunId
        }
      };
    } catch (err: any) {
      // Handle specific error cases
      if (err.status === 403) {
        return {
          status: 403,
          headers: corsHeaders(),
          jsonBody: { 
            error: 'Permission denied',
            message: 'Not allowed to cancel this workflow run',
            runId,
            githubRunId
          }
        };
      }
      
      if (err.status === 404) {
        return {
          status: 404,
          headers: corsHeaders(),
          jsonBody: { 
            error: 'Run not found',
            message: `Workflow run ${githubRunId} not found`,
            runId,
            githubRunId
          }
        };
      }
      
      if (err.status === 410) {
        return {
          status: 410,
          headers: corsHeaders(),
          jsonBody: { 
            error: 'Run not cancellable',
            message: `Workflow run ${githubRunId} is no longer running and cannot be cancelled`,
            runId,
            githubRunId
          }
        };
      }
      
      // Generic error handling
      context.log(`Error cancelling workflow run: ${err.message}`);
      return {
        status: 500,
        headers: corsHeaders(),
        jsonBody: { 
          error: 'Failed to cancel workflow run',
          message: err.message,
          runId,
          githubRunId
        }
      };
    }
  } catch (err: any) {
    context.log(`Unhandled error in validation-cancel: ${err.message}`);
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { error: 'Internal server error', message: err.message }
    };
  }
}

// Register the function with Azure Functions
app.http('validation-cancel', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'api/v4/validation-cancel',
  handler: validationCancelHandler
});