module.exports = async function (context, req) {
  const correlationId = `start-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const debug = Boolean((req && req.query && (req.query.debug === '1' || req.query.debug === 'true')) || (req && req.body && req.body.debug));
  
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

    // Normalize template name (simplified function that just returns the name)
    const normalizedTemplate = templateName.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
    context.log.info(`Received request | Template: ${templateName}, Normalized: ${normalizedTemplate}, Action: ${jobAction}`);
    
    // Create a unique execution name
    const executionName = `td-${Date.now()}`;
    context.log.info(`Generated execution name: ${executionName}`);

    // In a real implementation, we would start the job here
    // For now, we'll just simulate success
    
    context.res = {
      status: 202,
      headers: Object.assign({}, corsHeaders(), { 'X-Correlation-Id': correlationId }),
      body: {
        jobName: process.env.ACA_JOB_NAME || 'unknown-job',
        executionName: executionName,
        templateUsed: normalizedTemplate,
        correlationId: correlationId,
        message: 'Job started successfully (simulated)',
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
