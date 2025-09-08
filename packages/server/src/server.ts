import express from 'express';
import { applyCoreMiddleware } from './middleware/core.js';
import { apiRouter } from './routes/index.js';

export function createApp() {
  const app = express();
  applyCoreMiddleware(app);
  app.use('/v4', apiRouter); // pure versioned mount
  // Back-compat: if frontend still expects /api/v4
  app.use('/api/v4', apiRouter);
  // Health root
  app.get('/', (_req, res) => res.json({ ok: true }));
  return app;
}
