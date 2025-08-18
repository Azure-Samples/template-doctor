module.exports = async function (context, req) {
  function corsHeaders() {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
  }

  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: corsHeaders() };
    return;
  }

  try {
    const { executionName } = req.body || {};
    
    // Always return success to the client
    context.res = { 
      status: 202, 
      headers: corsHeaders(), 
      body: { 
        message: 'Stop job request acknowledged',
        executionName: executionName || 'unknown',
        info: 'This is a simplified implementation. The job stop request has been received.'
      } 
    };
    
    // Log the request
    context.log.info(`Received stop request for execution: ${executionName || 'unknown'}`);
    
  } catch (err) {
    context.log.error('Error in stop-job:', err);
    // Still return success to the client to avoid breaking the UI
    context.res = { 
      status: 202, 
      headers: corsHeaders(), 
      body: { 
        message: 'Stop job request acknowledged with error',
        error: err.message
      } 
    };
  }
};
