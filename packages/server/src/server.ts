import express from 'express';
import { applyCoreMiddleware } from './middleware/core.js';
import { apiRouter } from './routes/index.js';
import path from 'path';
import fs from 'fs';

export function createApp() {
  const app = express();
  applyCoreMiddleware(app);
  app.use('/v4', apiRouter); // pure versioned mount
  // Back-compat: if frontend still expects /api/v4
  app.use('/api/v4', apiRouter);
  // Health root
  app.get('/health', (_req, res) => res.json({ ok: true }));

  // Optional static hosting of built frontend when SERVE_FRONTEND=true
  if (process.env.SERVE_FRONTEND === 'true') {
    const frontendDir = process.env.FRONTEND_DIST_PATH
      ? path.resolve(process.cwd(), process.env.FRONTEND_DIST_PATH)
      : path.resolve(process.cwd(), 'public');
    if (fs.existsSync(frontendDir)) {
      console.log('[server] Serving static frontend from', frontendDir); // eslint-disable-line no-console
      app.use(express.static(frontendDir));
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/v4') || req.path.startsWith('/api/')) return next();
        const indexPath = path.join(frontendDir, 'index.html');
        if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
        return next();
      });
    } else {
      console.warn('[server] SERVE_FRONTEND requested but directory not found:', frontendDir); // eslint-disable-line no-console
    }
  } else {
    // Minimal root for non-front-end mode
    app.get('/', (_req, res) => res.json({ ok: true, frontend: false }));
  }
  return app;
}
