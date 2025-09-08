import { Router } from 'express';
import { createOctokit, listRecentWorkflowRuns, listRepoWorkflowRuns, cancelWorkflowRun } from '../services/github.js';

export const validationCancelRouter = Router();

validationCancelRouter.post('/', async (req, res) => {
  const { runId, githubRunId: rawGithubRunId } = req.body || {};
  if (!runId && !rawGithubRunId) return res.status(400).json({ error: 'Missing required parameter: runId or githubRunId' });
  let githubRunId: string | undefined = rawGithubRunId;
  let owner = process.env.GITHUB_REPO_OWNER; let repo = process.env.GITHUB_REPO_NAME;
  if (!owner || !repo) { const slug = process.env.GITHUB_REPOSITORY || 'Template-Doctor/template-doctor'; [owner, repo] = slug.split('/'); }
  const branch = process.env.GITHUB_REPO_BRANCH || 'main';
  const workflowFile = process.env.GITHUB_WORKFLOW_FILE || 'validation-template.yml';
  const token = process.env.GH_WORKFLOW_TOKEN;
  if (!token) return res.status(500).json({ error: 'GitHub token not configured' });
  const octokit = createOctokit(token);
  // correlate if needed
  if (!githubRunId && runId) {
    const direct = await listRecentWorkflowRuns(octokit, { owner, repo, workflowFile, branch });
    let found: any = direct.find(r => (r.display_title && r.display_title.includes(runId)) || (r.head_commit?.message || '').includes(runId));
    if (!found) {
      const all = await listRepoWorkflowRuns(octokit, { owner, repo, branch });
      found = all.find(r => (r.display_title && r.display_title.includes(runId)) || (r.head_commit?.message || '').includes(runId));
    }
    if (found) githubRunId = String(found.id);
    else return res.status(404).json({ error: 'Run not found', runId });
  }
  try {
    await cancelWorkflowRun(octokit, { owner, repo, runId: Number(githubRunId) });
    return res.status(200).json({ success: true, message: `Workflow run ${githubRunId} cancelled`, runId, githubRunId });
  } catch (err: any) {
    if (err?.status === 403) return res.status(403).json({ error: 'Permission denied', runId, githubRunId });
    if (err?.status === 404) return res.status(404).json({ error: 'Run not found', runId, githubRunId });
    if (err?.status === 410) return res.status(410).json({ error: 'Run not cancellable', runId, githubRunId });
    return res.status(500).json({ error: 'Failed to cancel workflow run', details: err?.message, runId, githubRunId });
  }
});

validationCancelRouter.options('/', (_req, res) => res.sendStatus(204));
