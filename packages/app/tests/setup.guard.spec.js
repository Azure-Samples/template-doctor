// @ts-check
import { test } from '@playwright/test';

// Global guard: fail if any native dialog api is used
test.beforeEach(async ({ page }) => {
  // Fail the test if any dialog is triggered
  page.on('dialog', async (dialog) => {
    throw new Error(`Native dialog used: ${dialog.type()} - ${dialog.message()}`);
  });

  // Override alert/confirm/prompt at init to throw if called
  await page.addInitScript(() => {
    const fail = (name) => {
      throw new Error(`Native ${name} called`);
    };
    try {
      // eslint-disable-next-line no-alert
      window.alert = new Proxy(window.alert, { apply: () => fail('alert') });
      // eslint-disable-next-line no-alert
      window.confirm = new Proxy(window.confirm, { apply: () => fail('confirm') });
      // eslint-disable-next-line no-alert
      window.prompt = new Proxy(window.prompt, { apply: () => fail('prompt') });
    } catch {}
  });
});
