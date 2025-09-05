// Octokit is ESM-only; use dynamic import inside the async handler to work in CommonJS

module.exports = async function (context, req) {
  function corsHeaders() {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
  }

  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: corsHeaders() };
    return;
  }

  try {
    // Try to get runId from query or cookie
    let runId = req.query.runId || req.params?.runId || req.query.localRunId;
    // TODO(route-cleanup): If we decide to use path params, change the route to
    // validation-status/{runId} in function.json and rely solely on bindingData/params
    // for runId instead of query fallbacks. Cookie-based fallback removed per no-cookie policy.
    if (!runId) {
      context.res = {
        status: 400,
        headers: corsHeaders(),
        body: { error: "Missing required parameter: runId" }
      };
      return;
    }

    // Prefer explicit githubRunId if client provided; allow run URL and parse id from it
    let githubRunId = req.query.githubRunId || null;
    let runUrl = req.query.githubRunUrl || null;
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
    if (allowRepoOverride && (req.query.owner || req.query.repo)) {
      owner = req.query.owner || owner;
      repo = req.query.repo || repo;
      repoSource = 'query-override';
      context.log(`validation-status: using owner/repo override from query (local only): ${owner}/${repo}`);
    }
    context.log(`validation-status: targeting repo ${owner}/${repo} (source: ${repoSource})`);

    const token = process.env.GH_WORKFLOW_TOKEN;
  let branch = process.env.GITHUB_REPO_BRANCH || 'main';
  // The workflow file in this repo is at .github/workflows/validation-template.yml
  let workflowFile = process.env.GITHUB_WORKFLOW_FILE || 'validation-template.yml';

    // Build Octokit if available; otherwise fall back to fetch-based GitHub API calls
    let octokit = null;
    try {
      const { Octokit } = await import('@octokit/rest');
      const buildOctokit = (useAuth) => useAuth && token
        ? new Octokit({ auth: token, userAgent: 'TemplateDoctorApp' })
        : new Octokit({ userAgent: 'TemplateDoctorApp' });
      octokit = buildOctokit(!!token);
      context.log(`validation-status: GitHub client mode: ${token ? 'authenticated' : 'unauthenticated'} (octokit)`);
    } catch (e) {
      context.log.warn(`validation-status: @octokit/rest not available, using fetch fallback. ${e && e.message ? e.message : e}`);
    }

    async function ghFetch(path, init = {}) {
      const url = `https://api.github.com${path}`;
      const headers = Object.assign({
        'accept': 'application/vnd.github.v3+json',
        'user-agent': 'TemplateDoctorApp'
      }, init.headers || {});
      if (token) headers['authorization'] = `token ${token}`;
      const res = await fetch(url, { ...init, headers });
      if (!res.ok) {
        const t = await res.text();
        const err = new Error(`GitHub ${res.status} ${res.statusText}: ${t}`);
        err.status = res.status;
        throw err;
      }
      return res.json();
    }
    // Allow overriding branch/workflow file under the same override flag
    if (allowRepoOverride) {
      if (req.query.branch) {
        branch = req.query.branch;
      }
      if (req.query.workflow) {
        workflowFile = req.query.workflow;
      }
    }
    context.log(`validation-status: using workflow '${workflowFile}' on branch '${branch}'`);

    // If we don't have a GitHub run id, try to discover it by correlating run metadata to local runId
    if (!githubRunId) {
  let discoveredRun = null;
  let inspected = 0;

      async function tryDiscover(currentOctokit) {
        // Try listing runs for the specific workflow first
        try {
          let candidates = [];
          if (currentOctokit) {
            const runsResp = await currentOctokit.actions.listWorkflowRuns({ owner, repo, workflow_id: workflowFile, branch, event: 'workflow_dispatch', per_page: 100 });
            candidates = runsResp.data.workflow_runs || [];
          } else {
            const data = await ghFetch(`/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?branch=${encodeURIComponent(branch)}&event=workflow_dispatch&per_page=100`);
            candidates = data.workflow_runs || [];
          }
          inspected += candidates.length;
          for (const r of candidates) {
            const title = r.display_title || r.name || '';
            const commitMsg = (r.head_commit && r.head_commit.message) ? String(r.head_commit.message) : '';
            if ((title && String(title).includes(runId)) || commitMsg.includes(runId)) {
              return r;
            }
          }
        } catch (wfErr) {
          // If 401, signal to fallback to unauth
          if (wfErr && (wfErr.status === 401 || /bad credentials/i.test(wfErr.message))) {
            context.log.warn(`listWorkflowRuns failed for ${workflowFile} with 401; will retry unauthenticated.`);
            throw Object.assign(new Error('retry-unauth'), { code: 'RETRY_UNAUTH' });
          }
          context.log.warn(`listWorkflowRuns failed for ${workflowFile}: ${wfErr.message}`);
        }

        // Fallback: list runs for the repo
        try {
          let candidates = [];
          if (currentOctokit) {
            const repoRuns = await currentOctokit.actions.listWorkflowRunsForRepo({ owner, repo, per_page: 100, branch, event: 'workflow_dispatch' });
            candidates = repoRuns.data.workflow_runs || [];
          } else {
            const data = await ghFetch(`/repos/${owner}/${repo}/actions/runs?per_page=100&branch=${encodeURIComponent(branch)}&event=workflow_dispatch`);
            candidates = data.workflow_runs || [];
          }
          inspected += candidates.length;
          for (const r of candidates) {
            const title = r.display_title || r.name || '';
            const commitMsg = (r.head_commit && r.head_commit.message) ? String(r.head_commit.message) : '';
            if ((title && String(title).includes(runId)) || commitMsg.includes(runId)) {
              return r;
            }
          }
        } catch (repoErr) {
          if (repoErr && (repoErr.status === 401 || /bad credentials/i.test(repoErr.message))) {
            context.log.warn(`listWorkflowRunsForRepo failed with 401; will retry unauthenticated.`);
            throw Object.assign(new Error('retry-unauth'), { code: 'RETRY_UNAUTH' });
          }
          context.log.warn(`listWorkflowRunsForRepo failed: ${repoErr.message}`);
        }
        return null;
      }

      try {
        discoveredRun = await tryDiscover(octokit);
      } catch (e) {
        if (e && e.code === 'RETRY_UNAUTH') {
          // Rebuild client without auth and retry once
          context.log.warn('Falling back to unauthenticated GitHub API client due to bad credentials.');
          const unauthOctokit = buildOctokit(false);
          discoveredRun = await tryDiscover(unauthOctokit);
        } else {
          throw e;
        }
      }

      if (discoveredRun) {
        githubRunId = discoveredRun.id;
        runUrl = discoveredRun.html_url;
        context.log(`Discovered workflow run ${githubRunId} for ${owner}/${repo} and local runId ${runId}`);
      } else {
        context.log(`validation-status: no matching workflow run found for runId ${runId} after inspecting ${inspected} runs; returning pending.`);
        context.res = {
          status: 200,
          headers: corsHeaders(),
          body: { runId, status: 'pending', conclusion: null }
        };
        return;
      }
    }

    // Fetch the workflow run details
    let ghData;
    try {
      if (octokit) {
        const runResp = await octokit.actions.getWorkflowRun({ owner, repo, run_id: Number(githubRunId) });
        ghData = runResp.data;
      } else {
        ghData = await ghFetch(`/repos/${owner}/${repo}/actions/runs/${Number(githubRunId)}`);
      }
    } catch (getErr) {
      // If bad credentials, provide clearer guidance especially for private repos
      if (getErr && (getErr.status === 401 || /bad credentials/i.test(getErr.message))) {
        const hint = 'Private repo access requires a valid GH_WORKFLOW_TOKEN with repo and workflow scopes (or fine-grained: Actions Read, Contents Read, Metadata Read) and SAML SSO authorization if your org enforces it.';
        context.log.warn(`getWorkflowRun 401 for ${owner}/${repo} run ${githubRunId}. ${hint}`);
        context.res = {
          status: 502,
          headers: corsHeaders(),
          body: {
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
        return;
      }
      throw getErr;
    }

    // Optionally fetch ephemeral URLs to logs
    let logsArchiveUrl = undefined;
    let jobLogs = undefined;
    const wantArchive = req.query.includeLogsUrl === '1' || req.query.includeLogsUrl === 'true';
    const wantJobLogs = req.query.includeJobLogs === '1' || req.query.includeJobLogs === 'true';
    if (wantArchive || wantJobLogs) {
      try {
        const baseHeaders = {
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
          let jobsData;
          if (octokit) {
            const jobsResp = await octokit.actions.listJobsForWorkflowRun({ owner, repo, run_id: Number(githubRunId), per_page: 100 });
            jobsData = jobsResp.data;
          } else {
            jobsData = await ghFetch(`/repos/${owner}/${repo}/actions/runs/${Number(githubRunId)}/jobs?per_page=100`);
          }
          const jobs = jobsData.jobs || [];
          // 2) Build ephemeral URLs per job (manual redirect)
          jobLogs = [];
          for (const j of jobs) {
            const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/jobs/${j.id}/logs`, {
              headers: baseHeaders,
              redirect: 'manual'
            });
            const url = res.status === 302 ? (res.headers.get('location') || undefined) : undefined;
            jobLogs.push({ id: j.id, name: j.name, status: j.status, conclusion: j.conclusion, startedAt: j.started_at, completedAt: j.completed_at, logsUrl: url });
          }
        }
      } catch (logErr) {
        context.log.warn(`validation-status: fetching logs URLs failed: ${logErr.message}`);
      }
    }

    context.res = {
      status: 200,
      headers: corsHeaders(),
      body: {
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
  } catch (err) {
    context.log.error("validation-status error:", err);
    
    // Return proper error status code instead of masking errors with 200
    const isGitHubError = err.status || (err.message && err.message.toLowerCase().includes('github'));
    
    context.res = {
      status: isGitHubError ? 502 : 500, // 502 for GitHub API issues, 500 for other errors
      headers: corsHeaders(),
      body: { 
        error: err.message,
        type: isGitHubError ? 'github_api_error' : 'server_error',
        errorCode: isGitHubError ? 'GITHUB_API_ERROR' : 'SERVER_ERROR',
        timestamp: new Date().toISOString()
      }
    };
  }
};
