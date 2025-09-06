import { test, expect } from '@playwright/test';

// Extend window typing for tests (lightweight, avoids pulling full app d.ts)
declare global {
  interface Window { // eslint-disable-line @typescript-eslint/consistent-type-definitions
    GitHubAuth?: any;
    GitHubClient?: any;
  }
}

// Utility to install fetch mocks keyed by substring match
function installFetchMock(page: import('@playwright/test').Page, handlers: Record<string, { body: any; status?: number; headers?: Record<string,string> }>) {
  const orderedKeys = Object.keys(handlers).sort((a,b)=> b.length - a.length); // longest (most specific) first
  return page.route('**/*', async (route) => {
    const url = route.request().url();
    for (const key of orderedKeys) {
      if (url.includes(key)) {
        const h = handlers[key];
        const responseBody = typeof h.body === 'function' ? (h.body as (u:string)=>any)(url) : h.body;
        return route.fulfill({ status: h.status || 200, contentType: 'application/json', body: JSON.stringify(responseBody), headers: h.headers || {} });
      }
    }
    return route.fallback();
  });
}

test.describe('GitHubClientTS basic functionality', () => {
  test('request + listAllFiles + getFileContent decode base64', async ({ page }) => {
    await page.goto('/');

    // Inject auth stub and wait for client
    await page.evaluate(() => {
      window.GitHubAuth = {
        isAuthenticated: () => true,
        getAccessToken: () => 'token123',
        getToken: () => 'token123',
      };
    });

    // Install fetch mocks
    await installFetchMock(page, {
      '/user': { body: { login: 'tester' }, headers: { 'x-oauth-scopes': 'public_repo' } },
      '/repos/owner/repo': { body: { default_branch: 'main' } },
      '/repos/owner/repo/git/trees/main?recursive=1': {
        body: { tree: [ { path: 'README.md', type: 'blob', sha: '1' }, { path: 'src/index.js', type: 'blob', sha: '2' } ] },
      },
      '/repos/owner/repo/git/trees/main': { body: { tree: [ { path: 'README.md', type: 'blob', sha: '1' } ] } },
      '/repos/owner/repo/contents/README.md': {
        body: { content: btoa('# Title'), encoding: 'base64' },
      },
    });

    await page.waitForFunction(() => !!window.GitHubClient && typeof window.GitHubClient.ready === 'function');
    await page.evaluate(() => window.GitHubClient.ready());

    const files = await page.evaluate(async () => window.GitHubClient.listAllFiles('owner', 'repo'));
    expect(files).toEqual(expect.arrayContaining(['README.md', 'src/index.js']));

    const readme = await page.evaluate(async () => window.GitHubClient.getFileContent('owner','repo','README.md'));
    expect(readme).toContain('# Title');
  });

  test('createIssueGraphQL with copilot assignment path & label resolution', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.GitHubAuth = { isAuthenticated: () => true, getAccessToken: () => 't', getToken: () => 't' };
    });

    // Prepare dynamic counters
    let issueNumber = 42;

    await page.route('**/graphql', async (route) => {
      const body = await route.request().postDataJSON();
      const query: string = body.query || '';
      let response: any = {};
      if (/repository\(owner:\$owner,name:\$name\)\{ id \}/.test(query)) {
        // getRepoNodeId
        response = { data: { repository: { id: 'REPO_ID' } } };
      } else if (/labels\(first:100\)/.test(query)) {
        // getLabelNodeIds
        response = { data: { repository: { labels: { nodes: [ { id: 'L1', name: 'bug' }, { id: 'L2', name: 'template-doctor' } ] } } } };
      } else if (/suggestedActors/.test(query) && /repository\(owner:\$owner,name:\$repo\)/.test(query)) {
        // suggestedActors query before mutation
        response = { data: { repository: { id: 'REPO_ID', suggestedActors: { nodes: [ { login: 'copilot-agent-swe', id: 'COPILOT_ID', __typename: 'Bot' } ] } } } };
      } else if (/mutation\(\$input:CreateIssueInput!\)/.test(query)) {
        // createIssueGraphQL with assigneeIds (copilot path)
        response = { data: { createIssue: { issue: { id: 'NEW_ISSUE', number: issueNumber, url: 'http://x', title: body.variables?.input?.title || 'T', assignees: { nodes: [ { login: 'copilot-agent-swe', id: 'COPILOT_ID' } ] } } } } };
      } else {
        response = { data: {} };
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
    });
    await installFetchMock(page, {
      '/rate_limit': { body: {}, headers: { 'x-oauth-scopes': 'public_repo' } },
    });

    // Mock user endpoint (bootstrap attempts to load /user when authenticated)
    await installFetchMock(page, {
      '/user': { body: { login: 'tester' } },
    });

    await page.waitForFunction(() => !!window.GitHubClient && typeof window.GitHubClient.ready === 'function');
    await page.evaluate(async () => { await window.GitHubClient.ready(); });

      // Force scopes to include repo to avoid flakiness around header inspection
      await page.evaluate(() => { window.GitHubClient.checkTokenScopes = async () => ['repo']; });
      const result = await page.evaluate(async () => window.GitHubClient.createIssueGraphQL('ownerX','repoX','T','Body',['template-doctor']));

    expect(result.number).toBe(42);
    expect(result.assignees?.nodes?.[0]?.login).toBe('copilot-agent-swe');
  });

  test('forkRepository polls for availability then returns confirmed', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.GitHubAuth = { isAuthenticated: () => true, getAccessToken: () => 't', getToken: () => 't' };
    });

    let pollCount = 0;
    await installFetchMock(page, {
      '/repos/sourceOwner/sourceRepo/forks': { body: { name: 'fork pending' } },
      '/repos/userSelf/sourceRepo': {
        body: () => {
          pollCount++;
          if (pollCount < 2) {
            return { fork: false };
          }
          return { fork: true, parent: { full_name: 'sourceOwner/sourceRepo' }, full_name: 'userSelf/sourceRepo' };
        }
      },
      '/user': { body: { login: 'userSelf' }, headers: { 'x-oauth-scopes': 'public_repo' } },
    });

    await page.waitForFunction(() => !!window.GitHubClient);
    await page.evaluate(() => window.GitHubClient.ready());

    const forked = await page.evaluate(async () => window.GitHubClient.forkRepository('sourceOwner','sourceRepo'));
    expect(forked.full_name).toBe('userSelf/sourceRepo');
  });
});
