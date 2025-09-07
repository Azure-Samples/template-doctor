import { test, expect } from '@playwright/test';

// Basic smoke tests for unified validation module using test overrides to accelerate polling.
// These tests assume backend endpoints will respond; where not available we simulate by injecting
// a mock status responder into window.fetch for specific run ids.

test.describe('Unified Validation Module', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // Accelerate polling for tests
      (window as any).__ValidationTestOverrides = { polling: { intervalMs: 200, maxAttempts: 5 } };
    });
  });

  test('loads module and renders container', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    // Inject a container dynamically to avoid depending on production layout
    await page.evaluate(() => {
      const c = document.createElement('div');
      c.id = 'val-test';
      document.body.appendChild(c);
      const api = (window as any).TemplateValidation.init('val-test', 'owner/repo');
      (window as any).__valApi = api;
    });
    const startBtn = page.locator('#val-test button.td-val-start');
    await expect(startBtn).toBeVisible();
  });

  test('start simple validation triggers state changes (mocked)', async ({ page }) => {
    await page.route('**/validation-template**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ runId: 'RUN123' }) });
    });
    let pollCount = 0;
    await page.route('**/validation-status**', (route) => {
      pollCount++;
      // Return running for first 2 polls then completed success
      const status = pollCount < 3 ? { status: 'in_progress' } : { status: 'completed', conclusion: 'success', results: { details: [] } };
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(status) });
    });
    await page.goto('/');
    await page.evaluate(() => {
      const c = document.createElement('div'); c.id = 'val-test2'; document.body.appendChild(c);
      const api = (window as any).TemplateValidation.init('val-test2', 'owner/repo');
      (window as any).__valApi2 = api; api.start();
    });
    await page.waitForSelector('.td-val-summary.success', { timeout: 5000 });
    const text = await page.locator('.td-val-summary.success').innerText();
    expect(text).toMatch(/Success/);
  });
});
