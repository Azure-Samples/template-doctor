import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

export async function validationCallbackHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    };
  }

  try {
    const body = await request.json() as { 
      runId: string; 
      githubRunId: string; 
      status?: string; 
      result?: any 
    };
    const { runId, githubRunId, status, result } = body || {};

    if (!runId || !githubRunId) {
      return {
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        jsonBody: { error: "runId and githubRunId are required" }
      };
    }

    const runUrl = `https://github.com/${process.env.GITHUB_REPOSITORY || "Template-Doctor/template-doctor"}/actions/runs/${githubRunId}`;

    // Stateless callback: we don't persist server-side anymore.
    // This endpoint simply validates and acknowledges the callback so clients/logs can trace it.
    context.log('validation-callback received', { runId, githubRunId, status, result });

    // Set a cookie so the frontend can start polling without passing runId around.
    // Note: Do not mark HttpOnly so client-side JS can access it if needed.
    // SameSite=Lax allows redirects/back navigations; Path=/ to be available site-wide.
    const cookie = `td_runId=${encodeURIComponent(runId)}; Path=/; Max-Age=86400; SameSite=Lax`;

    return {
      status: 200,
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Set-Cookie': cookie
      },
      jsonBody: {
        message: "Mapping updated",
        runId,
        githubRunId,
        githubRunUrl: runUrl
      }
    };
  } catch (err: any) {
    context.log("validation-callback error:", err);
    return {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      jsonBody: { error: err.message }
    };
  }
}

// registration moved to barrel index.ts