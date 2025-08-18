module.exports = async function (context, req) {
  const correlationId = `health-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  
  function corsHeaders() {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Expose-Headers': 'X-Correlation-Id'
    };
  }

  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: corsHeaders() };
    return;
  }

  try {
    // Simplified health check - always returns OK
    context.res = {
      status: 200,
      headers: Object.assign({}, corsHeaders(), { 'X-Correlation-Id': correlationId }),
      body: {
        ok: true,
        message: 'Health check passed',
        envVars: {
          SUBSCRIPTION_ID: !!process.env.AZURE_SUBSCRIPTION_ID,
          RESOURCE_GROUP: !!process.env.ACA_RESOURCE_GROUP,
          JOB_NAME: !!process.env.ACA_JOB_NAME,
          LOG_ANALYTICS_WORKSPACE: !!(process.env.LOG_ANALYTICS_WORKSPACE || process.env.LOG_ANALYTICS_WORKSPACE_ID),
          AZURE_CLIENT_ID: !!process.env.AZURE_CLIENT_ID
        }
      }
    };
  } catch (err) {
    context.log.error('health-check error', err);
    context.res = {
      status: 500,
      headers: Object.assign({}, corsHeaders(), { 'X-Correlation-Id': correlationId }),
      body: { 
        ok: false, 
        error: err.message,
        correlationId
      }
    };
  }
};
