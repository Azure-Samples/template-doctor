const fetch = global.fetch;

module.exports = async function (context, req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-functions-key'
  };

  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers };
    return;
  }

  try {
    const token = process.env.GH_WORKFLOW_TOKEN;
    if (!token) {
      context.res = { status: 500, headers, body: { error: 'Server misconfiguration: GH_WORKFLOW_TOKEN missing' } };
      return;
    }

    // Parse request body safely
    const body = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })() : (req.body || {});

    // Determine target repository slug (owner/repo)
    // IMPORTANT: The dispatch must hit the repository that contains the workflow.
    // We DO NOT infer from repoUrl by default (that's the analyzed repo, not the workflow host).
    // Precedence:
    // 1) Explicit override in payload: client_payload.targetRepo or client_payload.repoSlug (owner/repo)
    // 2) Environment: GH_TARGET_REPO, then GITHUB_REPOSITORY (provided by Actions runtime)
    // 3) Default: Template-Doctor/template-doctor
    const cp = body.client_payload || {};
    const fromPayload = (typeof cp.targetRepo === 'string' && cp.targetRepo) || (typeof cp.repoSlug === 'string' && cp.repoSlug) || '';
    let repoSlug = fromPayload || process.env.GH_TARGET_REPO || process.env.GITHUB_REPOSITORY || 'Template-Doctor/template-doctor';
    // Defensive fallback in case something went wrong above
    if (typeof repoSlug !== 'string' || !repoSlug.includes('/')) {
      repoSlug = 'Template-Doctor/template-doctor';
    }
    context.log && context.log(`[submit-analysis-dispatch] Dispatching event '${body.event_type}' to repo '${repoSlug}'`);
    const apiUrl = `https://api.github.com/repos/${repoSlug}/dispatches`;

    if (!body.event_type || !body.client_payload) {
      context.res = { status: 400, headers, body: { error: 'Missing event_type or client_payload' } };
      return;
    }

    const ghRes = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event_type: body.event_type,
        client_payload: body.client_payload
      })
    });

    if (!ghRes.ok) {
      const text = await ghRes.text();
      context.res = { status: ghRes.status, headers, body: { error: 'GitHub dispatch failed', status: ghRes.status, details: text } };
      return;
    }

  // Add debug header so we can verify which repoSlug was used
  const debugHeaders = { ...headers, 'x-template-doctor-repo-slug': repoSlug };
  context.res = { status: 204, headers: debugHeaders };
  } catch (e) {
    context.res = { status: 500, headers, body: { error: e.message } };
  }
};
