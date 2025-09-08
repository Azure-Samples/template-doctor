import { Router } from 'express';
import { forkRepository } from '../services/github.js';

export const repoForkRouter = Router();

repoForkRouter.post('/', async (req, res) => {
  const { sourceOwner, sourceRepo, targetOwner, waitForReady = true } = req.body || {};
  if (!sourceOwner || !sourceRepo) return res.status(400).json({ error: 'Missing required: sourceOwner, sourceRepo' });
  try {
    const result = await forkRepository({ sourceOwner, sourceRepo, targetOwner, waitForReady });
    return res.status(result.status).json(result.body);
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Fork failed' });
  }
});

repoForkRouter.options('/', (_req, res) => res.sendStatus(204));
