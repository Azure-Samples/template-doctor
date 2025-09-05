const { defineConfig, devices } = require('@playwright/test');

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false, // Run tests sequentially for debugging
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1, // Add one retry for flaky tests
  workers: 1, // Use single worker for predictable execution
  reporter: 'html', // Use HTML reporter

  use: {
    baseURL: 'http://localhost:8080', // Ensure tests navigate to the correct server
    trace: 'on', // Capture traces for all tests
    screenshot: 'only-on-failure', // Capture screenshots on failure
    video: 'on-first-retry', // Record video on retry
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Use Vite dev server so that module-based TS migrations (e.g., main.ts) are executed during tests.
  // The previous python static server failed to process /src/main.ts causing missing globals (TemplateAnalyzer, ApiRoutes).
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: true,
    timeout: 120000,
    stdout: 'pipe',
    stderr: 'pipe',
  },

  // Increase timeouts for debugging
  timeout: 60000, // Global timeout
  expect: {
    timeout: 10000, // Expect assertion timeout
  },
});
