import { Router } from 'express';

export const validationCallbackRouter = Router();

validationCallbackRouter.post('/', async (req, res) => {
  try {
    const { runId, githubRunId } = req.body || {};
    if (!runId || !githubRunId) {
      return res.status(400).json({ error: 'runId and githubRunId are required' });
    }
    const runUrl = `https://github.com/${process.env.GITHUB_REPOSITORY || 'Template-Doctor/template-doctor'}/actions/runs/${githubRunId}`;
    const cookie = `td_runId=${encodeURIComponent(runId)}; Path=/; Max-Age=86400; SameSite=Lax`;
    res.setHeader('Set-Cookie', cookie);
    return res.status(200).json({ message: 'Mapping updated', runId, githubRunId, githubRunUrl: runUrl });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

validationCallbackRouter.options('/', (_req, res) => {
  res.sendStatus(204);
});
