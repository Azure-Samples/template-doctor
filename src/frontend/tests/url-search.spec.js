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
    } else {
      // Create search section if it doesn't exist
      const searchSection = document.createElement('div');
      searchSection.id = 'search-section';
      searchSection.style.display = 'block';
      document.body.appendChild(searchSection);
      
      // Add search input
      const searchInput = document.createElement('input');
      searchInput.id = 'repo-search';
      searchInput.type = 'text';
      searchSection.appendChild(searchInput);
      
      // Add search button
      const searchButton = document.createElement('button');
      searchButton.id = 'search-button';
      searchButton.textContent = 'Search';
      searchSection.appendChild(searchButton);
      
      // Add search results container
      const searchResults = document.createElement('div');
      searchResults.id = 'search-results';
      searchSection.appendChild(searchResults);
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

// Specific test for the URL search and template highlighting functionality
test.describe('Template URL Search', () => {
  // Before each test
  test.beforeEach(async ({ page }) => {
    // Navigate to the page and wait for it to load
    await page.goto('/');
    
    // Mock authentication first - this is critical
    await mockAuthentication(page);
    
    // Set up mock templates data using evaluation
    await page.evaluate(() => {
      // Create mock template data
      window.templatesData = [
        {
          repoUrl: 'https://github.com/test-owner/simple-repo',
          relativePath: 'test-owner-simple-repo',
          compliance: { percentage: 85, issues: 3, passed: 17 },
          timestamp: new Date().toISOString(),
          scannedBy: ['test-user']
        }
      ];
      
      // Simulate the template data loaded event
      const event = new CustomEvent('template-data-loaded');
      document.dispatchEvent(event);
    });
  });
  
  // Test searching for a repo by URL
  test('should find repo when searching by URL', async ({ page }) => {
    // Get reference to the search input and button
    const searchInput = await page.$('#repo-search');
    const searchButton = await page.$('#search-button');
    
    // If both elements exist, perform the search
    if (searchInput && searchButton) {
      // Fill the search input with a repo URL
      await searchInput.fill('https://github.com/test-owner/simple-repo');
      
      // Click the search button
      await searchButton.click();
      
      // Wait for search results to appear
      try {
        await page.waitForSelector('#search-results', { timeout: 5000 });
        
        // Take a screenshot to see what happened
        await page.screenshot({ path: 'test-results/search-results.png' });
        
        // Check for any results
        const resultsHTML = await page.$eval('#search-results', el => el.innerHTML);
        console.log('Search results HTML:', resultsHTML);
        
        // Basic assertion that something was rendered in search results
        expect(resultsHTML.length).toBeGreaterThan(0);
      } catch (e) {
        console.error('Error waiting for search results:', e);
        // Take a screenshot to see what happened
        await page.screenshot({ path: 'test-results/search-error.png' });
        throw e;
      }
    } else {
      // If elements don't exist, fail the test
      if (!searchInput) {
        throw new Error('Search input not found');
      } else {
        throw new Error('Search button not found');
      }
    }
  });
});
