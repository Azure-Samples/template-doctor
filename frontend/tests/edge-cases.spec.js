// @ts-nocheck
import { test, expect } from '@playwright/test';

/**
 * Mock authentication state
 */
async function mockAuthentication(page) {
  await page.evaluate(() => {
    // Create mock user info
    const mockUserInfo = {
      login: 'test-user',
      name: 'Test User',
      avatarUrl: 'https://avatars.githubusercontent.com/u/0'
    };
    
    // Mock localStorage values
    localStorage.setItem('gh_access_token', 'mock_access_token');
    localStorage.setItem('gh_user_info', JSON.stringify(mockUserInfo));
    
    // Create auth elements if they don't exist
    if (!document.getElementById('user-profile')) {
      const header = document.querySelector('header') || document.body;
      // Create user profile element
      const userProfile = document.createElement('div');
      userProfile.id = 'user-profile';
      userProfile.style.display = 'flex';
      
      // Create username element
      const username = document.createElement('span');
      username.id = 'username';
      username.textContent = mockUserInfo.name;
      userProfile.appendChild(username);
      
      // Create user avatar
      const userAvatar = document.createElement('img');
      userAvatar.id = 'user-avatar';
      userAvatar.src = mockUserInfo.avatarUrl;
      userProfile.appendChild(userAvatar);
      
      header.appendChild(userProfile);
    }
    
    // Hide login button if it exists
    const loginButton = document.getElementById('login-button');
    if (loginButton) {
      loginButton.style.display = 'none';
    }
    
    // Show search section if it exists
    const searchSection = document.getElementById('search-section');
    if (searchSection) {
      searchSection.style.display = 'block';
    }
    
    // Hide welcome section if it exists
    const welcomeSection = document.getElementById('welcome-section');
    if (welcomeSection) {
      welcomeSection.style.display = 'none';
    }
    
    // Create mock auth object
    window.GitHubAuth = {
      accessToken: 'mock_access_token',
      userInfo: mockUserInfo,
      isAuthenticated: () => true,
      getAccessToken: () => 'mock_access_token',
      getUserInfo: () => mockUserInfo,
      checkAuthentication: () => true,
      updateUI: () => {}
    };
  });
}

// Test suite for edge cases in the URL matching and template finding logic
test.describe('Template Doctor Edge Cases', () => {
  // Setup for each test: navigate to the application
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Mock authentication first - this is critical for the app to function correctly
    await mockAuthentication(page);
    
    // Wait for the app to initialize
    await page.waitForSelector('#search-section');

    // Define test data for templates with edge cases
    await page.evaluate(() => {
      window.templatesData = [
        // Repo with trailing slash in URL
        {
          repoUrl: 'https://github.com/edge-owner/trailing-slash/',
          relativePath: 'edge-owner-trailing-slash',
          compliance: { percentage: 85, issues: 3, passed: 17 },
          timestamp: new Date().toISOString(),
          scannedBy: ['edge-user']
        },
        // Repo with .git extension
        {
          repoUrl: 'https://github.com/edge-owner/git-extension.git',
          relativePath: 'edge-owner-git-extension',
          compliance: { percentage: 72, issues: 5, passed: 13 },
          timestamp: new Date().toISOString(),
          scannedBy: ['edge-user']
        },
        // Two repos with same name but different owners
        {
          repoUrl: 'https://github.com/owner-one/same-name-repo',
          relativePath: 'owner-one-same-name-repo',
          compliance: { percentage: 95, issues: 1, passed: 19 },
          timestamp: new Date().toISOString(),
          scannedBy: ['owner-one']
        },
        {
          repoUrl: 'https://github.com/owner-two/same-name-repo',
          relativePath: 'owner-two-same-name-repo',
          compliance: { percentage: 80, issues: 4, passed: 16 },
          timestamp: new Date().toISOString(),
          scannedBy: ['owner-two']
        }
      ];
      
      // Dispatch the template data loaded event
      document.dispatchEvent(new CustomEvent('template-data-loaded'));
    });
  });

  // Test finding repo with trailing slash
  test('should find repo with trailing slash', async ({ page }) => {
    // Mock GitHub login
    await page.evaluate(() => {
      const mockUserInfo = {
        login: 'test-user',
        name: 'Test User',
        avatarUrl: 'https://avatars.githubusercontent.com/u/0'
      };

      localStorage.setItem('gh_access_token', 'mock_access_token');
      localStorage.setItem('gh_user_info', JSON.stringify(mockUserInfo));

      window.GitHubAuth = {
        accessToken: 'mock_access_token',
        userInfo: mockUserInfo,
        isAuthenticated: () => true,
        getAccessToken: () => 'mock_access_token',
        getUserInfo: () => mockUserInfo,
        checkAuthentication: () => true,
        updateUI: () => {
          const searchSection = document.getElementById('search-section');
          if (searchSection) {
            searchSection.style.display = 'block';
          }
        }
      };

      window.GitHubAuth.updateUI();
    });

    // Mock scanned templates data
    await page.evaluate(() => {
      window.templatesData = [
        {
          repoUrl: 'https://github.com/edge-owner/trailing-slash/',
          relativePath: 'edge-owner-trailing-slash',
          compliance: { percentage: 90, issues: 2, passed: 18 },
          timestamp: new Date('2023-01-02').toISOString(),
          scannedBy: ['edge-user']
        }
      ];

      document.dispatchEvent(new CustomEvent('template-data-loaded'));
    });

    // Ensure search input and button are visible
    await page.waitForSelector('#repo-search', { timeout: 10000 });
    await page.waitForSelector('#search-button', { timeout: 10000 });

    // Perform search
    await page.fill('#repo-search', 'https://github.com/edge-owner/trailing-slash');
    await page.click('#search-button');

    // Wait for search results to load
    await page.waitForSelector('#search-results', { timeout: 10000 });

    // Check if template is highlighted
    const isHighlighted = await page.evaluate(() => {
      const template = document.querySelector('.template-card[data-repo-url="https://github.com/edge-owner/trailing-slash/"]');
      return template ? template.classList.contains('highlight-template') : false;
    });
  });

  // Test finding repo with .git extension
  test('should find repo with .git extension', async ({ page }) => {
    // Search without .git extension
    await page.fill('#repo-search', 'git-extension');
    await page.click('#search-button');
    
    // Wait for search results
    await page.waitForSelector('#search-results');
    
    // Verify previously scanned badge appears
    const scannedBadge = await page.locator('.scanned-badge').first();
    expect(await scannedBadge.isVisible()).toBeTruthy();
  });

  // Test finding repo when there are multiple repos with the same name
  test('should find repos with the same name', async ({ page }) => {
    // Search for the common repo name
    await page.fill('#repo-search', 'same-name-repo');
    await page.click('#search-button');
    
    // Wait for search results
    await page.waitForSelector('#search-results');
    
    // Verify previously scanned badge appears
    const scannedBadge = await page.locator('.scanned-badge').first();
    expect(await scannedBadge.isVisible()).toBeTruthy();
  });
});
