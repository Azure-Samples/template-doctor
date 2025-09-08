import { Router } from 'express';
import { createOctokit, listRecentWorkflowRuns, listRepoWorkflowRuns, getWorkflowRun } from '../services/github.js';

export const validationStatusRouter = Router();

validationStatusRouter.get('/', async (req, res) => {
  const runId = String(req.query.runId || req.query.localRunId || '');
  if (!runId) return res.status(400).json({ error: 'Missing required parameter: runId' });
  let githubRunId = String(req.query.githubRunId || '');
  const githubRunUrl = String(req.query.githubRunUrl || '');
  if (!githubRunId && githubRunUrl) {
    const m = githubRunUrl.match(/\/actions\/runs\/(\d+)/); if (m) githubRunId = m[1];
  }
  let owner = process.env.GITHUB_REPO_OWNER;
  let repo = process.env.GITHUB_REPO_NAME;
  if (!owner || !repo) { const slug = process.env.GITHUB_REPOSITORY || 'Template-Doctor/template-doctor'; [owner, repo] = slug.split('/'); }
  const branch = process.env.GITHUB_REPO_BRANCH || 'main';
  const workflowFile = process.env.GITHUB_WORKFLOW_FILE || 'validation-template.yml';
  const token = process.env.GH_WORKFLOW_TOKEN; // Optional (public) but expected for private
  const octokit = createOctokit(token || undefined);

  // Correlate if githubRunId missing
  if (!githubRunId) {
    const direct = await listRecentWorkflowRuns(octokit, { owner, repo, workflowFile, branch });
    let found: any | undefined = direct.find(r => (r.display_title && r.display_title.includes(runId)) || (r.head_commit?.message || '').includes(runId));
    if (!found) {
      const all = await listRepoWorkflowRuns(octokit, { owner, repo, branch });
      found = all.find(r => (r.display_title && r.display_title.includes(runId)) || (r.head_commit?.message || '').includes(runId));
    }
    if (found) { githubRunId = String(found.id); }
    else {
      return res.status(200).json({ runId, status: 'pending', conclusion: null });
    }
  }

  // Get run
  let ghData: any; try { ghData = await getWorkflowRun(octokit, { owner, repo, runId: Number(githubRunId) }); }
  catch (err: any) {
    const isCred = err?.status === 401; return res.status(isCred ? 502 : 500).json({ error: err?.message, type: isCred ? 'github_api_error' : 'server_error', runId, githubRunId });
  }

  return res.status(200).json({
    runId,
    githubRunId,
    status: ghData.status,
    conclusion: ghData.conclusion,
    runUrl: ghData.html_url,
    startTime: ghData.run_started_at,
    endTime: ghData.updated_at
  });
});

validationStatusRouter.options('/', (_req, res) => res.sendStatus(204));
