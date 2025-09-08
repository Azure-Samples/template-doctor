import { Router } from 'express';
import { createBatch, getBatch, simulateBatchProgress } from '../services/batch-store.js';

export const batchScanStartRouter = Router();
export const batchScanStatusRouter = Router();

// POST /v4/batch-scan-start { repos: string[], mode?: string }
batchScanStartRouter.post('/', async (req, res) => {
  const { repos, mode } = req.body || {};
  if (!Array.isArray(repos) || repos.length === 0) return res.status(400).json({ error: 'repos[] required' });
  const sanitized = Array.from(new Set(repos.filter((r: any) => typeof r === 'string' && r.includes('/')))).slice(0, 50);
  if (!sanitized.length) return res.status(400).json({ error: 'No valid repo slugs provided' });
  const batch = createBatch(sanitized, mode);
  // fire-and-forget simulation (no await)
  simulateBatchProgress(batch).catch(()=>{});
  return res.status(202).json({ batchId: batch.batchId, acceptedCount: sanitized.length });
});

batchScanStartRouter.options('/', (_req, res) => res.sendStatus(204));

// GET /v4/batch-scan-status?batchId=...
batchScanStatusRouter.get('/', (req, res) => {
  const batchId = String(req.query.batchId || '');
  if (!batchId) return res.status(400).json({ error: 'batchId required' });
  const batch = getBatch(batchId);
  if (!batch) return res.status(404).json({ error: 'Not found' });
  const completed = batch.items.filter(i => ['done','error','cancelled'].includes(i.status)).length;
  return res.status(200).json({ batchId, created: batch.created, mode: batch.mode, total: batch.items.length, completed, items: batch.items });
});

batchScanStatusRouter.options('/', (_req, res) => res.sendStatus(204));
