// @ts-nocheck
import { test, expect } from '@playwright/test';

test.describe('Notification system', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Ensure NotificationSystem is available
    await page.waitForFunction(() => !!(window.NotificationSystem || window.Notifications));
  });

  test('shows info/success/warning/error toasts', async ({ page }) => {
    await page.evaluate(() => {
      const ns = window.NotificationSystem || window.Notifications;
      ns.info('Info Title', 'Info message', 1000);
      ns.success('Success Title', 'Success message', 1000);
      ns.warning('Warning Title', 'Warning message', 1000);
      ns.error('Error Title', 'Error message', 1000);
    });

    const items = page.locator('.notification');
    await expect(items).toHaveCount(4);
    await expect(page.locator('.notification.info')).toHaveCount(1);
    await expect(page.locator('.notification.success')).toHaveCount(1);
    await expect(page.locator('.notification.warning')).toHaveCount(1);
    await expect(page.locator('.notification.error')).toHaveCount(1);

    // Close one and ensure it disappears
    const closeBtn = page.locator('.notification.error .notification-close');
    await closeBtn.click();
    await expect(page.locator('.notification.error')).toHaveCount(0);
  });

  test('loading notification can update and complete with success/error', async ({ page }) => {
    await page.evaluate(() => {
      const ns = window.NotificationSystem || window.Notifications;
      window.__loading = ns.loading('Loading...', 'Please wait');
      setTimeout(() => window.__loading.update('Still loading', 'Halfway there'), 50);
      setTimeout(() => window.__loading.success('Done', 'All good'), 100);
    });

    await expect(page.locator('.notification.info')).toHaveCount(1);
    // After success update, expect type to become success
    await expect(page.locator('.notification.success')).toHaveCount(1);
  });

  test('confirmation shows actions and triggers callbacks', async ({ page }) => {
    await page.evaluate(() => {
      const ns = window.NotificationSystem || window.Notifications;
      ns.confirm('Confirm?', 'Proceed now?', {
        confirmLabel: 'Yes',
        cancelLabel: 'No',
        onConfirm: () => { window.__confirmed = true; },
        onCancel: () => { window.__cancelled = true; },
      });
    });

    const notif = page.locator('.notification.warning');
    await expect(notif).toHaveCount(1);
    const actions = notif.locator('.notification-actions .notification-action');
    await expect(actions).toHaveCount(2);

    // Click confirm
    await actions.nth(1).click();
    await expect.poll(async () => await page.evaluate(() => !!window.__confirmed)).toBeTruthy();
  });

  test('back-compat showX APIs are wired', async ({ page }) => {
    await page.evaluate(() => {
      const ns = window.NotificationSystem || window.Notifications;
      ns.showInfo('Legacy Info', 'works', 500);
      ns.showSuccess('Legacy Success', 'works', 500);
      ns.showWarning('Legacy Warning', 'works', 500);
      ns.showError('Legacy Error', 'works', 500);
    });
    await expect(page.locator('.notification')).toHaveCount(4);
  });
});
