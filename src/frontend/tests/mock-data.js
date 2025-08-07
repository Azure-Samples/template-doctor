// @ts-check

/**
 * Mock template data for testing URL matching and template highlighting
 */
export const mockTemplateData = [
  // Standard repo URL format
  {
    repoUrl: 'https://github.com/test-owner/test-repo',
    relativePath: 'test-owner-test-repo',
    compliance: { percentage: 85, issues: 3, passed: 17 },
    timestamp: new Date('2023-01-01').toISOString(),
    scannedBy: ['test-user']
  },
  // URL with trailing slash
  {
    repoUrl: 'https://github.com/edge-owner/trailing-slash/',
    relativePath: 'edge-owner-trailing-slash',
    compliance: { percentage: 90, issues: 2, passed: 18 },
    timestamp: new Date('2023-01-02').toISOString(),
    scannedBy: ['edge-user']
  },
  // URL with .git extension
  {
    repoUrl: 'https://github.com/edge-owner/git-extension.git',
    relativePath: 'edge-owner-git-extension',
    compliance: { percentage: 72, issues: 5, passed: 13 },
    timestamp: new Date('2023-01-03').toISOString(),
    scannedBy: ['edge-user']
  },
  // Two repos with same name but different owners
  {
    repoUrl: 'https://github.com/owner-one/same-name-repo',
    relativePath: 'owner-one-same-name-repo',
    compliance: { percentage: 95, issues: 1, passed: 19 },
    timestamp: new Date('2023-01-04').toISOString(),
    scannedBy: ['owner-one']
  },
  {
    repoUrl: 'https://github.com/owner-two/same-name-repo',
    relativePath: 'owner-two-same-name-repo',
    compliance: { percentage: 80, issues: 4, passed: 16 },
    timestamp: new Date('2023-01-05').toISOString(), 
    scannedBy: ['owner-two']
  }
];

/**
 * Set up a page mock for testing
 * 
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<void>} - Promise that resolves when mocking is complete
 */
export async function setupMockPage(page) {
  // Intercept API calls
  await page.route('**/api/templates**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockTemplateData)
    });
  });
  
  // Setup any global variables or event handlers needed for testing
  await page.evaluate(() => {
    // @ts-ignore - Adding custom property to window
    window.templatesData = [];
    
    // Ensure we have a search section that's visible
    if (!document.getElementById('search-section')) {
      const searchSection = document.createElement('div');
      searchSection.id = 'search-section';
      searchSection.style.display = 'block';
      document.body.appendChild(searchSection);
      
      const searchInput = document.createElement('input');
      searchInput.id = 'repo-search';
      searchInput.type = 'text';
      searchSection.appendChild(searchInput);
      
      const searchButton = document.createElement('button');
      searchButton.id = 'search-button';
      searchButton.textContent = 'Search';
      searchSection.appendChild(searchButton);
      
      const searchResults = document.createElement('div');
      searchResults.id = 'search-results';
      searchSection.appendChild(searchResults);
    }
    
    // Ensure we have a templates section
    if (!document.getElementById('templates-section')) {
      const templatesSection = document.createElement('div');
      templatesSection.id = 'templates-section';
      document.body.appendChild(templatesSection);
      
      const templateGrid = document.createElement('div');
      templateGrid.id = 'template-grid';
      templatesSection.appendChild(templateGrid);
    }
    
    // Mock loading the templates data
    window.addEventListener('template-data-loaded', () => {
      console.log('Template data loaded event fired');
    });
    
    // Track scroll operations for testing
    // @ts-ignore - Adding custom property to window
    window.scrollOperations = [];
    const originalScrollTo = window.scrollTo;
    window.scrollTo = function(...args) {
      // @ts-ignore - Adding custom property to window
      window.scrollOperations.push({
        method: 'scrollTo',
        args: args
      });
      return originalScrollTo.apply(this, args);
    };
  });
}

/**
 * Generate a DOM selector for a template based on repo URL
 * 
 * @param {string} repoUrl - The repository URL for the template
 * @returns {string} - CSS selector for the template
 */
export function getTemplateSelector(repoUrl) {
  // Get the repo name from the URL
  const parts = repoUrl.split('/');
  const lastPart = parts.pop() || '';
  const repoName = lastPart.replace('.git', '');
  return `.template-card[data-repo-name="${repoName}"]`;
}
