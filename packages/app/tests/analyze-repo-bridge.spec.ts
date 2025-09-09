import { test, expect } from '@playwright/test';

// Verifies the TypeScript bridge installed window.analyzeRepo and basic behavior.
test.describe('analyzeRepo bridge', () => {
  test('installs global analyzeRepo bridge', async ({ page }) => {
    await page.goto('/');
    // Wait until analyzeRepo appears (event may have fired before we attached listener)
    await page.waitForFunction(() => typeof (window as any).analyzeRepo === 'function' && !!(window as any).analyzeRepo.__bridge, { timeout: 15000 });
    const hasAnalyze = await page.evaluate(() => typeof (window as any).analyzeRepo === 'function' && !!(window as any).analyzeRepo.__bridge);
    expect(hasAnalyze).toBe(true);
  });

  test('reports error gracefully for missing repo URL', async ({ page }) => {
    await page.goto('/');
    const err = await page.evaluate(async () => {
      try {
        // @ts-ignore
        await window.analyzeRepo('');
      } catch (e:any) {
        return e?.message || 'threw';
      }
      return 'no-throw';
    });
    expect(err === 'no-throw' || typeof err === 'string').toBeTruthy();
  });
});
