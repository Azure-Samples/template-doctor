// @ts-nocheck
import { test, expect } from '@playwright/test';

async function renderDashboard(page, { autoSaveResults }) {
  // Ensure we are on the app page (packages/app is the web root)
  await page.goto('/');

  // Ensure DashboardRenderer is available
  await page.waitForFunction(() => !!window.DashboardRenderer, null, { timeout: 30000 });

  // Configure runtime setting and render a minimal dashboard
  await page.evaluate((flag) => {
    // Force runtime config
    window.TemplateDoctorConfig = Object.assign({}, window.TemplateDoctorConfig || {}, {
      autoSaveResults: !!flag,
    });

    // Create a container to render into
    const container = document.createElement('div');
    container.id = 'results-container-test';
    document.body.appendChild(container);

    // Minimal valid result structure for renderer
    const result = {
      repoUrl: 'https://github.com/test-owner/test-repo',
      ruleSet: 'dod',
      compliance: {
        issues: [
          // Add one simple issue to exercise rendering
          {
            id: 'missing-file-readme',
            message: 'Missing required file: README.md',
            severity: 'warning',
          },
        ],
        compliant: [],
      },
    };

    window.DashboardRenderer.render(result, container);
  }, autoSaveResults);

  // Ensure the action section exists
  await expect(page.locator('#action-section')).toHaveCount(1);
}

test.describe('Save Results button behavior', () => {
  test('is disabled when autoSaveResults is enabled and shows the auto-save note', async ({
    page,
  }) => {
    await renderDashboard(page, { autoSaveResults: true });

    const saveBtn = page.locator('#save-results-btn');
    await expect(saveBtn).toHaveCount(1);
    await expect(saveBtn).toBeDisabled();

    const note = page.locator('#save-results-note');
    await expect(note).toHaveText(/Auto-save is enabled; results are saved automatically\./);
  });

  test('is enabled when autoSaveResults is disabled and shows the PR note', async ({ page }) => {
    await renderDashboard(page, { autoSaveResults: false });

    const saveBtn = page.locator('#save-results-btn');
    await expect(saveBtn).toHaveCount(1);
    await expect(saveBtn).toBeEnabled();

    const note = page.locator('#save-results-note');
    await expect(note).toHaveText(/will open a pull request to store this analysis/);
  });
});
