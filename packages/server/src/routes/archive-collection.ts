import { Router } from 'express';

interface ArchiveRequest {
  collection: string;
  repoUrl: string;
  repoName: string;
  analysisId: string;
  username: string;
  timestamp: string;
  metadata: any;
}

export const archiveCollectionRouter = Router();

archiveCollectionRouter.post('/', async (req, res) => {
  const token = process.env.GH_WORKFLOW_TOKEN;
  const repoSlug = process.env.ARCHIVE_REPO_SLUG || 'Template-Doctor/centralized-collections-archive';
  if (!token) return res.status(500).json({ error: 'Server misconfiguration: GH_WORKFLOW_TOKEN missing' });

  const { collection, repoUrl, repoName, analysisId, username, timestamp, metadata } = (req.body || {}) as ArchiveRequest;
  if (!collection || !repoUrl || !repoName || !analysisId || !username || !timestamp || !metadata) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const safe = (s: string) => String(s).replace(/[^a-z0-9\-]/gi, '-').toLowerCase();
  const safeCollection = safe(collection);
  const safeRepo = safe(repoName);
  const safeId = safe(analysisId);
  const branchName = `archive-${safeCollection}-${Date.now()}`;
  const baseRef = 'heads/main';
  const archivePath = `${safeCollection}/${safeRepo}/${timestamp}-${username}-${safeId}.json`;
  const content = Buffer.from(JSON.stringify({ collection: safeCollection, repoUrl, repoName, analysisId, username, timestamp, metadata }, null, 2)).toString('base64');

  // 1. Get base ref SHA
  const refRes = await fetch(`https://api.github.com/repos/${repoSlug}/git/ref/${baseRef}`, { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } });
  if (!refRes.ok) {
    return res.status(refRes.status).json({ error: 'Failed to get base ref', details: await refRes.text() });
  }
  const refJson: any = await refRes.json();
  const baseSha = refJson.object?.sha;

  // 2. Create branch
  const createRefRes = await fetch(`https://api.github.com/repos/${repoSlug}/git/refs`, { method: 'POST', headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha }) });
  if (!createRefRes.ok) {
    return res.status(createRefRes.status).json({ error: 'Failed to create branch', details: await createRefRes.text() });
  }

  // 3. Create content
  const putRes = await fetch(`https://api.github.com/repos/${repoSlug}/contents/${encodeURIComponent(archivePath)}`, { method: 'PUT', headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Add archive entry for ${repoName} in ${safeCollection}`, content, branch: branchName }) });
  if (!putRes.ok) {
    return res.status(putRes.status).json({ error: 'Failed to create content', details: await putRes.text() });
  }

  // 4. Create PR
  const prRes = await fetch(`https://api.github.com/repos/${repoSlug}/pulls`, { method: 'POST', headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `Archive ${repoName} analysis to ${safeCollection}`, head: branchName, base: 'main', body: `This PR archives analysis metadata for ${repoUrl} under ${archivePath}.` }) });
  if (!prRes.ok) {
    const code = prRes.status || 500;
    return res.status(code).json({ error: 'Failed to create PR', details: await prRes.text() });
  }
  const prJson: any = await prRes.json();
  return res.status(200).json({ success: true, prUrl: prJson.html_url, branch: branchName, path: archivePath });
});

archiveCollectionRouter.options('/', (_req, res) => res.sendStatus(204));
