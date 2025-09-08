import { Router } from 'express';
import { dispatchRepositoryEvent } from '../services/github.js';

interface DispatchRequest {
  event_type: string;
  client_payload: {
    targetRepo?: string;
    repoSlug?: string;
    [key: string]: any;
  };
}

export const submitAnalysisDispatchRouter = Router();

submitAnalysisDispatchRouter.post('/', async (req, res) => {
  try {
    const token = process.env.GH_WORKFLOW_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'Server misconfiguration: GH_WORKFLOW_TOKEN missing' });
    }
    const body = req.body as DispatchRequest;
    if (!body?.event_type || !body?.client_payload) {
      return res.status(400).json({ error: 'Missing event_type or client_payload' });
    }
    const cp = body.client_payload || {};
    const fromPayload = (typeof cp.targetRepo === 'string' && cp.targetRepo) || (typeof cp.repoSlug === 'string' && cp.repoSlug) || '';
    let repoSlug = fromPayload || process.env.GH_TARGET_REPO || process.env.GITHUB_REPOSITORY || 'Template-Doctor/template-doctor';
    if (typeof repoSlug !== 'string' || !repoSlug.includes('/')) {
      repoSlug = 'Template-Doctor/template-doctor';
    }
    const ghRes = await dispatchRepositoryEvent({ repoSlug, event_type: body.event_type, client_payload: body.client_payload, token });
    if (!ghRes.ok) {
      const txt = await ghRes.text();
      return res.status(ghRes.status).json({ error: 'GitHub dispatch failed', status: ghRes.status, details: txt });
    }
    res.setHeader('x-template-doctor-repo-slug', repoSlug);
    return res.status(204).send();
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

submitAnalysisDispatchRouter.options('/', (_req, res) => {
  res.sendStatus(204);
});
