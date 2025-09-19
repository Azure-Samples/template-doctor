const crypto = require('crypto');
const { getOSSFScore } = require('./scorecard');

module.exports = async function (context, req) {
  // Replace context.log with console.log in development mode
  if (process.env.NODE_ENV === "development") {
    context.log = console.log;
  }
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

    const { templateUrl, minScore } = req.body;

    if (!templateUrl) {
      context.res = {
        status: 400,
        body: { error: "templateUrl is required" }
      };
      return;
    }

    if (!minScore) {
      context.res = {
        status: 400,
        body: { error: "minScore is required" }
      };
      return;
    }

    const localRunId = crypto.randomUUID();

    const owner = process.env.GITHUB_REPO_OWNER || "Template-Doctor";
    const repo = process.env.GITHUB_REPO_NAME || "template-doctor";
    const workflowFile = process.env.GITHUB_WORKFLOW_FILE || "validate-ossf-score.yml";
    const workflowToken = process.env.GH_WORKFLOW_TOKEN;
    if (!workflowToken) throw new Error("Missing GH_WORKFLOW_TOKEN app setting");

    const issues = [];
    const compliance = [];

    // Set up a timeout promise that rejects after 3 minutes (180000 ms)
    const timeout = new Promise((_, reject) => {
      const timeoutId = setTimeout(() => {
        clearTimeout(timeoutId);
        reject(new Error('OSSF score check timed out after 3 minutes'));
      }, 180000);
    });

    // Always use the action-* APIs implementation
    const scorePromise = getOSSFScore(context, owner, repo, workflowFile, templateUrl, localRunId, minScore, issues, compliance);

    // Race the getOSSFScore call against the timeout
    const result = await Promise.race([
      scorePromise,
      timeout
    ]);

    // securely destructure score and runId if they are returned or set to empty string or null
    const { score = null, runId = null } = result || {};

    context.res = {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: {
        templateUrl,
        runId: localRunId,
        githubRunId: runId || null,
        githubRunUrl: runId ? `https://github.com/${owner}/${repo}/actions/runs/${runId}` : null,
        message: `${workflowFile} workflow triggered; ${localRunId} run completed`,
        details: {
          score
        },
        issues,
        compliance
      }
    };

  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("validate-template error:", err);
    } else {
      context.log.error("validate-template error:", err);
    }
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