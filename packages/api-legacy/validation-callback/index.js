module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    };
    return;
  }

  try {
    const { runId, githubRunId, status, result } = req.body || {};

    if (!runId || !githubRunId) {
      context.res = {
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: { error: "runId and githubRunId are required" }
      };
      return;
    }

    const runUrl = `https://github.com/${process.env.GITHUB_REPOSITORY || "Template-Doctor/template-doctor"}/actions/runs/${githubRunId}`;

    // Stateless callback: we don't persist server-side anymore.
    // This endpoint simply validates and acknowledges the callback so clients/logs can trace it.
    context.log('validation-callback received', { runId, githubRunId, status, result });

  // Set a cookie so the frontend can start polling without passing runId around.
  // Note: Do not mark HttpOnly so client-side JS can access it if needed.
  // SameSite=Lax allows redirects/back navigations; Path=/ to be available site-wide.
  // TODO(security-hardening): Consider setting HttpOnly on this cookie and moving polling
  // to a server-side proxy endpoint so the client never handles the identifier directly.
  // That approach improves tamper resistance at the cost of additional server hops.
    const cookie = `td_runId=${encodeURIComponent(runId)}; Path=/; Max-Age=86400; SameSite=Lax`;

    context.res = {
      status: 200,
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Set-Cookie': cookie
      },
      body: {
        message: "Mapping updated",
        runId,
        githubRunId,
        githubRunUrl: runUrl
      }
    };
  } catch (err) {
    context.log.error("template-callback error:", err);
    context.res = {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: { error: err.message }
    };
  }
};
