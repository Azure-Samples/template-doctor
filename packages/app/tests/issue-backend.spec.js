// Playwright style test placeholder (to be filled with actual implementation)
import { test, expect } from '@playwright/test';

// NOTE: This is a scaffold; real selectors & mocks need to align with app HTML

test.describe('Backend Issue Creation (feature flag)', () => {
  test('should trigger backend issue creation flow', async ({ page }) => {
    // Inject globals BEFORE navigation
    await page.addInitScript(() => {
      window.reportData = {
        repoUrl: 'https://github.com/example/repo',
        compliance: { issues: [{ id: 'missing-file-readme', message: 'Missing required file: README.md', severity: 'error' }], compliant: [] },
        ruleSet: 'dod'
      };
      window.TemplateDoctorConfig = { features: { backendMigration: true } };
      // Ensure any confirm() always returns true (legacy path fallback)
      window.confirm = () => true;
      // If a NotificationSystem with confirm() appears later, we'll patch it post-load
    });
    await page.goto('/');

    // Ensure necessary services loaded
    await page.waitForFunction(() => !!(window.DashboardRenderer && window.TemplateDoctorIssueService));
    // Wait for ApiClient exposure (api-client-ready dispatch sets TemplateDoctorApiClient)
    await page.waitForFunction(() => !!window.TemplateDoctorApiClient);

    // Render dashboard manually (tests normally rely on user actions)
    await page.evaluate(() => {
      const container = document.createElement('div');
      container.id = 'test-dashboard-host';
      document.body.appendChild(container);
      // Render and wire issue button
      window.DashboardRenderer.render(window.reportData, container);
      if (window.TemplateDoctorIssueService?.wireIssueButton) {
        window.TemplateDoctorIssueService.wireIssueButton();
      }
      window.__issueEvent = null;
      document.addEventListener('issue-created', (e) => { window.__issueEvent = e.detail; });
      // Auto-confirm NotificationSystem based confirmation dialogs if present
      if (window.NotificationSystem && typeof window.NotificationSystem.confirm === 'function') {
        const orig = window.NotificationSystem.confirm;
        window.NotificationSystem.confirm = (title,msg,opts) => {
          try { opts?.onConfirm && opts.onConfirm(); } catch(_){}
          // Optionally still show UI by calling original if needed
          return undefined;
        };
      } else {
        // If it appears later (lazy init) patch once
        document.addEventListener('notifications-ready', () => {
          try {
            if (window.NotificationSystem && typeof window.NotificationSystem.confirm === 'function') {
              window.NotificationSystem.confirm = (title,msg,opts) => { try { opts?.onConfirm && opts.onConfirm(); } catch(_){}; };
            }
          } catch(_){}
        }, { once: true });
      }
    });

    // Intercept backend issue-create.
    // NOTE: api-client builds URL as apiBase + '/v4/issue-create'. Default apiBase from runtime-config is window.location.origin,
    // so the effective path is '/v4/issue-create' (no '/api' prefix). We still guard for legacy '/api/v4/issue-create'.
    await page.route('**/v4/issue-create', route => {
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ issueNumber: 123, htmlUrl: 'https://github.com/example/repo/issues/123', labelsEnsured: [], labelsCreated: [], copilotAssigned: true, childResults: [] })
      });
    });
    await page.route('**/api/v4/issue-create', route => {
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ issueNumber: 123, htmlUrl: 'https://github.com/example/repo/issues/123', labelsEnsured: [], labelsCreated: [], copilotAssigned: true, childResults: [] })
      });
    });

    const button = page.locator('#create-github-issue-btn');
    await expect(button).toBeVisible();

    // Start waiting for response & event before click to avoid race
  const respPromise = page.waitForResponse(r => /\/v4\/issue-create$/.test(new URL(r.url()).pathname) && r.status() === 201);
    // Auto-accept native dialog fallback (should be no-op if NotificationSystem path used)
    page.once('dialog', d => d.accept());
    await button.click();

    await respPromise;
    // Wait for custom event detail captured
    await expect.poll(() => page.evaluate(() => window.__issueEvent && window.__issueEvent.number)).toBe(123);
  });
});
