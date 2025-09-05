import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

export async function runtimeConfigHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (request.method === 'OPTIONS') {
    return { status: 204, headers };
  }

  // Pick up env from SWA configuration / Function App settings
  const baseUrl = process.env.TD_BACKEND_BASE_URL || process.env.BACKEND_BASE_URL || '';
  const functionKey = process.env.TD_BACKEND_FUNCTION_KEY || process.env.BACKEND_FUNCTION_KEY || '';
  
  // GitHub OAuth settings from environment
  const githubClientId = process.env.GITHUB_CLIENT_ID || '';

  // GitHub Action dispatch target is server-side only now; no longer exposed to client

  // Frontend behavior overrides
  const defaultRuleSet = process.env.DEFAULT_RULE_SET || process.env.TD_DEFAULT_RULE_SET || '';
  const requireAuthForResults = process.env.REQUIRE_AUTH_FOR_RESULTS || process.env.TD_REQUIRE_AUTH_FOR_RESULTS || '';
  const autoSaveResults = process.env.AUTO_SAVE_RESULTS || process.env.TD_AUTO_SAVE_RESULTS || '';
  // Centralized archive settings
  const archiveEnabled = process.env.TD_ARCHIVE_ENABLED || process.env.ARCHIVE_ENABLED || '';
  const archiveCollection = process.env.TD_ARCHIVE_COLLECTION || process.env.ARCHIVE_COLLECTION || '';
  // Optional: specify the exact repo (owner/repo) that hosts the workflow to dispatch to
  const dispatchTargetRepo = process.env.DISPATCH_TARGET_REPO || process.env.TD_DISPATCH_TARGET_REPO || '';

  return {
    status: 200,
    headers,
    jsonBody: {
      GITHUB_CLIENT_ID: githubClientId,
      backend: {
        baseUrl: baseUrl,
        // WARNING: This exposes a function key to the client. Ensure you accept
        // this tradeoff or prefer a server-side proxy to avoid secrets in the browser.
        functionKey: functionKey || ''
      },
      DISPATCH_TARGET_REPO: dispatchTargetRepo,
      DEFAULT_RULE_SET: defaultRuleSet,
      REQUIRE_AUTH_FOR_RESULTS: requireAuthForResults,
      AUTO_SAVE_RESULTS: autoSaveResults,
      ARCHIVE_ENABLED: archiveEnabled,
      ARCHIVE_COLLECTION: archiveCollection
    }
  };
}

// Register the function with Azure Functions
app.http('runtime-config', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'api/v4/client-settings',
  handler: runtimeConfigHandler
});