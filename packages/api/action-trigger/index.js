const { withRetry, createGitHubHeaders, fetchWithGitHubAuth } = require('../shared/api-utils');

async function getRunList(workflowOwner, workflowRepo, workflowId, context = null) {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const isoDate = tenMinutesAgo.toISOString();

  const workflowUrl = `https://api.github.com/repos/${encodeURIComponent(workflowOwner)}/${encodeURIComponent(workflowRepo)}/actions/workflows/${encodeURIComponent(workflowId)}/runs?event=workflow_dispatch&per_page=100&branch=main&created:>=${encodeURIComponent(isoDate)}`;

  return fetchWithGitHubAuth(workflowUrl, { operationName: 'getRunList' }, context);
}

async function triggerAction(workflowOwner, workflowRepo, workflowId, workflowInput, context = null) {
  const workflowUrl = `https://api.github.com/repos/${workflowOwner}/${workflowRepo}/actions/workflows/${encodeURIComponent(workflowId)}/dispatches`;

  const body = {
    ref: 'main',
    inputs: workflowInput
  };

  return fetchWithGitHubAuth(workflowUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    operationName: 'triggerAction'
  }, context);
}
async function triggerWorkflow(workflowOwner, workflowRepo, workflowId, workflowInput, runIdInputProperty, context) {
    // Generate a correlation ID for this workflow trigger
    const correlationId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    if (context && context.log) {
        context.log(`Triggering workflow`, {
            operation: 'triggerWorkflow',
            workflowOwner,
            workflowRepo,
            workflowId,
            correlationId
        });
    }

    // Trigger workflow
    const rawResponse = await triggerAction(workflowOwner, workflowRepo, workflowId, workflowInput, context);

    if (context && context.log) {
        context.log(`Triggered workflow ${workflowOwner}/${workflowRepo}#${workflowId}`, {
            operation: 'triggerWorkflow',
            status: rawResponse.status,
            correlationId
        });
    }

    if (!rawResponse.ok) {
      const errText = await rawResponse.text();
      if (context && context.log && context.log.error) {
          context.log.error(`Failed to trigger workflow`, {
              operation: 'triggerWorkflow',
              workflowOwner,
              workflowRepo,
              workflowId,
              status: rawResponse.status,
              error: errText,
              correlationId
          });
      }
      
      return {
        found: false,
        status: 502,
        error: `Trigger workflow failed: ${rawResponse.status} ${rawResponse.statusText} - ${errText}`,
        ownerRepo: `${workflowOwner}/${workflowRepo}/actions/workflows/${workflowId}/runs`
      };
    }

    // Ensure the caller provided the input property to search for
    const uniqueInputId = workflowInput && Object.prototype.hasOwnProperty.call(workflowInput, runIdInputProperty)
      ? workflowInput[runIdInputProperty]
      : undefined;

    if (!uniqueInputId) {
      if (context && context.log && context.log.warn) {
          context.log.warn(`Missing input property in workflow input`, {
              operation: 'triggerWorkflow',
              runIdInputProperty,
              correlationId
          });
      }
      
      return {
        found: false,
        status: 400,
        error: `Input property ${runIdInputProperty} is missing in workflowInput`,
        uniqueInputId: null,
        ownerRepo: `${workflowOwner}/${workflowRepo}/actions/workflows/${workflowId}/runs`
      };
    }
    
    // Implement polling approach to find the workflow run
    let matchingRun = null;
    const maxAttempts = 5;
    let attempts = 0;
    
    while (attempts < maxAttempts && !matchingRun) {
        const waitTimeMs = 5000 * (attempts + 1); // Increasing delay (5s, 10s, 15s, 20s, 25s)
        
        if (context && context.log) {
            context.log(`Waiting ${waitTimeMs/1000} seconds for GitHub to register the workflow run (attempt ${attempts + 1}/${maxAttempts})`, {
                operation: 'triggerWorkflow',
                workflowOwner,
                workflowRepo,
                workflowId,
                correlationId,
                attemptNumber: attempts + 1
            });
        }
        await new Promise(resolve => setTimeout(resolve, waitTimeMs));
        
        if (context && context.log) {
            context.log(`Fetching recent runs to locate workflow run (attempt ${attempts + 1}/${maxAttempts})`, {
                operation: 'triggerWorkflow',
                workflowOwner,
                workflowRepo,
                workflowId,
                correlationId,
                attemptNumber: attempts + 1
            });
        }

        // Get recent runs for the workflow
        const rawResponseFindRunId = await getRunList(workflowOwner, workflowRepo, workflowId, context);

        if (!rawResponseFindRunId.ok) {
            const errText = await rawResponseFindRunId.text();
            if (context && context.log && context.log.error) {
                context.log.error(`Failed to get workflow runs (attempt ${attempts + 1}/${maxAttempts})`, {
                    operation: 'triggerWorkflow',
                    workflowOwner,
                    workflowRepo,
                    workflowId,
                    status: rawResponseFindRunId.status,
                    error: errText,
                    correlationId,
                    attemptNumber: attempts + 1
                });
            }
            
            attempts++;
            continue; // Try again after waiting
        }

        const rawDataFindRunId = await rawResponseFindRunId.json();

        if (!rawDataFindRunId || !Array.isArray(rawDataFindRunId.workflow_runs)) {
            if (context && context.log && context.log.error) {
                context.log.error(`Invalid response structure from GitHub (attempt ${attempts + 1}/${maxAttempts})`, {
                    operation: 'triggerWorkflow',
                    correlationId,
                    attemptNumber: attempts + 1
                });
            }
            
            attempts++;
            continue; // Try again after waiting
        }

        if (context && context.log) {
            context.log(`Received ${rawDataFindRunId.workflow_runs.length} workflow runs (attempt ${attempts + 1}/${maxAttempts})`, {
                operation: 'triggerWorkflow',
                runCount: rawDataFindRunId.workflow_runs.length,
                correlationId,
                attemptNumber: attempts + 1
            });
            
            // Log sample data for first few runs to help diagnose issues
            if (rawDataFindRunId.workflow_runs.length > 0) {
                const sampleRuns = rawDataFindRunId.workflow_runs.slice(0, 3);
                context.log(`Sample runs data`, {
                    operation: 'triggerWorkflow',
                    sampleRuns: sampleRuns.map(run => ({
                        id: run.id,
                        title: run.display_title || run.name,
                        commitMsg: run.head_commit ? run.head_commit.message : null,
                        createdAt: run.created_at
                    })),
                    correlationId,
                    attemptNumber: attempts + 1
                });
            }
        }

        // be resilient: check display_title, name, and head_commit.message
        matchingRun = rawDataFindRunId.workflow_runs.find(run => {
            const title = run.display_title || run.name || '';
            const commitMsg = (run.head_commit && run.head_commit.message) ? String(run.head_commit.message) : '';
            return (title && title.includes(String(uniqueInputId))) || (commitMsg && commitMsg.includes(String(uniqueInputId)));
        });

        if (matchingRun) {
            if (context && context.log) {
                context.log(`Matching run found on attempt ${attempts + 1}/${maxAttempts}`, {
                    operation: 'triggerWorkflow',
                    runId: matchingRun.id,
                    runIdInputProperty,
                    uniqueInputId,
                    correlationId,
                    attemptNumber: attempts + 1
                });
            }
            
            return {
                status: 200,
                found: true,
                runId: matchingRun.id,
                run: matchingRun,
                uniqueInputId,
                ownerRepo: `${workflowOwner}/${workflowRepo}/actions/workflows/${workflowId}/runs`,
                attempts: attempts + 1
            };
        }

        if (context && context.log) {
            context.log(`No matching run found on attempt ${attempts + 1}/${maxAttempts}, will ${attempts < maxAttempts - 1 ? 'retry' : 'give up'}`, {
                operation: 'triggerWorkflow',
                runIdInputProperty,
                uniqueInputId,
                correlationId,
                attemptNumber: attempts + 1
            });
        }
        
        attempts++;
    }
    
    // not found after all attempts
    return {
      found: false,
      status: 404,
      error: `trigger-action: Could not find the triggered workflow run after ${maxAttempts} attempts`,
      uniqueInputId,
      ownerRepo: `${workflowOwner}/${workflowRepo}/actions/workflows/${workflowId}/runs`,
      attempts: maxAttempts
    };
};

module.exports = async function (context, req) {
  // Generate a unique request ID to correlate logs across this request
  const requestId = `action-trigger-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Add request ID to the context's binding data for tracking
  context.bindingData = context.bindingData || {};
  context.bindingData.requestId = requestId;

  if (req.method === 'OPTIONS') {
    context.log(`Handling OPTIONS request`, {
      operation: 'action-trigger',
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
    operation: 'action-trigger',
    method: req.method,
    url: req.url,
    requestId
  });

  try {
    // Extract fields
    const { workflowOrgRep, workflowId, workflowInput, runIdInputProperty } = req.body;

    context.log(`Request parameters received`, {
      operation: 'action-trigger',
      workflowOrgRep,
      workflowId,
      runIdInputProperty,
      hasWorkflowInput: !!workflowInput,
      requestId
    });

    if (!workflowOrgRep) {
      context.log.warn(`Missing required parameter: workflowOrgRep`, {
        operation: 'action-trigger',
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

    // Validate workflowId (accept number or string)
    if (workflowId === undefined || workflowId === null || workflowId === '') {
      context.log.warn(`Missing required parameter: workflowId`, {
        operation: 'action-trigger',
        requestId
      });
      
      context.res = { 
        status: 400, 
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: { 
          error: 'workflowId is required',
          errorType: 'MISSING_PARAMETER'
        }
      };
      return;
    }

    if (!runIdInputProperty) {
      context.log.warn(`Missing required parameter: runIdInputProperty`, {
        operation: 'action-trigger',
        requestId
      });
      
      context.res = { 
        status: 400, 
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: { 
          error: 'runIdInputProperty is required',
          errorType: 'MISSING_PARAMETER'
        }
      };
      return;
    }

    const [incomingWorkflowOwner, incomingWorkflowRepo] = workflowOrgRep.split('/');
    if (!incomingWorkflowOwner || !incomingWorkflowRepo) {
      context.log.warn(`Invalid format for workflowOrgRep`, {
        operation: 'action-trigger',
        workflowOrgRep,
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

    const workflowOwner = incomingWorkflowOwner || "Template-Doctor";
    const workflowRepo = incomingWorkflowRepo || "template-doctor";

    context.log(`Triggering workflow`, {
      operation: 'action-trigger',
      workflowOwner,
      workflowRepo,
      workflowId,
      requestId
    });

    // Use the helper to trigger and discover run id
    const result = await triggerWorkflow(workflowOwner, workflowRepo, workflowId, workflowInput, runIdInputProperty, context);

    if (result.found) {
      const runId = result.runId;
      context.log(`Workflow triggered successfully`, {
        operation: 'action-trigger',
        workflowOwner,
        workflowRepo,
        workflowId,
        runId,
        attempts: result.attempts || 1,
        requestId
      });
      
      context.res = {
        status: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: { 
          error: null, 
          data: { 
            runId,
            attempts: result.attempts || 1 
          }, 
          context: { 
            uniqueInputId: result.uniqueInputId, 
            ownerRepo: result.ownerRepo, 
            run: result.run,
            requestId
          } 
        }
      };
      return;
    } else {
      // propagate structured error responses
      const status = result.status || 500;
      const errorType = status === 404 ? 'RUN_NOT_FOUND' : 
                         status === 400 ? 'BAD_REQUEST' : 
                         status === 502 ? 'GITHUB_API_ERROR' : 'SERVER_ERROR';
      
      context.log.warn(`Workflow trigger issue`, {
        operation: 'action-trigger',
        workflowOwner,
        workflowRepo,
        workflowId,
        status,
        error: result.error,
        errorType,
        attempts: result.attempts,
        requestId
      });
      
      context.res = {
        status,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: {
          error: result.error || 'trigger-action: Could not locate run',
          errorType,
          data: null,
          context: {
            url: result.workflowUrl,
            uniqueInputId: result.uniqueInputId || null,
            ownerRepo: result.ownerRepo || `${workflowOwner}/${workflowRepo}`,
            attempts: result.attempts,
            requestId
          }
        }
      };
      return;
    }

  } catch (error) {
    context.log.error('Error in action-trigger function', {
      operation: 'action-trigger',
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


module.exports.triggerWorkflow = triggerWorkflow;
