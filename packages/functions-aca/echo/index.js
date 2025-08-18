module.exports = async function (context, req) {
  context.log('Echo function processed a request.');

  if (req.method === 'OPTIONS') {
    context.res = {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    };
    return;
  }

  const responseMessage = {
    message: "Echo function is working correctly!",
    request: {
      method: req.method,
      url: req.url,
      query: req.query,
      headers: req.headers,
      body: req.body
    },
    env: {
      NODE_ENV: process.env.NODE_ENV,
      // Only include safe environment variables
      WEBSITE_SITE_NAME: process.env.WEBSITE_SITE_NAME,
      FUNCTIONS_WORKER_RUNTIME: process.env.FUNCTIONS_WORKER_RUNTIME,
      AZURE_SUBSCRIPTION_ID: process.env.AZURE_SUBSCRIPTION_ID ? "Set" : "Not set",
      ACA_RESOURCE_GROUP: process.env.ACA_RESOURCE_GROUP ? "Set" : "Not set",
      ACA_JOB_NAME: process.env.ACA_JOB_NAME ? "Set" : "Not set",
      LOG_ANALYTICS_WORKSPACE: process.env.LOG_ANALYTICS_WORKSPACE ? "Set" : "Not set"
    }
  };

  context.res = {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: responseMessage
  };
};
