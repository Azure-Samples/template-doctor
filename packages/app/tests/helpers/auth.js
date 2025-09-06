// Shared authentication mock helper for Playwright tests
// Provides a consistent way to inject a GitHubAuth stub into the browser context.
// Usage: await mockAuthentication(page, { login: 'alice' });

/**
 * @param {import('@playwright/test').Page} page
 * @param {Object} [opts]
 * @param {string} [opts.login]
 * @param {string} [opts.name]
 * @param {string} [opts.token]
 */
export async function mockAuthentication(page, opts = {}) {
  const {
    login = 'test-user',
    name = 'Test User',
    token = 'mock_access_token',
  } = opts;

  await page.evaluate(({ login, name, token }) => {
    const mockUserInfo = {
      login,
      name,
      avatarUrl: 'https://avatars.githubusercontent.com/u/0',
    };

    localStorage.setItem('gh_access_token', token);
    localStorage.setItem('gh_user_info', JSON.stringify(mockUserInfo));

    (window).GitHubAuth = {
      accessToken: token,
      userInfo: mockUserInfo,
      isAuthenticated: () => true,
      getAccessToken: () => token,
      getToken: () => token,
      getUserInfo: () => mockUserInfo,
      getUsername: () => login,
      checkAuthentication: () => true,
      updateUI: () => {},
      logout: () => {},
    };
  }, { login, name, token });
}

export async function mockMinimalAuth(page) {
  await page.evaluate(() => {
    (window).GitHubAuth = {
      isAuthenticated: () => true,
      getAccessToken: () => 't',
      getToken: () => 't',
      getUsername: () => 'test-user',
    };
  });
}
