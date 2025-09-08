// @ts-nocheck
import { test, expect } from '@playwright/test';

// Focus: validate new README rule mappings & snippet presence in formatted issue bodies
// We'll stub minimal analyzer output and invoke processIssueCreation to inspect child issues.

async function setup(page, injectedIssues) {
  await page.goto('/');
  await page.evaluate((issues) => {
    window.Notifications = { loading: () => ({ update:()=>{}, success:()=>{}, error:()=>{}, close:()=>{} }), confirm: (_t,_m,{onConfirm}) => onConfirm(), error:()=>{}, warning:()=>{}, info:()=>{} };
    window.__createdChildren = [];
    window.__createdMain = null;
    window.GitHubClient = {
      auth: { isAuthenticated: () => true, getAccessToken: () => 't' },
      checkTokenScopes: async () => ['public_repo'],
      getRepository: async () => ({ id: 1 }),
      findIssuesByTitle: async () => [],
      ensureLabelsExist: async () => {},
      createIssueGraphQL: async (_o,_r,title,body,labels) => { window.__createdMain = { title, body, labels }; return window.__createdMain; },
      createIssueWithoutCopilot: async (_o,_r,title,body,labels) => { const child = { title, body, labels }; window.__createdChildren.push(child); return child; }
    };
    window.reportData = {
      repoUrl: 'https://github.com/acme/repo',
      ruleSet: 'dod',
      compliance: { issues, compliant: [{ category:'meta', details:{ percentageCompliant:40 }}], summary: 'Issues found' }
    };
  }, injectedIssues);
}

// Helper to find a child body by id marker text
function findChildContaining(children, re) { return children.find(c => re.test(c.body)); }

test.describe('Rule mapping & formatting for README and azure/bicep snippets', () => {
  test('maps new README rule family IDs to specific guidance and includes acceptance criteria with percentage', async ({ page }) => {
    await setup(page, [
      { id: 'readme-missing-heading-prerequisites', message: 'README.md is missing required h2 heading: Prerequisites', severity: 'error' },
      { id: 'readme-missing-architecture-diagram-heading', message: 'README.md is missing required h2 heading: Architecture', severity: 'error' },
      { id: 'readme-missing-architecture-diagram-image', message: 'Architecture Diagram section does not contain an image', severity: 'error' }
    ]);
    await page.waitForFunction(() => typeof window.processIssueCreation === 'function');
    await page.evaluate(() => window.processIssueCreation(window.GitHubClient));
    await page.waitForFunction(() => window.__createdChildren && window.__createdChildren.length === 3);
    const children = await page.evaluate(() => window.__createdChildren);

    // Assert distinct phrasing per rule family
    expect(findChildContaining(children, /Add the missing README heading/)).toBeTruthy();
    expect(findChildContaining(children, /Add an Architecture \(H2\) section/)).toBeTruthy();
    expect(findChildContaining(children, /architecture diagram image/i)).toBeTruthy();

    // Acceptance criteria includes current compliance %
    const withPct = children.find(c => /Overall compliance improves above current 40%\./.test(c.body));
    expect(withPct).toBeTruthy();
  });

  test('includes azure.yaml snippet and bicep snippet when missing resources', async ({ page }) => {
    await setup(page, [
      { id: 'azure-yaml-missing-services', message: 'No "services:" defined in azure.yaml', severity: 'error', filePath: 'azure.yaml', snippet: 'name: app\nlocation: westus' },
      { id: 'bicep-missing-microsoft.keyvault/vaults', message: 'Missing resource "Microsoft.KeyVault/vaults" in infra/main.bicep', severity: 'error', filePath: 'infra/main.bicep', snippet: 'resource kv \n// snippet' }
    ]);
    await page.waitForFunction(() => typeof window.processIssueCreation === 'function');
    await page.evaluate(() => window.processIssueCreation(window.GitHubClient));
    await page.waitForFunction(() => window.__createdChildren && window.__createdChildren.length === 2);
    const children = await page.evaluate(() => window.__createdChildren);

    const azureChild = findChildContaining(children, /azure.yaml/);
    const bicepChild = findChildContaining(children, /infra\/main.bicep/);

    expect(azureChild.body).toMatch(/```\nazure.yaml/);
    expect(bicepChild.body).toMatch(/```\ninfra\/main.bicep/);
  });
});
