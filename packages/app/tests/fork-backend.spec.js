import { test, expect } from '@playwright/test';
import { enableBackendMigration, reaffirmBackendMigration, ensureApiClientReady } from './utils/feature-flags.js';

test.describe('Backend Fork Flow', () => {
  test('forks repository via backend', async ({ page }) => {
    // Ensure feature flag before scripts load
    await enableBackendMigration(page);

    // Mock backend fork endpoint (cover both /v4 and /api/v4 forms)
    const successPayload = {
      forkOwner: 'user',
      repo: 'repo',
      htmlUrl: 'https://github.com/user/repo',
      ready: true,
      attemptedCreate: true
    };
    const handler = route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(successPayload) });
    await page.route('**/v4/repo-fork', handler);
    await page.route('**/api/v4/repo-fork', handler);

  await page.goto('/');
  await ensureApiClientReady(page);
  await reaffirmBackendMigration(page);

    const respPromise = page.waitForResponse(r => r.url().includes('/v4/repo-fork') && r.status() === 200);
    const res = await page.evaluate(async () => {
      return await window.TemplateDoctorApiClient.forkRepository({ sourceOwner: 'example', sourceRepo: 'repo' });
    });
    await respPromise;

    expect(res.ready).toBe(true);
    expect(res.forkOwner).toBe('user');
    expect(res.repo).toBe('repo');
    expect(res.htmlUrl).toContain('github.com/user/repo');
  });
});
