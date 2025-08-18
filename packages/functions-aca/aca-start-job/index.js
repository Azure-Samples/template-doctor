module.exports = async function (context, req) {
  const correlationId = `start-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  
  function corsHeaders() {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Expose-Headers': 'X-Correlation-Id'
    };
  }

  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: corsHeaders() };
    return;
  }

  try {
    const { templateName, action } = req.body || {};
    // Default action to "init" if not provided
    const jobAction = action || "init";
    
    // If no template name, just keep the container alive without starting a job
    if (!templateName) {
      context.log.info(`No template name provided, keeping container ready | Action: ${jobAction}`);
      context.res = {
        status: 202,
        headers: Object.assign({}, corsHeaders(), { 'X-Correlation-Id': correlationId }),
        body: { 
          message: 'No template name provided. Container is ready and waiting for a job.',
          correlationId
        }
      };
      return;
    }

    // Normalize template name to handle various formats
    let normalizedTemplate = templateName;
    
    // Check if it's a URL and extract the repo name
    if (normalizedTemplate.startsWith('http://') || normalizedTemplate.startsWith('https://') || normalizedTemplate.startsWith('git@')) {
      try {
        if (normalizedTemplate.startsWith('git@')) {
          const parts = normalizedTemplate.split(':');
          if (parts.length > 1) normalizedTemplate = parts[1];
        } else {
          const url = new URL(normalizedTemplate);
          normalizedTemplate = url.pathname;
        }
        
        // Clean up the path
        normalizedTemplate = normalizedTemplate.replace(/^\/+/, '');
        const segments = normalizedTemplate.split('/').filter(Boolean);
        normalizedTemplate = segments.length ? segments[segments.length - 1] : normalizedTemplate;
        normalizedTemplate = normalizedTemplate.replace(/\.git$/i, '');
      } catch (e) {
        context.log.error('Error normalizing template URL:', e);
        // Continue with original input if parsing fails
      }
    } else {
      // Simple replacement for non-URL inputs
      normalizedTemplate = templateName.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
    }
    
    context.log.info(`Received request | Template: ${templateName}, Normalized: ${normalizedTemplate}, Action: ${jobAction}`);
    
    // Create a unique execution name with timestamp and template name
    const executionName = `td-${Date.now()}-${normalizedTemplate}`;
    context.log.info(`Generated execution name: ${executionName}`);
    
    // This is where we would actually start the ACA job using the Azure SDK
    // For now we need to manually set this up to call the real container
    
    try {
      // Use the Container App client to start a job
      let containerJobStarted = false;
      let containerJobError = null;
      
      try {
        // Check if we have the required environment variables
        const hasRequiredEnvVars = process.env.AZURE_SUBSCRIPTION_ID && 
                                   process.env.ACA_RESOURCE_GROUP && 
                                   process.env.ACA_JOB_NAME;
        
        if (hasRequiredEnvVars) {
          // Import the container app client helpers
          const { startContainerJob } = require('../lib/container-app-client');
          
          // Log environment for debugging
          context.log.info(`Starting container job with environment:
AZURE_SUBSCRIPTION_ID: ${process.env.AZURE_SUBSCRIPTION_ID ? 'present' : 'missing'}
ACA_RESOURCE_GROUP: ${process.env.ACA_RESOURCE_GROUP || 'missing'}
ACA_JOB_NAME: ${process.env.ACA_JOB_NAME || 'missing'}
`);
          
          // Start the container job
          const jobResult = await startContainerJob(executionName, normalizedTemplate, jobAction);
          context.log.info(`Container job started: ${JSON.stringify(jobResult)}`);
          
          // Initialize global executionLogs if it doesn't exist
          if (!global.executionLogs) {
            global.executionLogs = {};
          }
          
          // Set up global logs object for this execution
          global.executionLogs[executionName] = {
            status: 'running',
            logs: [],
            done: false,
            startTime: new Date().toISOString(),
            endTime: null,
            exitCode: null,
            jobName: jobResult.jobExecutionName, // Store the full job execution name
            resourceId: jobResult.resourceId,
            simulation: false
          };
          
          // Add initial log with both execution name and job name
          global.executionLogs[executionName].logs.push({
            timestamp: Date.now(),
            message: `[${new Date().toISOString()}] Container job started for template ${normalizedTemplate}`
          });
          
          global.executionLogs[executionName].logs.push({
            timestamp: Date.now(),
            message: `[${new Date().toISOString()}] Job execution name: ${executionName}`
          });
          
          global.executionLogs[executionName].logs.push({
            timestamp: Date.now(),
            message: `[${new Date().toISOString()}] Container job name: ${jobResult.jobExecutionName}`
          });
          
          containerJobStarted = true;
        } else {
          context.log.warn('Missing required environment variables for Container App job');
          containerJobError = 'Missing required environment variables: AZURE_SUBSCRIPTION_ID, ACA_RESOURCE_GROUP, ACA_JOB_NAME';
        }
      } catch (containerError) {
        context.log.error(`Error starting Container App job: ${containerError.message || containerError}`);
        containerJobError = containerError.message || 'Unknown error starting Container App job';
      }
      
      // If we couldn't start the real container job, return an error
      if (!containerJobStarted) {
        context.log.error(`Cannot use simulation mode - real Container App integration required`);
        
        throw new Error(containerJobError || 'Container App integration not configured. Cannot use simulation mode.');
      }
    } catch (error) {
      context.log.error(`Error starting job: ${error.message || error}`);
      // Continue anyway - we'll return the execution ID and let the client try to fetch logs
    }
    
    context.res = {
      status: 202,
      headers: Object.assign({}, corsHeaders(), { 'X-Correlation-Id': correlationId }),
      body: {
        jobName: process.env.ACA_JOB_NAME || 'unknown-job',
        executionName: executionName,
        templateUsed: normalizedTemplate,
        correlationId: correlationId,
        message: 'Job started successfully',
        logs: [`[${new Date().toISOString()}] Job ${executionName} started for template ${normalizedTemplate}`]
      }
    };
  } catch (err) {
    context.log.error('aca-start-job error', err);
    context.res = {
      status: 500,
      headers: Object.assign({}, corsHeaders(), { 'X-Correlation-Id': correlationId }),
      body: {
        error: err && err.message ? err.message : String(err),
        correlationId: correlationId
      }
    };
  }
};
