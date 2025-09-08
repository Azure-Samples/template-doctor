// Playwright test to simulate SAML 403 fork flow and ensure unified backend path is invoked.
// Assumptions: app served locally with backendMigration feature enabled.
import { test, expect } from '@playwright/test';
import { enableBackendMigration, reaffirmBackendMigration, ensureApiClientReady } from './utils/feature-flags.js';

test.describe('Fork flow - SAML remediation', () => {
  test('surfaces SAML notification when backend returns samlRequired', async ({ page }) => {
    // Inject backend migration + any flags BEFORE navigation
    await page.addInitScript(() => {
      window.TemplateDoctorConfig = { features: { backendMigration: true } };
    });

    // Mock backend response with SAML 403 (covering both potential base path variants)
    const samlPayload = {
      error: 'SAML SSO authorization required to fork this repository',
      samlRequired: true,
      documentationUrl: 'https://docs.github.com/en/enterprise-cloud@latest/organizations/managing-saml-single-sign-on-for-your-organization',
      authorizeUrl: 'https://github.com/orgs/example/sso?authorization_request=xyz'
    };
    const handler = async route => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify(samlPayload) });
    await page.route('**/v4/repo-fork', handler);
    await page.route('**/api/v4/repo-fork', handler);

    await page.goto('/');
    await ensureApiClientReady(page);

    const respPromise = page.waitForResponse(r => r.url().includes('/v4/repo-fork') && r.status() === 403);

    // Invoke fork; ApiClient now RETURNS a structured samlRequired result (does not throw)
    await page.evaluate(async () => {
      const res = await window.TemplateDoctorApiClient.forkRepository({ sourceOwner: 'protected', sourceRepo: 'saml-repo' });
      window.__forkResult = res;
    });

    const resp = await respPromise;
    expect(resp.status()).toBe(403);
    const json = await resp.json();
    expect(json.samlRequired).toBeTruthy();

    // Validate structured result surfaced to page context
    await expect.poll(() => page.evaluate(() => window.__forkResult?.samlRequired === true)).toBeTruthy();

    // Notification assertions
    const warning = page.locator('.notification.warning');
    await expect(warning).toHaveCount(1);
    await expect(warning.first()).toHaveAttribute('role', /alert|status/);
    await expect(warning.first()).toHaveAttribute('aria-live', /assertive|polite/);
    await expect(warning.locator('.notification-title')).toContainText('SAML Authorization Required');
    const actionBtn = warning.locator('.notification-actions .notification-action');
    await expect(actionBtn).toHaveCount(1);
    await expect(actionBtn).toContainText('Authorize SAML');
  });
});
