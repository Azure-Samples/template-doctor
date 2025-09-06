// @ts-nocheck
import { test, expect } from '@playwright/test';
import { mockAuthentication } from './helpers/auth';

// Inline mock removed in favor of shared helper

/**
 * Test suite for app.js functionality
 */
test.describe('App.js Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Mock authentication
    await mockAuthentication(page); // (per-test auth mocking now handled via helper)
  });

  test('should initialize app services correctly', async ({ page }) => {
    // Wait for migrated module globals to be present (TemplateAnalyzer & DashboardRenderer may initialize after GitHubClient)
    await page.waitForFunction(() => {
      return !!window.GitHubAuth && !!window.TemplateAnalyzer && !!window.DashboardRenderer;
    }, { timeout: 10000 });
    // Check if app services are initialized
    const servicesInitialized = await page.evaluate(() => {
      return {
        auth: !!window.GitHubAuth,
        github: !!window.GitHubClient,
        analyzer: !!window.TemplateAnalyzer,
        dashboard: !!window.DashboardRenderer,
      };
    });

    expect(servicesInitialized.auth).toBeTruthy();
    expect(servicesInitialized.github).toBeTruthy();
    expect(servicesInitialized.analyzer).toBeTruthy();
    expect(servicesInitialized.dashboard).toBeTruthy();
  });

  test('should handle authentication errors gracefully', async ({ page }) => {
    // Simulate authentication error
    await page.evaluate(() => {
      sessionStorage.setItem('auth_error', 'Mock authentication error');
    });

    // Reload the page
    await page.reload();

    // Check if error message is displayed
    const errorMessage = await page.locator('.auth-error').textContent();
    expect(errorMessage).toContain('Mock authentication error');
  });

  test('should load scanned templates correctly', async ({ page }) => {
    // Mock scanned templates data
    await page.evaluate(() => {
      window.templatesData = [
        {
          repoUrl: 'https://github.com/test-owner/test-repo',
          relativePath: 'test-owner-test-repo',
          compliance: { percentage: 85, issues: 3, passed: 17 },
          timestamp: new Date('2023-01-01').toISOString(),
          scannedBy: ['test-user'],
        },
      ];

      document.dispatchEvent(new CustomEvent('template-data-loaded'));
    });
    // Wait for at least one template-card to appear (template-list renders asynchronously)
    await page.waitForFunction(() => document.querySelectorAll('.template-card').length > 0, { timeout: 5000 });
    const templateCount = await page.locator('.template-card').count();
    expect(templateCount).toBe(1);
  });

  test('should handle search functionality', async ({ page }) => {
    // Mock GitHub login
    await page.evaluate(() => {
      const mockUserInfo = {
        login: 'test-user',
        name: 'Test User',
        avatarUrl: 'https://avatars.githubusercontent.com/u/0',
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
        },
      };

      window.GitHubAuth.updateUI();
    });

    // Mock scanned templates data
    await page.evaluate(() => {
      window.templatesData = [
        {
          repoUrl: 'https://github.com/test-owner/test-repo',
          relativePath: 'test-owner-test-repo',
          compliance: { percentage: 85, issues: 3, passed: 17 },
          timestamp: new Date('2023-01-01').toISOString(),
          scannedBy: ['test-user'],
        },
      ];

      document.dispatchEvent(new CustomEvent('template-data-loaded'));
    });

    // Ensure search input and button are visible
    await page.waitForSelector('#repo-search', { timeout: 10000 });
    await page.waitForSelector('#search-button', { timeout: 10000 });

  // Pre-fill search box BEFORE injecting template data so auto-search (in search.ts) can run
      await page.fill('#repo-search', 'test-repo');
      // Trigger deterministic search via custom event hook
      await page.evaluate(() => {
        const el = document.getElementById('repo-search');
        const value = el && 'value' in el ? el.value : 'test-repo';
        document.dispatchEvent(new CustomEvent('perform-test-search', { detail: { query: value } }));
      });
      // Wait for explicit results-ready event
    await page.waitForFunction(() => (window).__lastSearchResultsCount === 1 || document.querySelectorAll('[data-test="repo-item"]').length > 0, { timeout: 5000 });
      const searchResultsCount = await page.locator('[data-test="repo-item"]').count();
    expect(searchResultsCount).toBe(1);
  });
});
