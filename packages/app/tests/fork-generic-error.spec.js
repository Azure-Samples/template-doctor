import { test, expect } from '@playwright/test';
import { enableBackendMigration, reaffirmBackendMigration, ensureApiClientReady } from './utils/feature-flags.js';

// Ensures a plain 403 without samlRequired propagates as an error (no SAML notification)

test.describe('Fork flow - generic 403 error (non-SAML)', () => {
  test('throws error and does not show SAML notification', async ({ page }) => {
    await enableBackendMigration(page);

    const errorPayload = { error: 'Forbidden to fork repository' };
    const handler = async route => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify(errorPayload) });
    await page.route('**/v4/repo-fork', handler);
    await page.route('**/api/v4/repo-fork', handler);

  await page.goto('/');
  await ensureApiClientReady(page);
  await reaffirmBackendMigration(page);

    const forkCall = page.evaluate(async () => {
      return window.TemplateDoctorApiClient.forkRepository({ sourceOwner: 'any', sourceRepo: 'generic-error' });
    });

    await expect(forkCall).rejects.toThrow(/HTTP 403/);

    // Ensure no SAML warning notification exists
    const warning = page.locator('.notification.warning');
    await expect(warning).toHaveCount(0);
  });
});
