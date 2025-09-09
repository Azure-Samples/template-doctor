// Container-targeted Playwright configuration.
// Uses the already running unified container (serving frontend+api) on port 4000.
// No dev webServer is launched; this is a pure external smoke configuration.
// Kept minimal for speed.

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  timeout: 45000,
  expect: { timeout: 8000 },
});
