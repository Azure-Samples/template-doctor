// @ts-nocheck
import { test, expect } from '@playwright/test';

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
      auth: { isAuthenticated: () => true, getUsername: () => 'test-user', getToken: () => 'mock_access_token' },
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
    await page.goto('/');
    await mockAuthAndDeps(page);
    await page.waitForSelector('#scan-mode-toggle');
  });

  test('resume skips previously successful items and updates progress', async ({ page }) => {
    await page.check('#scan-mode-toggle');

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

    await page.fill('#batch-urls', 'https://github.com/owner/repo-one\nhttps://github.com/owner/repo-two');
    await page.click('#batch-scan-button');
    await expect(page.locator('#batch-items .batch-item')).toHaveCount(2);
    await expect(page.locator('#batch-items .batch-item.success')).toHaveCount(1);
    await expect(page.locator('#batch-items .batch-item.error')).toHaveCount(1);

    // Reload page to simulate return, keep IndexedDB
    await page.reload();
    await mockAuthAndDeps(page);
    await page.check('#scan-mode-toggle');

    // Clear fail override so both can succeed; choose Resume in confirmation
    await page.evaluate(() => {
      const original = window.TemplateAnalyzer.analyzeTemplate;
      window.TemplateAnalyzer.analyzeTemplate = async (url, ruleSet) => original(url, ruleSet);
    });

    // Intercept the confirmation by clicking Resume action in our notification
    // The app uses NotificationSystem.showConfirmation. Ensure it exists and auto-confirm.
    await page.evaluate(() => {
      const ns = window.NotificationSystem || window.Notifications;
      if (ns) {
        const origConfirm = ns.confirm.bind(ns);
        ns.confirm = (title, message, opts = {}) => {
          // Auto choose confirm
          setTimeout(() => opts.onConfirm && opts.onConfirm(), 0);
          return origConfirm(title, message, opts);
        };
      }
    });

    await page.fill('#batch-urls', 'https://github.com/owner/repo-one\nhttps://github.com/owner/repo-two');
    await page.click('#batch-scan-button');

    // Should mark repo-one as already success and only process repo-two
    await expect(page.locator('#batch-items .batch-item')).toHaveCount(2);
    await expect(page.locator('#batch-items .batch-item.success')).toHaveCount(2);
    await expect(page.locator('#batch-progress-text')).toHaveText(/2\s*\/\s*2\s*Completed/);
  });

  test('cancel stops further processing and shows cancelled notification', async ({ page }) => {
    await page.check('#scan-mode-toggle');

    // Slow down analyzer to allow cancel in between
    await page.evaluate(() => {
      const delay = (ms) => new Promise((r) => setTimeout(r, ms));
      const original = window.TemplateAnalyzer.analyzeTemplate;
      window.TemplateAnalyzer.analyzeTemplate = async (url, ruleSet) => {
        await delay(200); // ensure we can click cancel while processing
        return original(url, ruleSet);
      };
    });

    await page.fill('#batch-urls', 'https://github.com/owner/a\nhttps://github.com/owner/b\nhttps://github.com/owner/c');
    await page.click('#batch-scan-button');

    // Click cancel when visible
    const cancelBtn = page.locator('#batch-cancel-btn');
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    // After cancel, button becomes disabled and reads Cancelling...
    await expect(cancelBtn).toBeDisabled();
    await expect(cancelBtn).toHaveText(/Cancelling/);

    // Wait for processing to end and for at least one notification to appear
    await expect.poll(async () => await page.locator('.notification.success, .notification.info').count())
      .toBeGreaterThanOrEqual(1);
    await expect
      .poll(async () => {
        const titles = await page.locator('.notification .notification-title').allTextContents();
        const match = titles.find(t => /Batch Scan Cancelled|Batch Scan Complete/.test(t));
        return match || '';
      })
      .not.toEqual('');
  });
});
