// Feature flag helpers for Playwright tests.
// NOTE: These must only be declared once; duplicates previously caused SyntaxError (identifier already declared).
export async function enableBackendMigration(page) {
  await page.addInitScript(() => {
    window.TemplateDoctorConfig = window.TemplateDoctorConfig || {};
    window.TemplateDoctorConfig.features = {
      ...(window.TemplateDoctorConfig.features || {}),
      backendMigration: true
    };
  });
}

export async function reaffirmBackendMigration(page) {
  await page.evaluate(() => {
    window.TemplateDoctorConfig = window.TemplateDoctorConfig || {};
    window.TemplateDoctorConfig.features = {
      ...(window.TemplateDoctorConfig.features || {}),
      backendMigration: true
    };
  });
}

export async function ensureApiClientReady(page, timeout = 15000) {
  await page.waitForFunction(() => !!window.TemplateDoctorApiClient, null, { timeout });
}
