module.exports = async function (context, req) {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers };
    return;
  }

  // Pick up env from SWA configuration / Function App settings
  const baseUrl = process.env.TD_BACKEND_BASE_URL || process.env.BACKEND_BASE_URL || '';
  const functionKey = process.env.TD_BACKEND_FUNCTION_KEY || process.env.BACKEND_FUNCTION_KEY || '';
  
  // GitHub OAuth settings from environment
  const githubClientId = process.env.GITHUB_CLIENT_ID || '';

  context.res = {
    status: 200,
    headers,
    body: {
      GITHUB_CLIENT_ID: githubClientId,
      backend: {
        baseUrl: baseUrl,
  // WARNING: This exposes a function key to the client. Ensure you accept
  // this tradeoff or prefer a server-side proxy to avoid secrets in the browser.
  functionKey: functionKey || ''
      }
    }
  };
};
