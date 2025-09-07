import { test, expect } from '@playwright/test';
import { enableBackendMigration, reaffirmBackendMigration, ensureApiClientReady } from './utils/feature-flags.js';

// Positive path: backend returns successful fork metadata (simulated) and notification should not be warning.
test.describe('Fork flow - success path', () => {
  test('returns structured fork response (no SAML)', async ({ page }) => {
    await enableBackendMigration(page);

    const successPayload = {
      forkOwner: 'tester',
      repo: 'sample-repo',
      htmlUrl: 'https://github.com/tester/sample-repo',
      ready: true,
      attemptedCreate: true
    };
    const handler = async route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(successPayload) });
    await page.route('**/v4/repo-fork', handler);
    await page.route('**/api/v4/repo-fork', handler);

  await page.goto('/');
  await ensureApiClientReady(page);
  await reaffirmBackendMigration(page);

    const respPromise = page.waitForResponse(r => r.url().includes('/v4/repo-fork') && r.status() === 200);
    await page.evaluate(async () => {
      const res = await window.TemplateDoctorApiClient.forkRepository({ sourceOwner: 'any', sourceRepo: 'sample-repo' });
      window.__forkOk = res;
    });
    await respPromise;

    await expect.poll(() => page.evaluate(() => window.__forkOk?.ready === true)).toBeTruthy();
    await expect.poll(() => page.evaluate(() => window.__forkOk?.htmlUrl || '')).toContain('tester/sample-repo');

    // Ensure no SAML warning notification appeared
    const warning = page.locator('.notification.warning');
    await expect(warning).toHaveCount(0);
  });
});
