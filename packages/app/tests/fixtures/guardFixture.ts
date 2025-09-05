import { test as base } from '@playwright/test';

// Guard fixture: prevents usage of native alert/confirm/prompt & dialog APIs in tests.
// Provides no extra fixtures; it only installs hooks on each page before test code runs.

export const test = base.extend({
  page: async ({ page }, use) => {
    // Dialog listener that fails immediately if a native dialog appears.
    page.on('dialog', async (dialog) => {
      throw new Error(`Native dialog used: ${dialog.type()} - ${dialog.message()}`);
    });

    // Inject proxies very early so app scripts hitting window.alert/confirm/prompt explode.
    const installGuards = () => {
      const fail = (name: string) => {
        throw new Error(`Native ${name} called`);
      };
      try {
        // eslint-disable-next-line no-alert
        window.alert = new Proxy(window.alert, { apply: () => fail('alert') });
      } catch {}
      try {
        // eslint-disable-next-line no-alert
        window.confirm = new Proxy(window.confirm, { apply: () => fail('confirm') });
      } catch {}
      try {
        // eslint-disable-next-line no-alert
        window.prompt = new Proxy(window.prompt, { apply: () => fail('prompt') });
      } catch {}
    };

    // Ensure future navigations are guarded early.
    await page.addInitScript(installGuards);
    // Also patch the current document (about:blank) so tests that run before navigation are protected.
    await page.evaluate(installGuards);

    await use(page);
  },
});

export const expect = test.expect;
