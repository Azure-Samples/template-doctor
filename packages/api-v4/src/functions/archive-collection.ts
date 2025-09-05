import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

interface ArchiveRequest {
  collection: string;
  repoUrl: string;
  repoName: string;
  analysisId: string;
  username: string;
  timestamp: string;
  metadata: any;
}

export async function archiveCollectionHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-functions-key'
  };

  if (request.method === 'OPTIONS') {
    return { status: 204, headers };
  }

  try {
    const token = process.env.GH_WORKFLOW_TOKEN;
    const repoSlug = process.env.ARCHIVE_REPO_SLUG || 'Template-Doctor/centralized-collections-archive';
    if (!token) {
      return { 
        status: 500, 
        headers, 
        jsonBody: { error: 'Server misconfiguration: GH_WORKFLOW_TOKEN missing' } 
      };
    }

    const body = await request.json() as ArchiveRequest;
    const { collection, repoUrl, repoName, analysisId, username, timestamp, metadata } = body;
    if (!collection || !repoUrl || !repoName || !analysisId || !username || !timestamp || !metadata) {
      return { 
        status: 400, 
        headers, 
        jsonBody: { error: 'Missing required fields' } 
      };
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
      return { 
        status: refRes.status, 
        headers, 
        jsonBody: { error: 'Failed to get base ref', details: err } 
      };
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
      return { 
        status: createRefRes.status, 
        headers, 
        jsonBody: { error: 'Failed to create branch', details: err } 
      };
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
      return { 
        status: putRes.status, 
        headers, 
        jsonBody: { error: 'Failed to create content', details: err } 
      };
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
      return { 
        status: prRes.status, 
        headers, 
        jsonBody: { error: 'Failed to create PR', details: err } 
      };
    }

    const prJson = await prRes.json();
    return { 
      status: 200, 
      headers, 
      jsonBody: { success: true, prUrl: prJson.html_url, branch: branchName, path: archivePath } 
    };
  } catch (e: any) {
    return { 
      status: 500, 
      headers, 
      jsonBody: { error: e.message } 
    };
  }
}

// Register the function with Azure Functions
app.http('archive-collection', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'api/v4/archive-collection',
  handler: archiveCollectionHandler
});