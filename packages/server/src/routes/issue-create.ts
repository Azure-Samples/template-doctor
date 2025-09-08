import { Router } from 'express';
import { createOctokit, ensureLabels } from '../services/github.js';

export const issueCreateRouter = Router();

issueCreateRouter.post('/', async (req, res) => {
  const token = process.env.GH_WORKFLOW_TOKEN;
  if (!token) return res.status(500).json({ error: 'Server misconfiguration: missing GH_WORKFLOW_TOKEN' });
  const { owner, repo, title, body: issueBody, labels = [], assignCopilot = false, childIssues = [] } = req.body || {};
  if (!owner || !repo || !title) return res.status(400).json({ error: 'Missing required: owner, repo, title' });
  const octokit = createOctokit(token);
  // Ensure labels
  const { ensured, created } = await ensureLabels(octokit, owner, repo, Array.isArray(labels) ? labels : []);
  // Create main issue
  let issueNumber: number | undefined; let issueUrl: string | undefined;
  try {
    const issueResp = await octokit.issues.create({ owner, repo, title, body: issueBody, labels: ensured });
    issueNumber = issueResp.data.number; issueUrl = issueResp.data.html_url;
  } catch (err: any) {
    return res.status(502).json({ error: 'Failed to create issue', details: err?.message });
  }
  // Optional copilot assignment
  let copilotAssigned: boolean | undefined;
  if (assignCopilot && issueNumber) {
    try { await octokit.issues.addAssignees({ owner, repo, issue_number: issueNumber, assignees: ['github-copilot'] }); copilotAssigned = true; }
    catch { copilotAssigned = false; }
  }
  // Child issues
  const childResults: { title: string; issueNumber?: number; error?: string }[] = [];
  if (issueNumber && Array.isArray(childIssues) && childIssues.length) {
    const CONC = 4; let idx = 0;
    const run = async () => {
      while (idx < childIssues.length) {
        const c = childIssues[idx++]; if (!c?.title) continue;
  const childLabels = Array.isArray(c.labels) ? c.labels.filter((l: any) => typeof l === 'string') : [];
        // Ensure child labels quickly (best-effort)
        for (const l of childLabels) {
          try { await (octokit as any).issues.getLabel({ owner, repo, name: l }); }
          catch (e: any) { if (e?.status === 404) { try { await (octokit as any).issues.createLabel({ owner, repo, name: l, color: 'cccccc' }); } catch {} } }
        }
        try {
          const r = await octokit.issues.create({ owner, repo, title: c.title, body: c.body, labels: childLabels });
          childResults.push({ title: c.title, issueNumber: r.data.number });
        } catch (e: any) {
          childResults.push({ title: c.title, error: e?.message || 'Failed to create child issue' });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONC, childIssues.length) }, () => run()));
  }

  return res.status(201).json({
    issueNumber,
    htmlUrl: issueUrl,
    labelsEnsured: ensured,
    labelsCreated: created,
    copilotAssigned,
    childResults: childResults.length ? childResults : undefined
  });
});

issueCreateRouter.options('/', (_req, res) => res.sendStatus(204));
