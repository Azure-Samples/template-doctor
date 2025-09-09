import { test, expect } from '@playwright/test';

test.describe('Analysis section creation post-auth', () => {
  test('should reveal analysis section only after analyze invoked while authenticated', async ({ page }) => {
    await page.goto('/');

    // The section may be pre-created (hidden) by initialization logic. Wait for potential attachment.
    await page.waitForTimeout(100); // allow microtasks / DOM ready hooks
    const section = page.locator('#analysis-section');
    // If it exists it must be hidden pre-auth.
    if (await section.count()) {
      await expect(section).toBeHidden();
    }

    // Mock authentication (minimal GitHubAuth replacement)
    await page.evaluate(() => {
      window.localStorage.setItem('gh_access_token', 'mock');
      window.GitHubAuth = {
        isAuthenticated: () => true,
        getAccessToken: () => 'mock',
        userInfo: { login: 'tester', name: 'Tester', avatarUrl: '' }
      };
      document.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { authenticated: true }}));
    });

    // Still hidden until analyzeRepo is called
    if (await section.count()) {
      await expect(section).toBeHidden();
    }

    // Invoke analyzeRepo now that auth is mocked
    await page.evaluate(() => {
      if (typeof window.analyzeRepo === 'function') {
        try { window.analyzeRepo('https://github.com/owner/repo'); } catch(e) {}
      }
    });

    // Wait for visibility
    await expect(section).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#repo-name')).toContainText(/owner\/repo|Repository Name/);
  });
});
