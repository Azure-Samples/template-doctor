const { withRetry, createGitHubHeaders, fetchWithGitHubAuth } = require('../shared/api-utils');

async function getArtifactsList(workflowOwner, workflowRepo, workflowRunId, context = null) {
  const workflowUrl = `https://api.github.com/repos/${encodeURIComponent(workflowOwner)}/${encodeURIComponent(workflowRepo)}/actions/runs/${workflowRunId}/artifacts`;

  if (context && context.log) {
    context.log(`Fetching artifacts list`, {
      operation: 'getArtifactsList',
      workflowOwner,
      workflowRepo,
      workflowRunId
    });
  }

  return fetchWithGitHubAuth(workflowUrl, {}, context);
}

async function getArtifactsForRun(workflowOwner, workflowRepo, workflowRunId, context = null) {
  if (context && context.log) {
    context.log(`Getting artifacts for run`, {
      operation: 'getArtifactsForRun',
      workflowOwner,
      workflowRepo,
      workflowRunId
    });
  }

  const rawResponse = await getArtifactsList(workflowOwner, workflowRepo, workflowRunId, context);

  if (!rawResponse.ok) {
    const errText = await rawResponse.text();
    if (context && context.log && context.log.error) {
      context.log.error(`Failed to get artifacts for run`, {
        operation: 'getArtifactsForRun',
        workflowOwner,
        workflowRepo,
        workflowRunId,
        status: rawResponse.status,
        error: errText
      });
    }
    throw new Error(`Trigger workflow failed: ${rawResponse.status} ${rawResponse.statusText} - ${errText}`);
  }

  const artifactsData = await rawResponse.json();

  if (!artifactsData) {
    if (context && context.log && context.log.error) {
      context.log.error(`Invalid response from GitHub`, {
        operation: 'getArtifactsForRun',
        workflowOwner,
        workflowRepo,
        workflowRunId
      });
    }
    throw new Error("Invalid response from GitHub when fetching artifacts");
  }

  if (context && context.log) {
    context.log(`Successfully retrieved artifacts for run`, {
      operation: 'getArtifactsForRun',
      workflowOwner,
      workflowRepo,
      workflowRunId,
      artifactCount: artifactsData.total_count || 0
    });
  }

  return artifactsData;
}

module.exports = async function (context, req) {
  // Generate a unique request ID to correlate logs across this request
  const requestId = `action-run-artifacts-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Add request ID to the context's binding data for tracking
  context.bindingData = context.bindingData || {};
  context.bindingData.requestId = requestId;

  if (req.method === 'OPTIONS') {
    context.log(`Handling OPTIONS request`, {
      operation: 'action-run-artifacts',
      method: 'OPTIONS',
      requestId
    });

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

  context.log(`Processing request`, {
    operation: 'action-run-artifacts',
    method: req.method,
    url: req.url,
    requestId
  });

  try {
    // Extract incoming fields
    const { workflowOrgRep, workflowRunId } = req.body;

    context.log(`Request parameters received`, {
      operation: 'action-run-artifacts',
      workflowOrgRep,
      workflowRunId,
      requestId
    });

    if (!workflowOrgRep) {
      context.log.warn(`Missing required parameter: workflowOrgRep`, {
        operation: 'action-run-artifacts',
        workflowRunId,
        requestId
      });

      context.res = {
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: {
          error: 'workflowOrgRep is required',
          errorType: 'MISSING_PARAMETER'
        }
      };
      return;
    }

    const [incomingWorkflowOwner, incomingWorkflowRepo] = workflowOrgRep.split('/');
    if (!incomingWorkflowOwner || !incomingWorkflowRepo) {
      context.log.warn(`Invalid format for workflowOrgRep`, {
        operation: 'action-run-artifacts',
        workflowOrgRep,
        workflowRunId,
        requestId
      });

      context.res = {
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: {
          error: 'workflowOrgRep must be in owner/repo format',
          errorType: 'INVALID_FORMAT'
        }
      };
      return;
    }

    if (!workflowRunId) {
      context.log.warn(`Missing required parameter: workflowRunId`, {
        operation: 'action-run-artifacts',
        requestId,
        workflowOrgRep,
        workflowRunId,
      });

      context.res = {
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: {
          error: 'workflowRunId is required',
          errorType: 'MISSING_PARAMETER'
        }
      };
      return;
    }

    const workflowOwner = incomingWorkflowOwner || "Template-Doctor";
    const workflowRepo = incomingWorkflowRepo || "template-doctor";

    context.log(`Fetching artifacts for run`, {
      operation: 'action-run-artifacts',
      workflowOwner,
      workflowRepo,
      workflowRunId,
      requestId
    });

    const artifactsData = await getArtifactsForRun(workflowOwner, workflowRepo, workflowRunId, context);

    context.log(`Successfully retrieved artifacts`, {
      operation: 'action-run-artifacts',
      workflowOwner,
      workflowRepo,
      workflowRunId,
      artifactCount: artifactsData.total_count || 0,
      requestId
    });

    context.res = {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: {
        error: null,
        data: artifactsData,
        context: {
          ownerRepo: `${workflowOwner}/${workflowRepo}`,
          requestId,
          workflowRunId
        }
      }
    };
  } catch (error) {
    context.log.error('Error in action-run-artifacts function', {
      operation: 'action-run-artifacts',
      error: error.message,
      stack: error.stack,
      requestId
    });

    context.res = {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: {
        error: error.message || 'Internal Server Error',
        errorType: 'SERVER_ERROR',
        requestId
      }
    };
  }
};

module.exports.getArtifactsForRun = getArtifactsForRun;