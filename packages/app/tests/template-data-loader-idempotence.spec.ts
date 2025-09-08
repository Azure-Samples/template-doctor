import { test, expect } from '@playwright/test';

// Revised approach:
//  - Use page.addInitScript to install GitHubAuth + event listener BEFORE any page scripts execute
//    so we never miss the initial dispatch (previous version raced and sometimes missed it).
//  - Validate single-dispatch semantics per attempt. We don't require exact timing; we assert monotonic
//    +1 growth after forceReload() calls, and no growth after loadIfNeeded().

test.describe('TemplateDataLoader idempotence', () => {
  test('forceReload increments event count by exactly one; loadIfNeeded no-op after load', async ({ page }) => {
    // Install instrumentation & authenticated auth stub before navigation.
    await page.addInitScript(() => {
      (window as any).GitHubAuth = { isAuthenticated: () => true };
      (window as any).__tdLoaderEvents = [];
      document.addEventListener('template-data-loaded', () => {
        (window as any).__tdLoaderEvents.push(Date.now());
      });
    });

    await page.goto('/');

    // Wait for first event OR short-circuit if loader already dispatched (should capture via init script).
    await page.waitForFunction(
      () => Array.isArray((window as any).__tdLoaderEvents) && (window as any).__tdLoaderEvents.length >= 1,
      { timeout: 5000 },
    );
    let counts = await page.evaluate(() => (window as any).__tdLoaderEvents.length);
    expect(counts).toBe(1);

    // First forceReload -> expect +1
    await page.evaluate(() => (window as any).TemplateDataLoader.forceReload());
    await page.waitForFunction(() => (window as any).__tdLoaderEvents.length === 2, { timeout: 5000 });
    counts = await page.evaluate(() => (window as any).__tdLoaderEvents.length);
    expect(counts).toBe(2);

    // loadIfNeeded should not change count
    await page.evaluate(() => (window as any).TemplateDataLoader.loadIfNeeded());
    await page.waitForTimeout(200); // brief buffer
    counts = await page.evaluate(() => (window as any).__tdLoaderEvents.length);
    expect(counts).toBe(2);

    // Second forceReload -> expect +1 (to 3)
    await page.evaluate(() => (window as any).TemplateDataLoader.forceReload());
    await page.waitForFunction(() => (window as any).__tdLoaderEvents.length === 3, { timeout: 5000 });
    counts = await page.evaluate(() => (window as any).__tdLoaderEvents.length);
    expect(counts).toBe(3);

    // Diagnostics sanity
    const diag = await page.evaluate(() => (window as any).TemplateDataLoader._state());
    expect(diag.attempted).toBeTruthy();
    expect(diag.loaded).toBeTruthy();
  });
});
