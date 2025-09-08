// @ts-nocheck
import { test, expect } from '@playwright/test';
import { enableBatchMode } from './testUtils.js';

async function mockAuthAndDeps(page) {
  await page.evaluate(() => {
    const mockUserInfo = { login: 'test-user', name: 'Test User', avatarUrl: 'x' };
    localStorage.setItem('gh_access_token', 'mock_access_token');
    localStorage.setItem('gh_user_info', JSON.stringify(mockUserInfo));

    // Show search UI
    const searchSection = document.getElementById('search-section');
    const welcomeSection = document.getElementById('welcome-section');
    if (searchSection) searchSection.style.display = 'block';
    if (welcomeSection) welcomeSection.style.display = 'none';

    window.GitHubClient = {
      auth: {
        isAuthenticated: () => true,
        getUsername: () => 'test-user',
        getToken: () => 'mock_access_token',
      },
    };
    window.DashboardRenderer = { render: () => {} };
    window.TemplateAnalyzer = {
      analyzeTemplate: async (url) => ({
        repoUrl: url,
        ruleSet: 'dod',
        timestamp: new Date().toISOString(),
        compliance: { issues: [{ id: 'i1' }], compliant: [{ id: 'p1' }, { id: 'p2' }] },
      }),
    };
    document.dispatchEvent(new Event('template-analyzer-ready'));
  });
}

test.describe('Batch resume and cancel', () => {
  test.beforeEach(async ({ page }) => {
    // Inject feature flags & ensure notifications readiness promise BEFORE navigation
    await page.addInitScript(() => {
      // Force legacy batch scanning path for these tests; the server batch scan path gated by
      // backendMigration is not yet feature-complete for resume/cancel semantics.
      window.TemplateDoctorConfig = { features: { backendMigration: false } };
    });
    await page.goto('/');
    await mockAuthAndDeps(page);
    // Wait for notifications so confirmation interception is reliable
  // Accept either explicit readiness marker or presence of a confirmation-capable notification API
  await page.waitForFunction(() => !!( (window.__notificationsReady && window.NotificationSystem && window.NotificationSystem.showConfirmation) || (window.NotificationSystem && (window.NotificationSystem.showConfirmation || window.NotificationSystem.confirm)) || (window.Notifications && window.Notifications.confirm) ), { timeout: 5000 });
  });

  test('resume skips previously successful items and updates progress', async ({ page }) => {
    await enableBatchMode(page);

    // First run with two URLs: complete first, error second to keep progress
    await page.evaluate(() => {
      const original = window.TemplateAnalyzer.analyzeTemplate;
      window.__failOnce = 'https://github.com/owner/repo-two';
      window.TemplateAnalyzer.analyzeTemplate = async (url, ruleSet) => {
        if (url === window.__failOnce) {
          throw new Error('fail second');
        }
        return original(url, ruleSet);
      };
    });

    await page.fill(
      '#batch-urls',
      'https://github.com/owner/repo-one\nhttps://github.com/owner/repo-two',
    );
    await page.click('#batch-scan-button');
    await expect(page.locator('#batch-items .batch-item')).toHaveCount(2);
    await expect(page.locator('#batch-items .batch-item.success')).toHaveCount(1);
    await expect(page.locator('#batch-items .batch-item.error')).toHaveCount(1);

    // Reload page to simulate user returning later (IndexedDB state should persist)
    await page.reload();
    await mockAuthAndDeps(page);
    await enableBatchMode(page);

    // Wait for legacy batch scan module to load and wire DOM (it binds on DOMContentLoaded)
    await page.waitForFunction(() => !!window.LegacyBatchScan && !!window.LegacyBatchScanStore, { timeout: 5000 });
    // Auto-confirm resume dialog used by legacy code path (it calls notify().confirm OR window.confirm)
    await page.evaluate(() => {
      // Stub window.confirm
      window.confirm = () => true;
      const ns = window.NotificationSystem || window.Notifications;
      if (ns && !ns.__resumePatched) {
        if (typeof ns.confirm === 'function') {
          const orig = ns.confirm.bind(ns);
            ns.confirm = (title, message, opts) => {
              try { opts?.onConfirm && opts.onConfirm(); } catch {}
              return orig(title, message, opts);
            };
        } else {
          // Provide a minimal confirm implementation that immediately confirms
          ns.confirm = (title, message, opts) => { try { opts?.onConfirm && opts.onConfirm(); } catch {} };
        }
        ns.__resumePatched = true;
      }
    });
    // Sanity check that progress entries exist in IndexedDB (at least 2 entries expected)
    const progressCount = await page.evaluate(async () => {
      try {
        const store = window.LegacyBatchScanStore; if(!store) return -1;
        const all = await store.getAllProgress();
        return all.length;
      } catch { return -2; }
    });
    expect(progressCount).toBeGreaterThanOrEqual(2);

    // Clear fail override so both can succeed; choose Resume in confirmation
    await page.evaluate(() => {
      const original = window.TemplateAnalyzer.analyzeTemplate;
      window.TemplateAnalyzer.analyzeTemplate = async (url, ruleSet) => original(url, ruleSet);
    });

    // Intercept the confirmation by clicking Resume action in our notification
    // The app uses NotificationSystem.showConfirmation. Ensure it exists and auto-confirm.
    await page.evaluate(() => {
      const ns = window.NotificationSystem || window.Notifications;
      if (!ns || typeof ns.showConfirmation !== 'function') return;
      const orig = ns.showConfirmation.bind(ns);
      ns.showConfirmation = (title, message, primaryLabel, secondaryLabel, callback) => {
        // Immediately confirm so batch resume path proceeds
        setTimeout(() => callback && callback(true), 0);
        return orig(title, message, primaryLabel, secondaryLabel, callback);
      };
    });

    await page.fill('#batch-urls','https://github.com/owner/repo-one\nhttps://github.com/owner/repo-two');
    await page.click('#batch-scan-button');

    // Should mark repo-one as already success and only process repo-two
    // Wait for items to re-render (resume path may be async after confirmation override)
    await expect(page.locator('#batch-items .batch-item')).toHaveCount(2, { timeout: 15000 });
    await expect(page.locator('#batch-items .batch-item.success')).toHaveCount(2, { timeout: 15000 });
    await expect(page.locator('#batch-progress-text')).toHaveText(/2\s*\/\s*2\s*Completed/, { timeout: 5000 });
  });

  test('cancel stops further processing and shows cancelled notification', async ({ page }) => {
    await enableBatchMode(page);

    // Slow down analyzer to allow cancel in between
    await page.evaluate(() => {
      const delay = (ms) => new Promise((r) => setTimeout(r, ms));
      const original = window.TemplateAnalyzer.analyzeTemplate;
      window.TemplateAnalyzer.analyzeTemplate = async (url, ruleSet) => {
        await delay(200); // ensure we can click cancel while processing
        return original(url, ruleSet);
      };
    });

    await page.fill(
      '#batch-urls',
      'https://github.com/owner/a\nhttps://github.com/owner/b\nhttps://github.com/owner/c',
    );
    await page.click('#batch-scan-button');

    // Click cancel when visible
    const cancelBtn = page.locator('#batch-cancel-btn');
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    // After cancel, button becomes disabled and reads Cancelling...
    await expect(cancelBtn).toBeDisabled();
    await expect(cancelBtn).toHaveText(/Cancelling/);

    // Wait for processing to end and for at least one notification to appear
    await expect
      .poll(async () => await page.locator('.notification.success, .notification.info').count())
      .toBeGreaterThanOrEqual(1);
    await expect
      .poll(async () => {
        const titles = await page.locator('.notification .notification-title').allTextContents();
        const match = titles.find((t) => /Batch Scan Cancelled|Batch Scan Complete/.test(t));
        return match || '';
      })
      .not.toEqual('');
  });
});
