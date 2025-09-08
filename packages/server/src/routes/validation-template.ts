import { Router } from 'express';
import crypto from 'crypto';
import { workflowDispatch } from '../services/github.js';

export const validationTemplateRouter = Router();

validationTemplateRouter.post('/', async (req, res) => {
  try {
    const { targetRepoUrl, callbackUrl } = req.body || {};
    if (!targetRepoUrl) {
      return res.status(400).json({ error: 'targetRepoUrl is required' });
    }
    const runId = crypto.randomUUID();
    const owner = 'Template-Doctor';
    const repo = 'template-doctor';
    const workflowFile = 'validation-template.yml';
    const token = process.env.GH_WORKFLOW_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'Missing GH_WORKFLOW_TOKEN app setting' });
    }
    const dispatchRes = await workflowDispatch({
      owner,
      repo,
      workflowFile,
      ref: 'main',
      inputs: {
        target_validate_template_url: targetRepoUrl,
        callback_url: callbackUrl || '',
        run_id: runId,
        customValidators: 'azd-up,azd-down'
      },
      token
    });
    if (!dispatchRes.ok) {
      const errText = await dispatchRes.text();
      return res.status(500).json({ error: `GitHub dispatch failed: ${dispatchRes.status} ${dispatchRes.statusText} - ${errText}` });
    }
    return res.status(200).json({ runId, message: 'Workflow triggered successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

validationTemplateRouter.options('/', (_req, res) => {
  res.sendStatus(204);
});
