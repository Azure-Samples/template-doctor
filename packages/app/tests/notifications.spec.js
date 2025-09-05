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
      // Use longer durations so auto-dismiss does not race the expectation.
      // The legacy NotificationSystem (notifications.js) auto-removes exactly at duration; under CI
      // timing jitter the 1000ms originals could disappear before Playwright stabilizes the count.
      const stableDuration = 4000; // 4s gives ample margin without slowing suite meaningfully.
      ns.info('Info Title', 'Info message', stableDuration);
      ns.success('Success Title', 'Success message', stableDuration);
      ns.warning('Warning Title', 'Warning message', stableDuration);
      ns.error('Error Title', 'Error message', stableDuration);
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
        onConfirm: () => {
          window.__confirmed = true;
        },
        onCancel: () => {
          window.__cancelled = true;
        },
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
      // Stabilize durations to avoid flakiness (see earlier test rationale)
      const stableDuration = 4000;
      ns.showInfo('Legacy Info', 'works', stableDuration);
      ns.showSuccess('Legacy Success', 'works', stableDuration);
      ns.showWarning('Legacy Warning', 'works', stableDuration);
      ns.showError('Legacy Error', 'works', stableDuration);
    });
    await expect(page.locator('.notification')).toHaveCount(4);
  });
});
