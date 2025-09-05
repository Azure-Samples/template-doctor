const fetch = global.fetch;

// Creates or updates a file in the centralized archive repo and opens a PR
// Expects JSON body: { collection, repoUrl, repoName, analysisId, username, timestamp, metadata }
// Env: ARCHIVE_REPO_SLUG (default Template-Doctor/centralized-collections-archive), GH_WORKFLOW_TOKEN
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
    const repoSlug = process.env.ARCHIVE_REPO_SLUG || 'Template-Doctor/centralized-collections-archive';
    if (!token) {
      context.res = { status: 500, headers, body: { error: 'Server misconfiguration: GH_WORKFLOW_TOKEN missing' } };
      return;
    }

    const body = req.body || {};
    const { collection, repoUrl, repoName, analysisId, username, timestamp, metadata } = body;
    if (!collection || !repoUrl || !repoName || !analysisId || !username || !timestamp || !metadata) {
      context.res = { status: 400, headers, body: { error: 'Missing required fields' } };
      return;
    }

    const safeCollection = String(collection).replace(/[^a-z0-9\-]/gi, '-').toLowerCase();
    const safeRepo = String(repoName).replace(/[^a-z0-9\-]/gi, '-').toLowerCase();
    const safeId = String(analysisId).replace(/[^a-z0-9\-]/gi, '-').toLowerCase();

    const branchName = `archive-${safeCollection}-${Date.now()}`;
    const baseRef = 'heads/main';
    const archivePath = `${safeCollection}/${safeRepo}/${timestamp}-${username}-${safeId}.json`;
    const content = Buffer.from(JSON.stringify({
      collection: safeCollection,
      repoUrl,
      repoName,
      analysisId,
      username,
      timestamp,
      metadata
    }, null, 2)).toString('base64');

    // 1) Get default branch SHA (main)
    const refRes = await fetch(`https://api.github.com/repos/${repoSlug}/git/ref/${baseRef}`, {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
    });
    if (!refRes.ok) {
      const err = await refRes.text();
      context.res = { status: refRes.status, headers, body: { error: 'Failed to get base ref', details: err } };
      return;
    }
    const refJson = await refRes.json();
    const baseSha = refJson.object && refJson.object.sha;

    // 2) Create branch
    const createRefRes = await fetch(`https://api.github.com/repos/${repoSlug}/git/refs`, {
      method: 'POST',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha })
    });
    if (!createRefRes.ok) {
      const err = await createRefRes.text();
      context.res = { status: createRefRes.status, headers, body: { error: 'Failed to create branch', details: err } };
      return;
    }

    // 3) Put file on new branch
    const putRes = await fetch(`https://api.github.com/repos/${repoSlug}/contents/${encodeURIComponent(archivePath)}`, {
      method: 'PUT',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Add archive entry for ${repoName} in ${safeCollection}`,
        content,
        branch: branchName
      })
    });
    if (!putRes.ok) {
      const err = await putRes.text();
      context.res = { status: putRes.status, headers, body: { error: 'Failed to create content', details: err } };
      return;
    }

    // 4) Create PR
    const prRes = await fetch(`https://api.github.com/repos/${repoSlug}/pulls`, {
      method: 'POST',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Archive ${repoName} analysis to ${safeCollection}`,
        head: branchName,
        base: 'main',
        body: `This PR archives analysis metadata for ${repoUrl} under ${archivePath}.`
      })
    });
    if (!prRes.ok) {
      const err = await prRes.text();
      context.res = { status: prRes.status, headers, body: { error: 'Failed to create PR', details: err } };
      return;
    }

    const prJson = await prRes.json();
    context.res = { status: 200, headers, body: { success: true, prUrl: prJson.html_url, branch: branchName, path: archivePath } };
  } catch (e) {
    context.res = { status: 500, headers, body: { error: e.message } };
  }
};
