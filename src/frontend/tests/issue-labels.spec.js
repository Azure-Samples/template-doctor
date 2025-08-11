// @ts-nocheck
import { test, expect } from '@playwright/test';

// Utility to set minimal app state and capture created issues/labels
async function setupPageWithReport(page, { ruleSet = 'dod', issues = [], customGist } = {}) {
  await page.goto('/');

  await page.evaluate(({ ruleSet, issues, customGist }) => {
    // Mock Notifications to auto-confirm and avoid native dialogs
    window.Notifications = {
      loading: () => ({ update: () => {}, success: () => {}, error: () => {}, close: () => {} }),
      confirm: (_t, _m, { onConfirm }) => onConfirm(),
      error: () => {},
      warning: () => {},
      info: () => {},
    };

    // Exposed capture stores
    window.__ensuredLabels = [];
    window.__createdMain = null;
    window.__createdChildren = [];

    // Minimal auth + github client mock
    window.GitHubClient = {
      auth: { isAuthenticated: () => true, getAccessToken: () => 'token' },
      checkTokenScopes: async () => ['public_repo'],
      getRepository: async () => ({ id: 1 }),
      findIssuesByTitle: async () => [],
      ensureLabelsExist: async (_o, _r, labels) => window.__ensuredLabels.push([...labels]),
      createIssueGraphQL: async (_o, _r, title, body, labels) => {
        window.__createdMain = { title, body, labels, number: 101, id: 'ISSUE_NODE', url: 'http://x' };
        return window.__createdMain;
      },
      createIssueWithoutCopilot: async (_o, _r, title, body, labels) => {
        const child = { title, body, labels, number: 200 + window.__createdChildren.length, id: 'CHILD_NODE', url: 'http://y' };
        window.__createdChildren.push(child);
        return child;
      },
    };

    // Make a button to satisfy DOM references (not strictly needed since we call function directly)
    const btn = document.createElement('button');
    btn.id = 'create-github-issue-btn';
    document.body.appendChild(btn);

    // Inject reportData used by handler
    const data = {
      repoUrl: 'https://github.com/acme/repo',
      ruleSet,
      compliance: {
        summary: '50% compliant',
        issues: issues.map((i, idx) => ({
          id: i.id || `issue-${idx}`,
          message: i.message || `Problem ${idx + 1}`,
          error: i.error || `Details ${idx + 1}`,
          severity: i.severity || 'warning',
        })),
        compliant: [{ category: 'meta', details: { percentageCompliant: 50 } }],
      },
    };
    if (ruleSet === 'custom' && customGist) {
      data.customConfig = { gistUrl: customGist };
    }
    window.reportData = data;
  }, { ruleSet, issues, customGist });
}

test.describe('GitHub issue creation labels and body metadata', () => {
  test('main issue includes ruleset label and body Configuration/Severity Breakdown', async ({ page }) => {
    await setupPageWithReport(page, {
      ruleSet: 'partner',
      issues: [
        { id: 'missing-file-readme', message: 'Missing required file: README.md', severity: 'error' },
        { id: 'missing-workflow-ci', message: 'Missing CI workflow', severity: 'warning' },
      ],
    });

  // The handler is already included by index.html; invoke directly
  await page.waitForFunction(() => typeof window.processIssueCreation === 'function');
  await page.evaluate(() => window.processIssueCreation(window.GitHubClient));

    // Wait for main issue to be created
    await page.waitForFunction(() => !!window.__createdMain);

    const { main, ensured } = await page.evaluate(() => ({
      main: window.__createdMain,
      ensured: window.__ensuredLabels,
    }));

    // Ensure labels were created including ruleset and severity family
    const ensuredFlat = ensured.flat();
    expect(ensuredFlat).toContain('ruleset:partner');
    expect(ensuredFlat).toContain('template-doctor');
    expect(ensuredFlat).toContain('template-doctor-full-scan');
    expect(ensuredFlat).toEqual(expect.arrayContaining(['severity:high', 'severity:medium', 'severity:low']));

    // Main issue labels include ruleset label
    expect(main.labels).toEqual(expect.arrayContaining(['ruleset:partner']));

    // Body contains Configuration and Severity Breakdown
    expect(main.body).toMatch(/## Configuration/);
    expect(main.body).toMatch(/Rule Set: Partner/);
    expect(main.body).toMatch(/Severity Breakdown: High 1, Medium 1, Low 0/);
  });

  test('child issues include severity and ruleset labels plus Context section', async ({ page }) => {
    await setupPageWithReport(page, {
      ruleSet: 'custom',
      customGist: 'https://gist.github.com/user/abcd1234',
      issues: [
        { id: 'missing-file-readme', message: 'Missing required file: README.md', severity: 'error' },
        { id: 'missing-workflow-ci', message: 'Missing CI workflow', severity: 'warning' },
        { id: 'readme-format', message: 'README missing Getting Started', severity: 'info' },
      ],
    });

  await page.waitForFunction(() => typeof window.processIssueCreation === 'function');
  await page.evaluate(() => window.processIssueCreation(window.GitHubClient));

    // Wait for all children to be created
    await page.waitForFunction(() => Array.isArray(window.__createdChildren) && window.__createdChildren.length === 3);

    const children = await page.evaluate(() => window.__createdChildren);
    // Assert labels per severity
    const labelSets = children.map((c) => c.labels);
    expect(labelSets[0]).toEqual(expect.arrayContaining(['template-doctor', 'template-doctor-child-issue', 'ruleset:custom', 'severity:high']));
    expect(labelSets[1]).toEqual(expect.arrayContaining(['severity:medium']));
    expect(labelSets[2]).toEqual(expect.arrayContaining(['severity:low']));

    // Assert Context section in body with severity and rule set + gist
    expect(children[0].body).toMatch(/## Context/);
    expect(children[0].body).toMatch(/Severity: High/);
    expect(children[0].body).toMatch(/Rule Set: Custom \(custom from https:\/\/gist\.github\.com\/user\/abcd1234\)/);
  });
});
