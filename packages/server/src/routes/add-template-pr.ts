import { Router } from 'express';
import { randomUUID } from 'crypto';
import { createOctokit } from '../services/github.js';

// Mirrors legacy Azure Function add-template-pr semantics / JSON shape.
export const addTemplatePrRouter = Router();

addTemplatePrRouter.post('/', async (req, res) => {
  const { repoUrl, analysis, repoCategory } = req.body || {};
  if (!repoUrl || !analysis) return res.status(400).json({ error: 'Missing required fields in request body' });

  const token = process.env.GH_WORKFLOW_TOKEN;
  if (!token) return res.status(500).json({ error: 'GitHub token not configured' });

  // Determine target repository (owner/repo) preference order.
  let owner = process.env.GITHUB_REPO_OWNER;
  let repo = process.env.GITHUB_REPO_NAME;
  if (!owner || !repo) {
    const repoSlug = process.env.GITHUB_REPOSITORY || 'Template-Doctor/template-doctor';
    [owner, repo] = repoSlug.split('/');
  }
  const targetBranch = process.env.GITHUB_REPO_BRANCH || 'main';

  // Extract template owner/repo from provided URL.
  const urlPattern = /github\.com\/([^/]+)\/([^/]+)/i;
  const match = repoUrl.match(urlPattern);
  if (!match) return res.status(400).json({ error: 'Invalid GitHub repository URL format' });
  const [, templateOwner, templateRepo] = match;

  const branchName = `add-template-${randomUUID().slice(0,8)}`; // keep short like legacy.

  const octokit = createOctokit(token);

  // 1. Get base branch ref
  let baseSha: string | undefined;
  try {
    const refData: any = await octokit.git.getRef({ owner, repo, ref: `heads/${targetBranch}` });
    baseSha = refData.data.object.sha;
  } catch (e: any) {
    return res.status(500).json({ error: `Failed to locate base branch: ${e?.message}` });
  }

  // 2. Create new branch
  try {
    await octokit.git.createRef({ owner, repo, ref: `refs/heads/${branchName}`, sha: baseSha! });
  } catch (e: any) {
    return res.status(500).json({ error: `Failed to create branch: ${e?.message}` });
  }

  // 3. Create template file contents
  const filename = `templates/${templateRepo}-${templateOwner}.json`;
  const templateData = { url: repoUrl, category: repoCategory || 'uncategorized', analysis };
  const contentB64 = Buffer.from(JSON.stringify(templateData, null, 2)).toString('base64');

  const safeDeleteBranch = async () => {
    try { await octokit.git.deleteRef({ owner, repo, ref: `heads/${branchName}` }); } catch {}
  };

  try {
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filename,
      message: `Add template: ${templateOwner}/${templateRepo}`,
      content: contentB64,
      branch: branchName
    });
  } catch (e: any) {
    await safeDeleteBranch();
    return res.status(500).json({ error: `Failed to create template file: ${e?.message}` });
  }

  // 4. Create Pull Request
  try {
    const prResp: any = await octokit.pulls.create({
      owner,
      repo,
      title: `Add template: ${templateOwner}/${templateRepo}`,
      body: `This PR adds a new template from ${repoUrl} to the template collection.\n\n## Template Details\n- Repository: ${templateOwner}/${templateRepo}\n- Category: ${repoCategory || 'uncategorized'}\n- Added via Template Doctor\n\n## Analysis Summary\n${JSON.stringify(analysis, null, 2)}`,
      head: branchName,
      base: targetBranch
    });
    return res.status(201).json({ success: true, prUrl: prResp.data.html_url, prNumber: prResp.data.number, branch: branchName });
  } catch (e: any) {
    await safeDeleteBranch();
    return res.status(500).json({ error: `Failed to create pull request: ${e?.message}` });
  }
});

addTemplatePrRouter.options('/', (_req, res) => res.sendStatus(204));
