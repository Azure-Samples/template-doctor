const fetch = require('node-fetch');

module.exports = async function (context, req) {
  function corsHeaders() {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
    // Get the correlation ID from query parameters
    const correlationId = req.query.id;
    
    if (!correlationId) {
      context.res = {
        status: 400,
        headers: corsHeaders(),
        body: { error: 'Missing correlation ID parameter' }
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
        body: { error: 'GitHub token not configured' }
      };
      return;
    }

    // In a real implementation, you would retrieve the validation record from a database
    // For now, we'll query the GitHub Actions API to find the workflow run that contains our correlation ID

    // Get the most recent workflow runs for the sample-workflow-linux.yaml
    const workflowId = 'sample-workflow-linux.yaml';
    const workflowRunsUrl = `https://api.github.com/repos/microsoft/template-validation-action/actions/workflows/${workflowId}/runs?per_page=10`;
    
    try {
      const response = await fetch(workflowRunsUrl, {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${githubToken}`,
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });

      if (!response.ok) {
        context.log.error(`Error fetching workflow runs: ${response.status} ${response.statusText}`);
        context.res = {
          status: response.status,
          headers: corsHeaders(),
          body: { error: `Failed to fetch workflow status: ${response.statusText}` }
        };
        return;
      }

      const data = await response.json();
      
      // Find the workflow run that matches our correlation ID
      // In a real implementation, you would need to retrieve the run_id from your database
      // or implement a more robust search mechanism
      
      // Simulate finding the workflow run - in production, you'd need to parse workflow logs or use a database
      const simulatedRun = {
        id: Math.floor(Math.random() * 1000000),
        status: ['queued', 'in_progress', 'completed'][Math.floor(Math.random() * 3)],
        conclusion: Math.random() > 0.5 ? 'success' : 'failure',
        html_url: `https://github.com/microsoft/template-validation-action/actions/runs/${Math.floor(Math.random() * 1000000)}`,
        created_at: new Date(Date.now() - Math.floor(Math.random() * 3600000)).toISOString(),
        updated_at: new Date().toISOString()
      };

      // Get validation results - this would be replaced with actual result parsing
      let results = null;
      if (simulatedRun.status === 'completed') {
        // Simulate validation results
        results = {
          passed: simulatedRun.conclusion === 'success',
          issues: simulatedRun.conclusion === 'success' ? [] : [
            { rule: 'valid-azure-file', message: 'Missing azure.yaml file' },
            { rule: 'bicep-validation', message: 'Invalid Bicep template format' }
          ],
          validationTime: Math.floor(Math.random() * 120) + 30 // 30-150 seconds
        };
      }

      // Return the validation status
      context.res = {
        status: 200,
        headers: corsHeaders(),
        body: {
          correlationId,
          status: simulatedRun.status,
          conclusion: simulatedRun.conclusion,
          runUrl: simulatedRun.html_url,
          startTime: simulatedRun.created_at,
          endTime: simulatedRun.status === 'completed' ? simulatedRun.updated_at : null,
          results
        }
      };
    } catch (error) {
      context.log.error('Error fetching workflow status:', error);
      context.res = {
        status: 500,
        headers: corsHeaders(),
        body: { error: `Error fetching workflow status: ${error.message}` }
      };
    }
  } catch (err) {
    context.log.error('template-validation-status error', err);
    context.res = {
      status: 500,
      headers: corsHeaders(),
      body: { error: `Internal server error: ${err.message}` }
    };
  }
};
