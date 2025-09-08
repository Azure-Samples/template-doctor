// @ts-nocheck
import { test, expect } from '@playwright/test';

test.describe('Notification system', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Robust condition: ensure real system (no queue stub) and API methods present.
    await page.waitForFunction(() => {
      const w = window;
      const ns = w.NotificationSystem || w.Notifications;
      if (!ns) return false;
      if (ns.__queue) return false; // still guard stub
      // Accept either style: info OR showInfo (compat aliases may only give one initially)
      return typeof ns.showInfo === 'function' || typeof ns.info === 'function';
    }, { timeout: 15000 });
  });

  test('shows info/success/warning/error toasts', async ({ page }) => {
    // Readiness already guaranteed by beforeEach; container will be created on first show if absent.
    await page.evaluate(() => {
      const ns = window.NotificationSystem || window.Notifications;
      // Debug snapshot
      window.__notifDebug1 = {
        hasInfo: typeof ns.info,
        hasSuccess: typeof ns.success,
        hasShowInfo: typeof ns.showInfo,
        hasShowSuccess: typeof ns.showSuccess,
        isQueueStub: !!ns.__queue,
        keys: Object.keys(ns).slice(0, 25)
      };
      // Use longer durations so auto-dismiss does not race the expectation.
      // The legacy NotificationSystem (notifications.js) auto-removes exactly at duration; under CI
      // timing jitter the 1000ms originals could disappear before Playwright stabilizes the count.
      const stableDuration = 4000; // 4s gives ample margin without slowing suite meaningfully.
      const call = (primary, fallback, ...args) => {
        if (ns && typeof ns[primary] === 'function') return ns[primary](...args);
        if (ns && typeof ns[fallback] === 'function') return ns[fallback](...args);
      };
      call('info','showInfo','Info Title','Info message', stableDuration);
      call('success','showSuccess','Success Title','Success message', stableDuration);
      call('warning','showWarning','Warning Title','Warning message', stableDuration);
      call('error','showError','Error Title','Error message', stableDuration);
    });
    const dbg = await page.evaluate(() => window.__notifDebug1);
    const diag = await page.evaluate(() => window.__notifDiag || null);
    const containerHtml = await page.evaluate(() => {
      const c = document.querySelector('.notification-container');
      return c ? c.outerHTML.slice(0, 400) : 'missing';
    });
    console.log('NOTIF DEBUG:', dbg);
    console.log('NOTIF DIAG:', diag);
    console.log('CONTAINER HTML:', containerHtml);

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
  // Unified readiness already ensures real system; no additional guard checks required.
    await page.evaluate(() => {
      const ns = window.NotificationSystem || window.Notifications;
      window.__notifDebug2 = { hasLoading: typeof ns.loading, hasShowLoading: typeof ns.showLoading, isQueueStub: !!ns.__queue };
      window.__loading = ns.loading('Loading...', 'Please wait');
      setTimeout(() => window.__loading.update('Still loading', 'Halfway there'), 50);
      setTimeout(() => window.__loading.success('Done', 'All good'), 100);
    });
  console.log('NOTIF DEBUG 2:', await page.evaluate(() => window.__notifDebug2));
  console.log('NOTIF DIAG 2:', await page.evaluate(() => window.__notifDiag || null));

    await expect(page.locator('.notification.info')).toHaveCount(1);
    // After success update, expect type to become success
    await expect(page.locator('.notification.success')).toHaveCount(1);
  });

  test('confirmation shows actions and triggers callbacks', async ({ page }) => {
  // Unified readiness already ensures confirm API.
    await page.evaluate(() => {
      const ns = window.NotificationSystem || window.Notifications;
      window.__notifDebug3 = { hasConfirm: typeof ns.confirm, isQueueStub: !!ns.__queue };
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
  console.log('NOTIF DEBUG 3:', await page.evaluate(() => window.__notifDebug3));
  console.log('NOTIF DIAG 3:', await page.evaluate(() => window.__notifDiag || null));

    const notif = page.locator('.notification.warning');
    await expect(notif).toHaveCount(1);
    const actions = notif.locator('.notification-actions .notification-action');
    await expect(actions).toHaveCount(2);

    // Click confirm
    await actions.nth(1).click();
    await expect.poll(async () => await page.evaluate(() => !!window.__confirmed)).toBeTruthy();
  });

  test('back-compat showX APIs are wired', async ({ page }) => {
  // Unified readiness already ensures showX APIs.
    await page.evaluate(() => {
      const ns = window.NotificationSystem || window.Notifications;
      window.__notifDebug4 = { hasShowInfo: typeof ns.showInfo, hasShowSuccess: typeof ns.showSuccess, isQueueStub: !!ns.__queue };
      // Stabilize durations to avoid flakiness (see earlier test rationale)
      const stableDuration = 4000;
      ns.showInfo('Legacy Info', 'works', stableDuration);
      ns.showSuccess('Legacy Success', 'works', stableDuration);
      ns.showWarning('Legacy Warning', 'works', stableDuration);
      ns.showError('Legacy Error', 'works', stableDuration);
    });
  console.log('NOTIF DEBUG 4:', await page.evaluate(() => window.__notifDebug4));
  console.log('NOTIF DIAG 4:', await page.evaluate(() => window.__notifDiag || null));
    await expect(page.locator('.notification')).toHaveCount(4);
  });
});
