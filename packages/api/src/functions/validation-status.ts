import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { Octokit } from '@octokit/rest';

export async function validationStatusHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  function corsHeaders() {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
  }

  if (request.method === 'OPTIONS') {
    return { status: 204, headers: corsHeaders() };
  }

  try {
    // Try to get runId from query or cookie
    let runId = request.query.get('runId') || request.params?.runId || request.query.get('localRunId');
    
    if (!runId) {
      return {
        status: 400,
        headers: corsHeaders(),
        jsonBody: { error: "Missing required parameter: runId" }
      };
    }

    // Prefer explicit githubRunId if client provided; allow run URL and parse id from it
    let githubRunId = request.query.get('githubRunId') || null;
    let runUrl = request.query.get('githubRunUrl') || null;
    if (!githubRunId && runUrl) {
      const m = runUrl.match(/\/actions\/runs\/(\d+)/);
      if (m && m[1]) {
        githubRunId = m[1];
        context.log(`validation-status: parsed githubRunId ${githubRunId} from githubRunUrl`);
      }
    }

    // Repo targeting: prefer explicit owner/name vars if provided, then GITHUB_REPOSITORY, then default
    let owner = process.env.GITHUB_REPO_OWNER;
    let repo = process.env.GITHUB_REPO_NAME;
    let repoSource = 'env:owner-name';
    if (!owner || !repo) {
      const repoSlug = process.env.GITHUB_REPOSITORY || "Template-Doctor/template-doctor";
      [owner, repo] = repoSlug.split("/");
      repoSource = process.env.GITHUB_REPOSITORY ? 'env:repository' : 'default';
    }
    // Allow explicit override via query ONLY in local dev (Azure Functions local host sets WEBSITE_INSTANCE_ID undefined)
    const isLocal = !process.env.WEBSITE_INSTANCE_ID;
    const allowRepoOverride = isLocal || process.env.ALLOW_REPO_OVERRIDE === '1';
    if (allowRepoOverride && (request.query.get('owner') || request.query.get('repo'))) {
      owner = request.query.get('owner') || owner;
      repo = request.query.get('repo') || repo;
      repoSource = 'query-override';
      context.log(`validation-status: using owner/repo override from query (local only): ${owner}/${repo}`);
    }
    context.log(`validation-status: targeting repo ${owner}/${repo} (source: ${repoSource})`);

    const token = process.env.GH_WORKFLOW_TOKEN;
    let branch = process.env.GITHUB_REPO_BRANCH || 'main';
    // The workflow file in this repo is at .github/workflows/validation-template.yml
    let workflowFile = process.env.GITHUB_WORKFLOW_FILE || 'validation-template.yml';

    // Initialize Octokit
    const octokit = token 
      ? new Octokit({ auth: token, userAgent: 'TemplateDoctorApp' })
      : new Octokit({ userAgent: 'TemplateDoctorApp' });
    
    context.log(`validation-status: GitHub client mode: ${token ? 'authenticated' : 'unauthenticated'} (octokit)`);

    // Allow overriding branch/workflow file under the same override flag
    if (allowRepoOverride) {
      if (request.query.get('branch')) {
        branch = request.query.get('branch') as string;
      }
      if (request.query.get('workflow')) {
        workflowFile = request.query.get('workflow') as string;
      }
    }
    context.log(`validation-status: using workflow '${workflowFile}' on branch '${branch}'`);

    // If we don't have a GitHub run id, try to discover it by correlating run metadata to local runId
    if (!githubRunId) {
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
        runUrl = discoveredRun.html_url;
        context.log(`Discovered workflow run ${githubRunId} for ${owner}/${repo} and local runId ${runId}`);
      } else {
        context.log(`validation-status: no matching workflow run found for runId ${runId} after inspecting ${inspected} runs; returning pending.`);
        return {
          status: 200,
          headers: corsHeaders(),
          jsonBody: { runId, status: 'pending', conclusion: null }
        };
      }
    }

    // Fetch the workflow run details
    let ghData;
    try {
      const runResp = await octokit.actions.getWorkflowRun({ 
        owner, 
        repo, 
        run_id: Number(githubRunId) 
      });
      ghData = runResp.data;
    } catch (getErr: any) {
      // If bad credentials, provide clearer guidance especially for private repos
      if (getErr && (getErr.status === 401 || /bad credentials/i.test(getErr.message))) {
        const hint = 'Private repo access requires a valid GH_WORKFLOW_TOKEN with repo and workflow scopes (or fine-grained: Actions Read, Contents Read, Metadata Read) and SAML SSO authorization if your org enforces it.';
        context.log(`getWorkflowRun 401 for ${owner}/${repo} run ${githubRunId}. ${hint}`);
        return {
          status: 502,
          headers: corsHeaders(),
          jsonBody: {
            error: 'Bad credentials - https://docs.github.com/rest',
            type: 'github_api_error',
            errorCode: 'GITHUB_API_ERROR',
            hint,
            repo: `${owner}/${repo}`,
            repoSource,
            githubRunId,
            timestamp: new Date().toISOString(),
            ...(isLocal ? { debug: { usedAuth: !!token, overrideEnabled: allowRepoOverride, workflowFile, branch } } : {})
          }
        };
      }
      throw getErr;
    }

    // Optionally fetch ephemeral URLs to logs
    let logsArchiveUrl = undefined;
    let jobLogs = undefined;
    const wantArchive = request.query.get('includeLogsUrl') === '1' || request.query.get('includeLogsUrl') === 'true';
    const wantJobLogs = request.query.get('includeJobLogs') === '1' || request.query.get('includeJobLogs') === 'true';
    
    if (wantArchive || wantJobLogs) {
      try {
        const baseHeaders: Record<string, string> = {
          'accept': 'application/vnd.github.v3+json',
          'user-agent': 'TemplateDoctorApp'
        };
        if (token) baseHeaders['authorization'] = `token ${token}`;

        if (wantArchive) {
          // Request logs archive with manual redirect to capture the pre-signed URL
          const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs/${Number(githubRunId)}/logs`, {
            headers: baseHeaders,
            redirect: 'manual'
          });
          if (res.status === 302) {
            logsArchiveUrl = res.headers.get('location') || undefined;
          } else if (res.ok) {
            // Some environments may auto-serve the body; still expose as a dummy
            logsArchiveUrl = null;
          }
        }

        if (wantJobLogs) {
          // 1) List jobs
          const jobsResp = await octokit.actions.listJobsForWorkflowRun({ 
            owner, 
            repo, 
            run_id: Number(githubRunId), 
            per_page: 100 
          });
          const jobs = jobsResp.data.jobs || [];
          
          // 2) Build ephemeral URLs per job (manual redirect)
          jobLogs = [];
          for (const j of jobs) {
            const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/jobs/${j.id}/logs`, {
              headers: baseHeaders,
              redirect: 'manual'
            });
            const url = res.status === 302 ? (res.headers.get('location') || undefined) : undefined;
            jobLogs.push({ 
              id: j.id, 
              name: j.name, 
              status: j.status, 
              conclusion: j.conclusion, 
              startedAt: j.started_at, 
              completedAt: j.completed_at, 
              logsUrl: url 
            });
          }
        }
      } catch (logErr) {
        context.log(`validation-status: fetching logs URLs failed: ${logErr instanceof Error ? logErr.message : String(logErr)}`);
      }
    }

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: {
        runId,
        githubRunId,
        status: ghData.status,
        conclusion: ghData.conclusion,
        runUrl: runUrl || ghData.html_url,
        startTime: ghData.run_started_at,
        endTime: ghData.updated_at,
        ...(wantArchive ? { logsArchiveUrl } : {}),
        ...(wantJobLogs ? { jobLogs } : {}),
        ...(isLocal ? { debug: { repo: `${owner}/${repo}`, repoSource, usedAuth: !!token, overrideEnabled: allowRepoOverride, workflowFile, branch } } : {})
      }
    };
  } catch (err: any) {
    context.log("validation-status error:", err);
    
    // Return proper error status code instead of masking errors with 200
    const isGitHubError = err.status || (err.message && err.message.toLowerCase().includes('github'));
    
    return {
      status: isGitHubError ? 502 : 500, // 502 for GitHub API issues, 500 for other errors
      headers: corsHeaders(),
      jsonBody: { 
        error: err.message,
        type: isGitHubError ? 'github_api_error' : 'server_error',
        errorCode: isGitHubError ? 'GITHUB_API_ERROR' : 'SERVER_ERROR',
        timestamp: new Date().toISOString()
      }
    };
  }
}

// registration moved to barrel index.ts