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
    const workflowUrl = `https://github.com/${owner}/${repo}/actions/workflows/${workflowFile}`;
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

    // Race the getOSSFScore call against the timeout
    const score = await Promise.race([
      getOSSFScore(context, workflowToken, `${owner}/${repo}`, workflowFile, templateUrl, localRunId, minScore, issues, compliance),
      timeout
    ]);

    context.res = {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: {
        runId: localRunId,
        githubRunId: localRunId || null,
        githubRunUrl: localRunId ? `https://github.com/${owner}/${repo}/actions/runs/${localRunId}` : null,
        message: `${workflowFile} workflow triggered; ${localRunId} run completed`,
        score,
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