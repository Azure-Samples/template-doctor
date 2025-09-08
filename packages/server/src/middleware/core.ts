import express from 'express';

export function applyCoreMiddleware(app: express.Express) {
  app.use(express.json({ limit: '1mb' }));
  // Manual CORS (mirrors Azure Functions style)
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-functions-key');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
}
