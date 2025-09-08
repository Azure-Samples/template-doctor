import { test, expect } from '@playwright/test';

// Happy path test for migrated azd-provision module.
// Verifies that triggering runAzdProvisionTest creates log UI, sends start + status requests,
// and logs completion without waiting for long polling intervals.

test.describe('AZD Provision (validation workflow) module', () => {
  test('AZD Provision workflow happy path', async ({ page }) => {
    // Intercept backend calls (module targets localhost:7071 when host is localhost)
    let startCalled = false;
    let statusCalled = false;

    await page.route('http://localhost:7071/api/v4/validation-template', async (route) => {
      startCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ runId: 'RUN123', githubRunId: 42, githubRunUrl: 'https://example.test/run/42', requestId: 'REQ1' }),
      });
    });

    await page.route('http://localhost:7071/api/v4/validation-status*', async (route) => {
      statusCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'completed', conclusion: 'success', githubRunId: 42 }),
      });
    });

    // Pre-inject required globals before any scripts execute
    await page.addInitScript(() => {
      (window as any).reportData = { repoUrl: 'https://github.com/Azure-Samples/azd-template-artifacts' };
      // Minimal Notifications shim to bypass confirm flow
      (window as any).Notifications = {
        loading: (title: string, msg: string) => ({
          success: () => {},
          error: () => {},
          warning: () => {},
          info: () => {},
        }),
        error: () => {},
        confirm: (_t: string, _m: string, opts: any) => { opts?.onConfirm?.(); },
      };
    });

    await page.goto('./index.html');

    // Ensure the TS module graph loaded
    await page.waitForFunction(() => typeof (window as any).testAzdProvision === 'function');

    // Trigger via legacy global (exercises confirm + run path)
    await page.evaluate(() => (window as any).testAzdProvision());

    // Wait for log element to appear and contain start line
    const logEl = page.locator('#azd-provision-logs');
    await expect(logEl).toBeVisible();
    await expect(logEl).toContainText('Validation started');

    // Status should complete quickly
    await expect(logEl).toContainText('completed');

    // Assertions on network interception flags
    expect(startCalled, 'validation-template endpoint was not invoked').toBeTruthy();
    expect(statusCalled, 'validation-status endpoint was not invoked').toBeTruthy();
  });
});
