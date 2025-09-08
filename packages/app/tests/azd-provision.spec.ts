import { test, expect } from '@playwright/test';

// Helper to mock JSON endpoint with CORS + OPTIONS handling
async function mockJson(page: import('@playwright/test').Page, pattern: string | RegExp, body: any, status = 200) {
  await page.route(pattern, async (route: import('@playwright/test').Route) => {
    const method = route.request().method();
    if (method === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
        'access-control-allow-headers': 'Content-Type, Authorization'
      }});
    }
    await route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(body)
    });
  });
}

// Happy path test for migrated azd-provision module.
// Verifies that triggering runAzdProvisionTest creates log UI, sends start + status requests,
// and logs completion without waiting for long polling intervals.

test.describe('AZD Provision (validation workflow) module', () => {
  // TODO(test): Add a focused test asserting the 'azd-provision-started' CustomEvent dispatch
  // by registering a listener before invoking testAzdProvision and capturing detail payload.
  // Current tests indirectly exercise start path but do not explicitly assert event emission.
  test('AZD Provision emits start custom event with run metadata', async ({ page }) => {
    await mockJson(page, /http:\/\/localhost:7071\/api(\/v4)?\/validation-template$/, { runId: 'RUN_EVT', githubRunId: 999, githubRunUrl: 'https://example.test/run/evt' });
    await mockJson(page, /http:\/\/localhost:7071\/api(\/v4)?\/validation-status.*/, { status: 'completed', conclusion: 'success', githubRunId: 999 });
    await page.addInitScript(() => {
      (window as any).reportData = { repoUrl: 'https://github.com/Azure-Samples/azd-template-artifacts' };
      (window as any).Notifications = { loading: () => ({ success: () => {}, error: () => {}, warning: () => {}, info: () => {} }), confirm: (_t: string, _m: string, opts: any) => opts?.onConfirm?.(), error: () => {} };
      (window as any).__AzdProvisionTestConfig = { maxAttempts: 2, pollIntervalMs: 20 };
      (window as any).__eventPayload = null;
      document.addEventListener('azd-provision-started', (e: any) => { (window as any).__eventPayload = e.detail; });
    });
    await page.goto('./index.html');
    await page.waitForFunction(() => typeof (window as any).testAzdProvision === 'function');
    await page.evaluate(() => (window as any).testAzdProvision());
    await page.waitForFunction(() => (window as any).__eventPayload !== null);
    const payload = await page.evaluate(() => (window as any).__eventPayload);
    expect(payload.runId).toBe('RUN_EVT');
    expect(payload.githubRunId).toBe(999);
    expect(payload.githubRunUrl).toContain('example.test/run/evt');
  });
  test('AZD Provision workflow happy path', async ({ page }) => {
    // Intercept backend calls (module targets localhost:7071 when host is localhost)
    let startCalled = false;
    let statusCalled = false;

    await page.route(/http:\/\/localhost:7071\/api(\/v4)?\/validation-template$/, async route => {
      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST,OPTIONS', 'access-control-allow-headers': 'Content-Type' } });
      }
      startCalled = true;
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ runId: 'RUN123', githubRunId: 42, githubRunUrl: 'https://example.test/run/42', requestId: 'REQ1' }) });
    });
    await page.route(/http:\/\/localhost:7071\/api(\/v4)?\/validation-status.*/, async route => {
      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,OPTIONS', 'access-control-allow-headers': 'Content-Type' } });
      }
      statusCalled = true;
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ status: 'completed', conclusion: 'success', githubRunId: 42 }) });
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

  test('AZD Provision cancellation flow (autoCancel hook)', async ({ page }) => {
    let startCalled = false;
    let statusCalls = 0;
    let cancelCalled = false;

    await page.route(/http:\/\/localhost:7071\/api(\/v4)?\/validation-template$/, async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST,OPTIONS', 'access-control-allow-headers': 'Content-Type' } });
      startCalled = true;
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ runId: 'RUN_CANCEL', githubRunId: 100 }) });
    });
    await page.route(/http:\/\/localhost:7071\/api(\/v4)?\/validation-status.*/, async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,OPTIONS', 'access-control-allow-headers': 'Content-Type' } });
      statusCalls++;
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ status: 'in_progress' }) });
    });

    await page.route(/http:\/\/localhost:7071\/api(\/v4)?\/validation-cancel$/, async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST,OPTIONS', 'access-control-allow-headers': 'Content-Type' } });
      cancelCalled = true;
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ githubRunId: 100 }) });
    });

    await page.addInitScript(() => {
      (window as any).reportData = { repoUrl: 'https://github.com/Azure-Samples/azd-template-artifacts' };
      (window as any).Notifications = {
        loading: () => ({ success: () => {}, error: () => {}, warning: () => {}, info: () => {} }),
        confirm: (_t: string, _m: string, opts: any) => opts?.onConfirm?.(),
        error: () => {},
      };
      // Enable deterministic auto cancellation in module under test
      (window as any).__AzdProvisionTestConfig = { maxAttempts: 5, pollIntervalMs: 50, autoCancel: true, autoCancelDelay: 20 };
    });

    await page.goto('./index.html');
    await page.waitForFunction(() => typeof (window as any).testAzdProvision === 'function');
    await page.evaluate(() => (window as any).testAzdProvision());

    // Wait for logs to reflect start and then auto cancellation
    const logEl = page.locator('#azd-provision-logs');
    await expect(logEl).toBeVisible();
    await expect(logEl).toContainText('Validation started');
    await expect(logEl).toContainText('Cancellation requested');

    expect(startCalled).toBeTruthy();
    expect(statusCalls).toBeGreaterThan(0);
    expect(cancelCalled).toBeTruthy();
    // log should reflect cancellation request
    await expect(page.locator('#azd-provision-logs')).toContainText('Cancellation requested');
  });

  test('AZD Provision start error handling', async ({ page }) => {
    await page.route(/http:\/\/localhost:7071\/api(\/v4)?\/validation-template$/, async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST,OPTIONS', 'access-control-allow-headers': 'Content-Type' } });
      await route.fulfill({ status: 500, contentType: 'text/plain', headers: { 'access-control-allow-origin': '*' }, body: 'boom' });
    });

    await page.addInitScript(() => {
      (window as any).reportData = { repoUrl: 'https://github.com/Azure-Samples/azd-template-artifacts' };
      (window as any).Notifications = {
        loading: () => ({ success: () => {}, error: () => {}, warning: () => {}, info: () => {} }),
        confirm: (_t: string, _m: string, opts: any) => opts?.onConfirm?.(),
        error: () => {},
      };
    });

    await page.goto('./index.html');
    await page.waitForFunction(() => typeof (window as any).testAzdProvision === 'function');
    await page.evaluate(() => (window as any).testAzdProvision());
    const logEl = page.locator('#azd-provision-logs');
    await expect(logEl).toBeVisible();
    await expect(logEl).toContainText('Validation start failed');
  });

  test('AZD Provision timeout path (shortened)', async ({ page }) => {
    let statusCalls = 0;
    await page.route(/http:\/\/localhost:7071\/api(\/v4)?\/validation-template$/, async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST,OPTIONS', 'access-control-allow-headers': 'Content-Type' } });
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ runId: 'RUN_TIMEOUT' }) });
    });
    await page.route(/http:\/\/localhost:7071\/api(\/v4)?\/validation-status.*/, async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,OPTIONS', 'access-control-allow-headers': 'Content-Type' } });
      statusCalls++;
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ status: 'in_progress' }) });
    });

    await page.addInitScript(() => {
      (window as any).reportData = { repoUrl: 'https://github.com/Azure-Samples/azd-template-artifacts' };
      (window as any).Notifications = {
        loading: () => ({ success: () => {}, error: () => {}, warning: () => {}, info: () => {} }),
        confirm: (_t: string, _m: string, opts: any) => opts?.onConfirm?.(),
        error: () => {},
      };
      // Force only 2 attempts with small interval
      (window as any).__AzdProvisionTestConfig = { maxAttempts: 2, pollIntervalMs: 30 };
    });

    await page.goto('./index.html');
    await page.waitForFunction(() => typeof (window as any).testAzdProvision === 'function');
    await page.evaluate(() => (window as any).testAzdProvision());
    const logEl = page.locator('#azd-provision-logs');
    await expect(logEl).toBeVisible();
    await expect(logEl).toContainText('Validation started');
    // Wait a bit longer than total simulated attempts (2 * 30ms + overhead)
    await page.waitForTimeout(400);
    expect(statusCalls).toBeGreaterThan(0);
    await expect(logEl).toContainText('Timed out waiting for workflow');
  });
});
