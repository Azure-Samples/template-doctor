// @ts-check
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

  webServer: {
    command: 'python3 -m http.server 8080',
    url: 'http://localhost:8080',
    reuseExistingServer: true, // Reuse server to avoid port conflicts
    timeout: 120000, // Allow more time for server to start
    stdout: 'pipe',
    stderr: 'pipe',
  },
  
  // Increase timeouts for debugging
  timeout: 60000, // Global timeout
  expect: {
    timeout: 10000, // Expect assertion timeout
  },
});
