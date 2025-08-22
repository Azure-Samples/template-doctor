const fetch = require('node-fetch');

module.exports = async function (context, req) {
  const correlationId = `template-validation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  
  function corsHeaders() {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Expose-Headers': 'X-Correlation-Id'
    };
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: corsHeaders() };
    return;
  }

  try {
    // Extract request parameters
    const { 
      templateName, 
      repoUrl,
      branch = 'main',
      callbackUrl = null,
    } = req.body || {};

    // Basic validation
    if (!templateName && !repoUrl) {
      context.res = {
        status: 400,
        headers: corsHeaders(),
        body: { 
          error: 'Missing required parameters: templateName or repoUrl required',
          correlationId
        }
      };
      return;
    }

    // Process template name or repository URL
    let owner, repo;
    
    if (repoUrl) {
      try {
        const url = new URL(repoUrl);
        const parts = url.pathname.split('/');
        if (parts.length >= 3) {
          owner = parts[1];
          repo = parts[2].replace('.git', '');
        }
      } catch (error) {
        context.log.error('Error parsing repository URL:', error);
      }
    } else if (templateName && templateName.includes('/')) {
      const parts = templateName.split('/');
      if (parts.length >= 2) {
        owner = parts[0];
        repo = parts[1].replace('.git', '');
      }
    }

    if (!owner || !repo) {
      context.res = {
        status: 400,
        headers: corsHeaders(),
        body: { 
          error: 'Could not determine owner and repository from the provided parameters',
          correlationId
        }
      };
      return;
    }

    // Get GitHub token from environment variable
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      context.log.error('GITHUB_TOKEN environment variable is not set');
      context.res = {
        status: 500,
        headers: corsHeaders(),
        body: { 
          error: 'GitHub token not configured',
          correlationId
        }
      };
      return;
    }

    // Prepare parameters for the workflow dispatch event
    const workflowId = 'sample-workflow-linux.yaml'; // Can be file name or workflow ID
    const dispatchUrl = `https://api.github.com/repos/microsoft/template-validation-action/actions/workflows/${workflowId}/dispatches`;
    
    // Prepare payload for GitHub Actions
    const payload = {
      ref: 'main',
      inputs: {
        template_name: `${owner}/${repo}`,
        branch: branch,
        correlation_id: correlationId,
        callback_url: callbackUrl
      }
    };

    context.log.info(`Triggering GitHub Action | Template: ${owner}/${repo}, Branch: ${branch}, CorrelationId: ${correlationId}`);
    
    // Call GitHub API to trigger the workflow
    try {
      const response = await fetch(dispatchUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${githubToken}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorDetails = '';
        try {
          const errorData = await response.text();
          errorDetails = errorData;
        } catch (_) {}
        
        context.log.error(`Error triggering GitHub Action: ${response.status} ${response.statusText} | ${errorDetails}`);
        
        context.res = {
          status: response.status,
          headers: corsHeaders(),
          body: { 
            error: `Failed to trigger GitHub Action: ${response.statusText}`,
            details: errorDetails,
            correlationId
          }
        };
        return;
      }

      // Create a validation record for this request
      const validationRecord = {
        correlationId,
        templateName: `${owner}/${repo}`,
        branch,
        status: 'started',
        startTime: new Date().toISOString(),
        callbackUrl
      };
      
      // In a real implementation, you would store this record in a database
      // For now, we'll log it and return the correlation ID for the client to poll
      context.log.info(`Validation record created: ${JSON.stringify(validationRecord)}`);

      // Return success response
      context.res = {
        status: 202, // Accepted
        headers: {
          ...corsHeaders(),
          'X-Correlation-Id': correlationId
        },
        body: {
          correlationId,
          message: 'Template validation started',
          statusUrl: `/api/template-validation-status?id=${correlationId}`,
          templateName: `${owner}/${repo}`,
          branch
        }
      };
    } catch (error) {
      context.log.error('Error triggering GitHub Action:', error);
      context.res = {
        status: 500,
        headers: corsHeaders(),
        body: { 
          error: `Error triggering GitHub Action: ${error.message}`,
          correlationId
        }
      };
    }
  } catch (err) {
    context.log.error('template-validation error', err);
    context.res = {
      status: 500,
      headers: corsHeaders(),
      body: { 
        error: `Internal server error: ${err.message}`,
        correlationId
      }
    };
  }
};
