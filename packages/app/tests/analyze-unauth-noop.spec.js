import { test, expect } from '@playwright/test';

// This test complements auth-guard-analysis.spec.js but focuses on direct global invocation.
// Current app behavior: a hidden #analysis-section container is created early, so we assert it remains hidden.
test.describe('analyzeRepo no-op when unauthenticated', () => {
  test('should leave analysis-section hidden when called while logged out', async ({ page }) => {
    await page.goto('/');
    // Ensure logged out state
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    const section = page.locator('#analysis-section');
    await expect(section).toBeHidden();
    // Invoke analyzeRepo directly (should early-return with login warning)
    await page.evaluate(() => {
      if (typeof window.analyzeRepo === 'function') {
        try { window.analyzeRepo('https://github.com/example/repo'); } catch(e) {}
      }
    });
    await page.waitForTimeout(500);
    await expect(section).toBeHidden();
  });
});
