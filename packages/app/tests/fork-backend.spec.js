import { test, expect } from '@playwright/test';

test.describe('Backend Fork Flow', () => {
  test('forks repository via backend', async ({ page }) => {
    await page.goto('/');
    await page.addInitScript(() => {
      window.TemplateDoctorConfig = { features: { backendMigration: true } };
    });
    await page.route('**/api/repo/fork', route => {
      route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ forkFullName:'user/repo', forkHtmlUrl:'https://github.com/user/repo' }) });
    });
    // Directly call API client for now (UI wiring TBD)
    const res = await page.evaluate(async () => {
      return await window.TemplateDoctorApiClient.forkRepository({ owner:'example', repo:'repo' });
    });
    expect(res.forkFullName).toBe('user/repo');
  });
});
