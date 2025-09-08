import { Router } from 'express';

// Mirrors legacy Azure Function behavior for GitHub OAuth code exchange.
// POST /v4/github-oauth-token  { code }
// Response: { access_token } or { error }
// Adds CORS (already handled globally) and 204 for OPTIONS via server middleware.

export const githubOAuthTokenRouter = Router();

githubOAuthTokenRouter.post('/', async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) {
      return res.status(400).json({ error: 'Missing code' });
    }
    const client_id = process.env.GITHUB_CLIENT_ID;
    const client_secret = process.env.GITHUB_CLIENT_SECRET;
    if (!client_id || !client_secret) {
      return res.status(500).json({ error: 'Missing GitHub OAuth credentials in environment variables' });
    }
    const ghRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ client_id, client_secret, code })
    });
    const data = await ghRes.json().catch(() => ({}));
    if (!ghRes.ok || data.error) {
      return res.status(400).json({ error: data.error_description || 'OAuth error' });
    }
    return res.status(200).json({ access_token: data.access_token });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

githubOAuthTokenRouter.options('/', (_req, res) => res.sendStatus(204));
