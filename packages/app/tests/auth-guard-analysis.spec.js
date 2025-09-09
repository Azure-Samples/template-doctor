// Verifies that invoking analyzeRepo while unauthenticated does not reveal analysis UI or dummy data.
import { test, expect } from '@playwright/test';

test.describe('Auth guard on analyzeRepo', () => {
  test('should NOT show analysis-section when not logged in', async ({ page }) => {
    await page.goto('/');
    // Ensure we are logged out: remove any token remnants
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    // Sanity: login button visible
    await expect(page.locator('#login-button')).toBeVisible();
    // analysis-section must be hidden initially
    await expect(page.locator('#analysis-section')).toBeHidden();
    // Try to call analyzeRepo directly
    await page.evaluate(() => {
      if (typeof window.analyzeRepo === 'function') {
        try { window.analyzeRepo('https://github.com/owner/repo'); } catch (e) { /* ignore */ }
      }
    });
    // Give a short delay for any DOM mutations
    await page.waitForTimeout(500);
    // analysis-section should still be hidden due to auth guard
    await expect(page.locator('#analysis-section')).toBeHidden();
    // repo-name should NOT be overwritten with placeholder or the test repo
    const repoName = await page.locator('#repo-name').textContent();
    expect(repoName).toMatch(/Repository Name/i); // unchanged default heading
  });
});
