import { Router } from 'express';

// Lightweight operational endpoint to introspect feature toggles without exposing secrets.
// Optional simple bearer token auth via HEALTH_ENV_TOKEN to avoid public disclosure.

export const healthEnvRouter = Router();

healthEnvRouter.get('/', (req, res) => {
  const requiredToken = process.env.HEALTH_ENV_TOKEN;
  if (requiredToken) {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ') || auth.slice(7) !== requiredToken) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }

  const bool = (v?: string) => !!v && v !== 'false' && v !== '0';

  const payload = {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    serveFrontend: process.env.SERVE_FRONTEND === 'true',
    features: {
      archive: bool(process.env.TD_ARCHIVE_ENABLED || process.env.ARCHIVE_ENABLED),
      autoSaveResults: bool(process.env.AUTO_SAVE_RESULTS || process.env.TD_AUTO_SAVE_RESULTS),
      requireAuthForResults: bool(process.env.REQUIRE_AUTH_FOR_RESULTS || process.env.TD_REQUIRE_AUTH_FOR_RESULTS),
    },
    defaults: {
      defaultRuleSet: process.env.DEFAULT_RULE_SET || process.env.TD_DEFAULT_RULE_SET || '',
      dispatchTargetRepo: process.env.DISPATCH_TARGET_REPO || process.env.TD_DISPATCH_TARGET_REPO || '',
    },
    tokens: {
      // Only expose presence/absence, never actual values.
      ghWorkflowToken: !!process.env.GH_WORKFLOW_TOKEN,
      githubClientSecret: !!process.env.GITHUB_CLIENT_SECRET,
      githubAnalyzerToken: !!process.env.GITHUB_TOKEN_ANALYZER,
    },
    deprecatedModelsCount: (process.env.DEPRECATED_MODELS || '').split(',').filter(Boolean).length,
    version: 'v4'
  } as const;

  return res.status(200).json(payload);
});
