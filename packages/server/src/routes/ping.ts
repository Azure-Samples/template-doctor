import { Router } from 'express';

export const pingRouter = Router();

pingRouter.get('/', (_req, res) => {
  res.status(200).json({ ok: true, service: 'template-doctor', ts: Date.now() });
});
