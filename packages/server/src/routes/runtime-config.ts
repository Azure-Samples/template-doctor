import { Router } from 'express';

export const runtimeConfigRouter = Router();

runtimeConfigRouter.get('/', (_req, res) => {
  const baseUrl = process.env.TD_BACKEND_BASE_URL || process.env.BACKEND_BASE_URL || '';
  const functionKey = process.env.TD_BACKEND_FUNCTION_KEY || process.env.BACKEND_FUNCTION_KEY || '';
  const githubClientId = process.env.GITHUB_CLIENT_ID || '';
  const defaultRuleSet = process.env.DEFAULT_RULE_SET || process.env.TD_DEFAULT_RULE_SET || '';
  const requireAuthForResults = process.env.REQUIRE_AUTH_FOR_RESULTS || process.env.TD_REQUIRE_AUTH_FOR_RESULTS || '';
  const autoSaveResults = process.env.AUTO_SAVE_RESULTS || process.env.TD_AUTO_SAVE_RESULTS || '';
  const archiveEnabled = process.env.TD_ARCHIVE_ENABLED || process.env.ARCHIVE_ENABLED || '';
  const archiveCollection = process.env.TD_ARCHIVE_COLLECTION || process.env.ARCHIVE_COLLECTION || '';
  const dispatchTargetRepo = process.env.DISPATCH_TARGET_REPO || process.env.TD_DISPATCH_TARGET_REPO || '';

  res.status(200).json({
    GITHUB_CLIENT_ID: githubClientId,
    backend: {
      baseUrl: baseUrl,
      functionKey: functionKey || '',
      apiVersion: 'v4'
    },
    DISPATCH_TARGET_REPO: dispatchTargetRepo,
    DEFAULT_RULE_SET: defaultRuleSet,
    REQUIRE_AUTH_FOR_RESULTS: requireAuthForResults,
    AUTO_SAVE_RESULTS: autoSaveResults,
    ARCHIVE_ENABLED: archiveEnabled,
    ARCHIVE_COLLECTION: archiveCollection
  });
});
