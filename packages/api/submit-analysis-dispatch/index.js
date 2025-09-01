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

    // Determine target repo (prefer owner/name first, then GITHUB_REPOSITORY, then optional overrides)
    const owner = process.env.GITHUB_REPO_OWNER;
    const name = process.env.GITHUB_REPO_NAME;
    const repoSlug =
      (owner && name ? `${owner}/${name}` : null) ||
      process.env.GITHUB_REPOSITORY ||
      process.env.GITHUB_ACTION_REPO ||
      process.env.TD_GITHUB_ACTION_REPO ||
      `${process.env.GITHUB_REPO_OWNER || 'Template-Doctor'}/${process.env.GITHUB_REPO_NAME || 'template-doctor'}`;
    const apiUrl = `https://api.github.com/repos/${repoSlug}/dispatches`;

    const body = req.body || {};
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

    context.res = { status: 204, headers };
  } catch (e) {
    context.res = { status: 500, headers, body: { error: e.message } };
  }
};
