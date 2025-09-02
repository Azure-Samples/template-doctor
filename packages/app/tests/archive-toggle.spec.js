// @ts-nocheck
import { test, expect } from '@playwright/test';

async function openRulesetModal(page, { archiveEnabledGlobal }) {
  await page.goto('/');
  await page.waitForFunction(() => !!window.showRulesetModal, null, { timeout: 30000 });

  // Configure runtime to desired global state
  await page.evaluate((flag) => {
    window.TemplateDoctorConfig = Object.assign({}, window.TemplateDoctorConfig || {}, {
      archiveEnabled: !!flag,
      archiveCollection: 'aigallery',
    });
  }, archiveEnabledGlobal);

  // Stub analyzeRepo to avoid kicking off the analyzer during this UI test
  await page.evaluate(() => {
    window.analyzeRepo = () => {};
  });

  // Show the modal for a dummy repo
  await page.evaluate(() => {
    window.showRulesetModal('https://github.com/test-owner/test-repo');
  });

  const modal = page.locator('#ruleset-modal');
  await expect(modal).toBeVisible();
}

async function submitWithIntercept(page) {
  const requests = [];
  await page.route('**/api/submit-analysis-dispatch', async (route) => {
    const req = route.request();
    const bodyText = req.postData() || '';
    let parsed = null;
    try {
      parsed = JSON.parse(bodyText);
    } catch {}
    requests.push({ url: req.url(), method: req.method(), body: parsed });
    await route.fulfill({ status: 204, body: '' });
  });

  // Trigger the submission by calling submitAnalysisToGitHub directly with minimal result
  await page.evaluate(() => {
    const result = {
      repoUrl: 'https://github.com/test-owner/test-repo',
      ruleSet: 'dod',
      timestamp: Date.now(),
      compliance: { issues: [], compliant: [] },
    };
    return window.submitAnalysisToGitHub(result, 'test-user');
  });

  return requests;
}

test.describe('Archive toggle in ruleset modal', () => {
  test('shows opt-in checkbox when global archive is disabled and applies one-time override', async ({
    page,
  }) => {
    await openRulesetModal(page, { archiveEnabledGlobal: false });

    const container = page.locator('#archive-override-container');
    const checkbox = page.locator('#archive-override');
    const analyzeBtn = page.locator('#analyze-with-ruleset-btn');

    await expect(container).toBeVisible();
    await expect(checkbox).not.toBeChecked();

    // Opt-in for this single run
    await checkbox.check();

    // Clicking Analyze sets the per-run override; we stubbed analyzeRepo to no-op
    await analyzeBtn.click();

    // Now submitting should carry archiveEnabled=true in the client_payload
    const requests = await submitWithIntercept(page);
    expect(requests.length).toBeGreaterThan(0);

    const last = requests[requests.length - 1];
    expect(last.body).toBeTruthy();
    expect(last.body.event_type).toBe('template-analysis-completed');
    expect(last.body.client_payload).toBeTruthy();
    expect(last.body.client_payload.archiveEnabled).toBe(true);
    expect(last.body.client_payload.archiveCollection).toBe('aigallery');
  });

  test('does not show checkbox when global archive is enabled', async ({ page }) => {
    await openRulesetModal(page, { archiveEnabledGlobal: true });
    await expect(page.locator('#archive-override-container')).toBeHidden();
  });

  test('when global archive disabled and not checked, payload archiveEnabled is false', async ({
    page,
  }) => {
    await openRulesetModal(page, { archiveEnabledGlobal: false });

    // Do not check the box, click Analyze
    await page.locator('#analyze-with-ruleset-btn').click();

    const requests = await submitWithIntercept(page);
    const last = requests[requests.length - 1];
    expect(last.body.client_payload.archiveEnabled).toBe(false);
  });
});
