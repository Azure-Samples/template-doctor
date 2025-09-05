// Stateless cancellation of a GitHub Actions run
// Accepts githubRunId or githubRunUrl (preferred). Local runId is optional and only used for logging.
// Uses same repo targeting precedence as validation-status: GITHUB_REPO_OWNER/NAME -> GITHUB_REPOSITORY -> defaults

function resolveRepoFromEnv(query) {
  // Default repo
  let owner = process.env.GITHUB_REPO_OWNER || null;
  let repo = process.env.GITHUB_REPO_NAME || null;
  let repoSource = 'env:explicit';

  if (!owner || !repo) {
    const ghRepo = process.env.GITHUB_REPOSITORY; // format: owner/repo
    if (ghRepo && ghRepo.includes('/')) {
      const [o, r] = ghRepo.split('/');
      owner = owner || o;
      repo = repo || r;
      repoSource = 'env:GITHUB_REPOSITORY';
    }
  }

  if (!owner || !repo) {
    owner = owner || 'Template-Doctor';
    repo = repo || 'template-doctor';
    repoSource = 'default';
  }

  // Allow overrides when running locally, or when ALLOW_REPO_OVERRIDE is truthy
  const isLocal = !process.env.WEBSITE_INSTANCE_ID; // local Functions host
  const allowOverride = isLocal || /^true|1|yes$/i.test(String(process.env.ALLOW_REPO_OVERRIDE || ''));
  if (allowOverride && query) {
    if (query.owner) {
      owner = query.owner;
      repoSource = (repoSource ? repoSource + '+' : '') + 'override';
    }
    if (query.repo) {
      repo = query.repo;
      repoSource = (repoSource ? repoSource + '+' : '') + 'override';
    }
  }

  return { owner, repo, repoSource };
}

function parseRunIdFromUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    const parts = u.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('runs');
    if (idx >= 0 && parts[idx + 1]) {
      const id = parts[idx + 1];
      if (/^\d+$/.test(id)) return id;
    }
  } catch (_) {}
  return null;
}

async function githubCancelRun({ owner, repo, runId, token }) {
  const endpoint = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/cancel`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'template-doctor-functions'
    }
  });
  if (res.status === 202) return true;
  const body = await res.text().catch(() => '');
  throw new Error(`GitHub cancel failed: ${res.status} ${res.statusText} - ${body}`);
}

module.exports = async function (context, req) {
  function corsHeaders() {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
  }

  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: corsHeaders() };
    return;
  }

  const start = Date.now();
  const websiteInstanceId = process.env.WEBSITE_INSTANCE_ID || null;
  const token = process.env.GH_WORKFLOW_TOKEN || '';
  const { owner, repo, repoSource } = resolveRepoFromEnv(req.query || {});
  let branch = process.env.GITHUB_REPO_BRANCH || 'main';
  let workflowFile = process.env.GITHUB_WORKFLOW_FILE || 'validation-template.yml';

  // Allow branch/workflow override when local or explicitly enabled
  const isLocal = !process.env.WEBSITE_INSTANCE_ID; // local Functions host
  const allowOverride = isLocal || /^true|1|yes$/i.test(String(process.env.ALLOW_REPO_OVERRIDE || ''));
  if (allowOverride && req.query) {
    if (req.query.branch) branch = req.query.branch;
    if (req.query.workflow) workflowFile = req.query.workflow;
  }

  context.log('API - validation-cancel called', { repo: `${owner}/${repo}`, repoSource, isProd: !!websiteInstanceId });

  try {
    // Inputs can come from query or body
    const q = req.query || {};
    const b = req.body || {};
    const localRunId = q.runId || b.runId || q.localRunId || b.localRunId || null; // optional, for logging
    let githubRunId = q.githubRunId || b.githubRunId || null;
    const githubRunUrl = q.githubRunUrl || b.githubRunUrl || null;

    if (!githubRunId && githubRunUrl) {
      githubRunId = parseRunIdFromUrl(githubRunUrl);
    }

    // If githubRunId is missing, attempt to discover it from the local runId using stateless correlation
    if (!githubRunId) {
      if (!localRunId) {
        context.log.warn('validation-cancel missing both githubRunId and local runId; cannot discover.');
        context.res = {
          status: 400,
          headers: corsHeaders(),
          body: {
            error: 'Missing githubRunId. Provide githubRunId or githubRunUrl, or include runId so the server can try to discover the run.',
            hint: 'Best: Call /api/validation-status first to resolve githubRunId, then POST it here to cancel.'
          }
        };
        return;
      }

      context.log(`validation-cancel: attempting discovery for runId ${localRunId} in ${owner}/${repo} using workflow '${workflowFile}' on branch '${branch}'`);

      async function ghFetch(path, init = {}) {
        const url = `https://api.github.com${path}`;
        const headers = Object.assign({
          'accept': 'application/vnd.github.v3+json',
          'user-agent': 'template-doctor-functions'
        }, init.headers || {});
        if (token) headers['authorization'] = `token ${token}`;
        const res = await fetch(url, { ...init, headers });
        if (!res.ok) {
          const t = await res.text().catch(() => '');
          const err = new Error(`GitHub ${res.status} ${res.statusText}: ${t}`);
          err.status = res.status;
          throw err;
        }
        return res.json();
      }

      // Try the specific workflow first, then fall back to repo-level listing
      let discovered = null;
      try {
        const data = await ghFetch(`/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?branch=${encodeURIComponent(branch)}&event=workflow_dispatch&per_page=100`);
        const candidates = data.workflow_runs || [];
        for (const r of candidates) {
          const title = r.display_title || r.name || '';
          const commitMsg = (r.head_commit && r.head_commit.message) ? String(r.head_commit.message) : '';
          if ((title && String(title).includes(localRunId)) || commitMsg.includes(localRunId)) {
            discovered = r;
            break;
          }
        }
      } catch (wfErr) {
        // Log and continue to fallback
        context.log.warn(`validation-cancel: workflow runs list failed: ${wfErr.message}`);
      }
      if (!discovered) {
        try {
          const data = await ghFetch(`/repos/${owner}/${repo}/actions/runs?per_page=100&branch=${encodeURIComponent(branch)}&event=workflow_dispatch`);
          const candidates = data.workflow_runs || [];
          for (const r of candidates) {
            const title = r.display_title || r.name || '';
            const commitMsg = (r.head_commit && r.head_commit.message) ? String(r.head_commit.message) : '';
            if ((title && String(title).includes(localRunId)) || commitMsg.includes(localRunId)) {
              discovered = r;
              break;
            }
          }
        } catch (repoErr) {
          context.log.warn(`validation-cancel: repo runs list failed: ${repoErr.message}`);
        }
      }

      if (discovered && discovered.id) {
        githubRunId = discovered.id;
        context.log(`validation-cancel: discovered githubRunId ${githubRunId} for local runId ${localRunId}`);
      } else {
        context.res = {
          status: 400,
          headers: corsHeaders(),
          body: {
            error: 'Missing githubRunId and could not discover run from runId',
            hint: 'Wait a few seconds for the run to appear, call /api/validation-status to resolve githubRunId, then retry cancellation.',
            debug: isLocal ? { owner, repo, branch, workflowFile, localRunId } : undefined
          }
        };
        return;
      }
    }

    if (!token) {
      context.res = {
        status: 401,
        headers: corsHeaders(),
        body: {
          error: 'Missing GH_WORKFLOW_TOKEN for GitHub API authentication',
          hint: 'Set GH_WORKFLOW_TOKEN with workflow:write scope and ensure SSO is authorized for the org if required.'
        }
      };
      return;
    }

    context.log(`Cancelling GitHub workflow run ${githubRunId} in ${owner}/${repo}...`, { localRunId });
    await githubCancelRun({ owner, repo, runId: githubRunId, token });

    context.res = {
      status: 200,
      headers: corsHeaders(),
      body: {
        message: `Workflow run ${githubRunId} cancellation requested (202 Accepted).`,
        githubRunId,
        runUrl: `https://github.com/${owner}/${repo}/actions/runs/${githubRunId}`,
        localRunId,
        repo: `${owner}/${repo}`,
        durationMs: Date.now() - start
      }
    };
  } catch (err) {
    context.log.error('validation-cancel error', err);
    const status = /401|403/.test(String(err.message)) ? 401 : 500;
    context.res = {
      status,
      headers: corsHeaders(),
      body: {
        error: err.message,
        suggestion: status === 401 ? 'Verify GH_WORKFLOW_TOKEN, scopes (workflow), and SSO organization authorization.' : undefined
      }
    };
  }
};
