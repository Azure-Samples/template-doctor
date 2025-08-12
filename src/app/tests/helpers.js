// @ts-check
// Helper functions for tests

/**
 * Sets up mock template data for testing
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Array<Object>} templates - Array of template objects to mock
 */
export async function setupMockTemplates(page, templates) {
  await page.evaluate((templatesData) => {
    // @ts-ignore - Adding custom property to window
    window.templatesData = templatesData;
    document.dispatchEvent(new CustomEvent('template-data-loaded'));
  }, templates);
}

/**
 * Performs a search with the given query
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} query - The search query to use
 */
export async function performSearch(page, query) {
  await page.fill('#repo-search', query);
  await page.click('#search-button');
  await page.waitForSelector('#search-results');
}

/**
 * Checks if a template is highlighted
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} templateSelector - Selector for the template
 * @returns {Promise<boolean>} - True if the template is highlighted
 */
export async function isTemplateHighlighted(page, templateSelector) {
  const hasHighlightClass = await page.evaluate((selector) => {
    const template = document.querySelector(selector);
    return template ? template.classList.contains('highlight-template') : false;
  }, templateSelector);

  return hasHighlightClass;
}

/**
 * Wait for template to be scrolled into view and highlighted
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} templateSelector - Selector for the template
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>} - True if the template is highlighted within timeout
 */
export async function waitForTemplateHighlight(page, templateSelector, timeout = 5000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const isHighlighted = await isTemplateHighlighted(page, templateSelector);
    if (isHighlighted) {
      return true;
    }
    await page.waitForTimeout(100);
  }

  return false;
}

/**
 * Extract visible text content from a selector
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} selector - Element selector
 * @returns {Promise<string>} - The text content
 */
export async function getTextContent(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? (el.textContent ? el.textContent.trim() : '') : '';
  }, selector);
}
