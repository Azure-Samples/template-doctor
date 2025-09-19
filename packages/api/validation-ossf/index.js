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
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: { 
          error: "templateUrl is required",
          type: "validation_error",
          details: "The templateUrl parameter must be provided in the request body",
          timestamp: new Date().toISOString()
        }
      };
      return;
    }

    if (!minScore) {
      context.res = {
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: { 
          error: "minScore is required",
          type: "validation_error",
          details: "The minScore parameter must be provided in the request body",
          timestamp: new Date().toISOString()
        }
      };
      return;
    }

    // Validate minScore is a valid number between 0 and 10
    const minScoreNum = parseFloat(minScore);
    if (isNaN(minScoreNum) || minScoreNum < 0 || minScoreNum > 10) {
      context.res = {
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: { 
          error: "Invalid minScore value",
          type: "validation_error",
          details: "The minScore must be a number between 0 and 10",
          timestamp: new Date().toISOString()
        }
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
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('OSSF score check timed out after 3 minutes'));
      }, 180000);
    });

    // Always use the action-* APIs implementation
    const scorePromise = getOSSFScore(context, owner, repo, workflowFile, templateUrl, localRunId, minScoreNum, issues, compliance);

    // Race the getOSSFScore call against the timeout
    const result = await Promise.race([
      scorePromise,
      timeout
    ]);

    // Clear the timeout to prevent memory leaks
    clearTimeout(timeoutId);

    // securely destructure score and runId if they are returned or set to empty string or null
    const { score = null, runId = null } = result || {};

    context.res = {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: {
        api: 'ossf',
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
    context.log(`OSSF validation completed for ${templateUrl} with local run ID: ${runId}: ${JSON.stringify(context.res.body)}`);

  } catch (err) {
    // Enhanced error logging with structured information
    const errorInfo = {
      message: err.message,
      stack: err.stack,
      templateUrl: req.body?.templateUrl,
      operation: 'validation-ossf',
      timestamp: new Date().toISOString()
    };

    if (process.env.NODE_ENV === "development") {
      console.error("OSSF validation error:", errorInfo);
    } else {
      context.log.error("OSSF validation error:", errorInfo);
    }

    // Determine specific error types
    let errorType = 'server_error';
    let statusCode = 500;
    let errorDetails = 'Internal server error';

    // Check for different error types
    if (err.message && err.message.includes('GitHub dispatch failed')) {
      errorType = 'github_api_error';
      statusCode = 502;
      errorDetails = 'Error communicating with GitHub API';
    } else if (err.message && err.message.includes('timed out')) {
      errorType = 'timeout_error';
      statusCode = 504;
      errorDetails = 'OSSF score check operation timed out';
    } else if (err.message && err.message.includes('GH_WORKFLOW_TOKEN')) {
      errorType = 'configuration_error';
      errorDetails = 'Missing required GitHub authentication token';
    }

    // Return a structured error response
    context.res = {
      status: statusCode,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: {
        error: err.message,
        type: errorType,
        details: errorDetails,
        timestamp: new Date().toISOString(),
        issues: [
          {
            id: `ossf-${errorType}`,
            severity: 'error',
            message: err.message
          }
        ]
      }
    };
  }
};