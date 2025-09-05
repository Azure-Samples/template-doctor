const { test, expect } = require('@playwright/test');

// Ensures that only the v4 client-settings endpoint is requested and no legacy /api/client-settings call occurs
// Relies on network request inspection.

test.describe('Config loader v4 enforcement', () => {
  test('should request only /api/v4/client-settings', async ({ page }) => {
    const requested = [];
    page.on('request', req => {
      const url = req.url();
      if (url.includes('/api/')) requested.push(url);
    });

    await page.goto('http://localhost:8080');

    // Wait for config to load (event dispatched by runtime-config.js)
    await page.waitForFunction(() => !!window.TemplateDoctorConfig && !!window.TemplateDoctorConfig.apiVersion, null, { timeout: 5000 });

    // Assert at least one v4 client-settings request
    const v4Req = requested.find(u => /\/api\/v4\/client-settings/.test(u));
    expect(v4Req, 'Expected a /api/v4/client-settings request').toBeTruthy();

    // Assert no legacy client-settings request
    const legacyReq = requested.find(u => /\/api\/client-settings(?!\/v4)/.test(u) && !/\/api\/v4\//.test(u));
    expect(legacyReq, 'Legacy /api/client-settings request should not occur').toBeFalsy();
  });
});
