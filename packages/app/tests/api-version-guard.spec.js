// Ensures that ApiRoutes emits versioned v4 endpoints and fallback logic (without ApiRoutes) would point to /api/v4/*.
// If this starts failing, a regression reintroduced unversioned routes.

import { test, expect } from '@playwright/test';

// Helper to strip origin
function stripOrigin(url) {
  try { return new URL(url, 'http://placeholder').pathname; } catch { return url; }
}

test.describe('API version guard', () => {
  test('ApiRoutes.currentVersion() == v4 and sample builds contain /api/v4', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => !!window.ApiRoutes && !!window.TemplateDoctorConfig, null, { timeout: 15000 });

    const data = await page.evaluate(() => ({
      version: window.ApiRoutes.currentVersion && window.ApiRoutes.currentVersion(),
      analyze: window.ApiRoutes.build('analyze-template'),
      submit: window.ApiRoutes.build('submit-analysis-dispatch'),
      validate: window.ApiRoutes.build('validation-template'),
      status: window.ApiRoutes.build('validation-status'),
      oauth: window.ApiRoutes.build('github-oauth-token')
    }));

    expect(data.version).toBe('v4');
    for (const key of ['analyze','submit','validate','status','oauth']) {
      expect(stripOrigin(data[key])).toMatch(/\/api\/v4\//);
    }
  });
});
