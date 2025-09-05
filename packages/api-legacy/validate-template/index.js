const crypto = require('crypto');
const { Octokit } = require('@octokit/rest');

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    };
    return;
  }

  try {
    const { targetRepoUrl, templateUrl, callbackUrl } = req.body || {};
    const repoUrl = targetRepoUrl || templateUrl;

    if (!repoUrl) {
      context.res = { 
        status: 400, 
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: { error: "targetRepoUrl or templateUrl is required" } 
      };
      return;
    }

    // Our local run ID (not the GitHub one)
    const localRunId = crypto.randomUUID();

  const owner = process.env.GITHUB_REPO_OWNER || "Template-Doctor";
  const repo = process.env.GITHUB_REPO_NAME || "template-doctor";
  const workflowFile = "validation-template.yml";
    const token = process.env.GH_WORKFLOW_TOKEN;
    if (!token) throw new Error("Missing GH_WORKFLOW_TOKEN app setting");

    const ghUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`;

    const payload = {
      ref: process.env.GITHUB_REPO_BRANCH || "main",
      inputs: {
        target_validate_template_url: repoUrl,
        callback_url: callbackUrl || "",
        // IMPORTANT: use the input name expected by the workflow YAML
        run_id: localRunId,
        customValidators: "azd-up,azd-down"
      }
    };

    const dispatchRes = await fetch(ghUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!dispatchRes.ok) {
      const errText = await dispatchRes.text();
      throw new Error(`GitHub dispatch failed: ${dispatchRes.status} ${dispatchRes.statusText} - ${errText}`);
    }

  // Try to discover the GitHub run_id quickly so the client can link directly.
  const branch = process.env.GITHUB_REPO_BRANCH || 'main';

    const octokit = new Octokit({ auth: token, userAgent: 'TemplateDoctorApp' });

    let githubRunId = null;
    let githubRunUrl = null;

    // Poll a few times for the run to appear (workflow_dispatch may take a moment)
    const maxAttempts = 10; // up to ~10-20 seconds total depending on delay
    const delayMs = 1500;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const runsResp = await octokit.actions.listWorkflowRuns({ owner, repo, workflow_id: workflowFile, branch, event: 'workflow_dispatch', per_page: 25 });
        const candidates = runsResp.data.workflow_runs || [];
        const found = candidates.find(r => {
          const title = r.display_title || r.name || '';
          const commitMsg = (r.head_commit && r.head_commit.message) ? String(r.head_commit.message) : '';
          return (title && String(title).includes(localRunId)) || commitMsg.includes(localRunId);
        });
        if (found) {
          githubRunId = found.id;
          githubRunUrl = found.html_url;
          break;
        }
      } catch (e) {
        context.log.warn(`Run discovery attempt ${attempt} failed: ${e.message}`);
      }
      // wait before next attempt
      await new Promise(res => setTimeout(res, delayMs));
    }

    context.res = {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: {
        runId: localRunId,
        githubRunId: githubRunId || null,
        githubRunUrl: githubRunUrl || null,
        message: githubRunId ? "Workflow triggered successfully" : "Workflow triggered; run discovery in progress"
      }
    };
  } catch (err) {
    context.log.error("validate-template error:", err);
    const isGitHubError = err.message && err.message.includes('GitHub dispatch failed');
    context.res = { 
      status: isGitHubError ? 502 : 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: { 
        error: err.message,
        type: isGitHubError ? 'github_api_error' : 'server_error',
        details: isGitHubError ? 'Error communicating with GitHub API' : 'Internal server error',
        timestamp: new Date().toISOString()
      } 
    };
  }
};
