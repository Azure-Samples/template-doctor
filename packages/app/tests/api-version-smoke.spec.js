// Smoke test to verify versioned API routing via ApiRoutes helper
// Assumptions:
// - index.html loads api-routes.js before application scripts.
// - Setting window.TemplateDoctorConfig.backend.apiVersion = 'v4' should prefix API calls with /api/v4.
// - We focus on analyze-template endpoint because it is centrally used and already refactored.
// - Test runs in isolation; we mock fetch to capture requested URL.

import { test, expect } from '@playwright/test';

// Utility to run code inside the browser context to trigger analyzeTemplateServerSide
async function triggerServerSideAnalyze(page) {
  await page.evaluate(async () => {
    // Safety: ensure helper exists
    if (!window.TemplateAnalyzer || !window.ApiRoutes) {
      throw new Error('Required globals not present');
    }

    // Minimal fake template text
    const templateText = 'name: sample-template';

    // Force config to server side path + version
    window.TemplateDoctorConfig = window.TemplateDoctorConfig || {};
    window.TemplateDoctorConfig.backend = window.TemplateDoctorConfig.backend || {};
    window.TemplateDoctorConfig.backend.apiVersion = 'v4';

    // Mock fetch if not already mocked
    if (!window.__fetchMockInstalled) {
      const originalFetch = window.fetch;
      window.__requestedUrls = [];
      window.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : input.url;
        window.__requestedUrls.push(url);
        // Return a minimal valid JSON response for analyze-template
        if (url.includes('/analyze-template')) {
          return new Response(JSON.stringify({ ok: true, issues: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        // Fallback: pass through
        return originalFetch(input, init);
      };
      window.__fetchMockInstalled = true;
    }

    // Invoke server-side analyzer path (returns promise)
    if (typeof window.TemplateAnalyzer?.analyzeTemplateServerSide !== 'function') {
      throw new Error('analyzeTemplateServerSide not available');
    }

    await window.TemplateAnalyzer.analyzeTemplateServerSide(templateText, { dispatch: false });
  });
}

test.describe('API Version Routing', () => {
  test('should prefix /api/v4 when apiVersion is set', async ({ page }) => {
    await page.goto('./index.html');

    // Trigger the server-side analysis which should perform a fetch
    await triggerServerSideAnalyze(page);

    // Collect requested URLs
    const urls = await page.evaluate(() => window.__requestedUrls || []);

    // Find analyze-template call
    const analyzeCall = urls.find((u) => u.includes('analyze-template'));
    expect(analyzeCall).toBeTruthy();

    // Expect versioned path
    expect(analyzeCall).toMatch(/\/api\/v4\/analyze-template/);
  });
});
