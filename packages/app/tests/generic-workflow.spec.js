import { test, expect } from '@playwright/test';

test.describe('Generic Workflow System', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to demo page
    await page.goto('http://localhost:3000/workflow-demo.html');
  });

  test('should load workflow demo page', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Workflow Demo');
    await expect(page.locator('input[name="template-url"]')).toBeVisible();
    await expect(page.locator('button[data-action="start-workflow"]')).toBeVisible();
  });

  test('should display workflow configuration on setup page', async ({ page }) => {
    await page.goto('http://localhost:3000/setup');

    // Wait for workflow configs to load
    await page.waitForSelector('[data-section="workflow-configs"]', { timeout: 5000 });

    // Check for workflow configuration section
    const workflowSection = page.locator('[data-section="workflow-configs"]');
    await expect(workflowSection).toBeVisible();

    // Should show at least one workflow (azd-validation)
    const workflowCards = page.locator('.workflow-card');
    await expect(workflowCards.first()).toBeVisible();
  });

  test('should show validation error for invalid template URL', async ({ page }) => {
    await page.fill('input[name="template-url"]', 'not-a-url');
    await page.click('button[data-action="start-workflow"]');

    // Should show error notification
    await expect(page.locator('.notification.error')).toBeVisible();
    await expect(page.locator('.notification.error')).toContainText('invalid');
  });

  test('should initialize workflow UI with correct state', async ({ page }) => {
    const templateUrl = 'https://github.com/Azure-Samples/todo-nodejs-mongo';
    
    await page.fill('input[name="template-url"]', templateUrl);
    await page.click('button[data-action="start-workflow"]');

    // Wait for workflow UI to appear
    await page.waitForSelector('.td-workflow-ui', { timeout: 5000 });

    // Check initial state
    const workflowUI = page.locator('.td-workflow-ui');
    await expect(workflowUI).toBeVisible();
    await expect(workflowUI).toHaveClass(/td-workflow-running/);

    // Progress bar should be visible
    await expect(page.locator('.td-workflow-progress')).toBeVisible();
  });

  test('should display workflow progress bar', async ({ page }) => {
    const templateUrl = 'https://github.com/Azure-Samples/todo-nodejs-mongo';
    
    await page.fill('input[name="template-url"]', templateUrl);
    await page.click('button[data-action="start-workflow"]');

    await page.waitForSelector('.td-workflow-progress-inner', { timeout: 5000 });

    // Progress bar should have width set
    const progressBar = page.locator('.td-workflow-progress-inner');
    const width = await progressBar.evaluate(el => el.style.width);
    expect(parseInt(width)).toBeGreaterThan(0);
  });

  test('should show cancel button during workflow execution', async ({ page }) => {
    const templateUrl = 'https://github.com/Azure-Samples/todo-nodejs-mongo';
    
    await page.fill('input[name="template-url"]', templateUrl);
    await page.click('button[data-action="start-workflow"]');

    await page.waitForSelector('[data-action="cancel-workflow"]', { timeout: 5000 });

    const cancelButton = page.locator('[data-action="cancel-workflow"]');
    await expect(cancelButton).toBeVisible();
    await expect(cancelButton).toBeEnabled();
  });

  test('should handle workflow cancellation', async ({ page }) => {
    const templateUrl = 'https://github.com/Azure-Samples/todo-nodejs-mongo';
    
    await page.fill('input[name="template-url"]', templateUrl);
    await page.click('button[data-action="start-workflow"]');

    await page.waitForSelector('[data-action="cancel-workflow"]', { timeout: 5000 });

    // Click cancel
    await page.click('[data-action="cancel-workflow"]');

    // Should show cancellation confirmation or notification
    await expect(page.locator('.notification')).toBeVisible();
  });

  test('should display job logs when streamLogs enabled', async ({ page }) => {
    const templateUrl = 'https://github.com/Azure-Samples/todo-nodejs-mongo';
    
    await page.fill('input[name="template-url"]', templateUrl);
    await page.click('button[data-action="start-workflow"]');

    // Wait for logs section to appear
    await page.waitForSelector('.td-workflow-logs', { timeout: 10000 });

    const logsSection = page.locator('.td-workflow-logs');
    await expect(logsSection).toBeVisible();
  });

  test('should show workflow completion status', async ({ page }) => {
    const templateUrl = 'https://github.com/Azure-Samples/todo-nodejs-mongo';
    
    await page.fill('input[name="template-url"]', templateUrl);
    await page.click('button[data-action="start-workflow"]');

    // Wait for workflow to complete (or timeout after 5 minutes)
    await page.waitForSelector('.td-workflow-ui.td-workflow-success, .td-workflow-ui.td-workflow-failure', {
      timeout: 300000, // 5 minutes
    });

    // Should show success or failure state
    const workflowUI = page.locator('.td-workflow-ui');
    const hasCompletedState = await workflowUI.evaluate(el => 
      el.classList.contains('td-workflow-success') || 
      el.classList.contains('td-workflow-failure')
    );
    expect(hasCompletedState).toBe(true);
  });

  test('should display parsed results after completion', async ({ page }) => {
    const templateUrl = 'https://github.com/Azure-Samples/todo-nodejs-mongo';
    
    await page.fill('input[name="template-url"]', templateUrl);
    await page.click('button[data-action="start-workflow"]');

    // Wait for results section
    await page.waitForSelector('.td-workflow-results', { timeout: 300000 });

    const resultsSection = page.locator('.td-workflow-results');
    await expect(resultsSection).toBeVisible();

    // Should contain parsed validation details or JSON
    const content = await resultsSection.textContent();
    expect(content.length).toBeGreaterThan(0);
  });

  test('should link to GitHub Actions run', async ({ page }) => {
    const templateUrl = 'https://github.com/Azure-Samples/todo-nodejs-mongo';
    
    await page.fill('input[name="template-url"]', templateUrl);
    await page.click('button[data-action="start-workflow"]');

    // Wait for GitHub link
    await page.waitForSelector('a[href*="github.com"][href*="/actions/runs/"]', {
      timeout: 10000,
    });

    const githubLink = page.locator('a[href*="github.com"][href*="/actions/runs/"]');
    await expect(githubLink).toBeVisible();
    await expect(githubLink).toHaveAttribute('target', '_blank');
  });

  test('should persist workflow state in localStorage', async ({ page }) => {
    const templateUrl = 'https://github.com/Azure-Samples/todo-nodejs-mongo';
    
    await page.fill('input[name="template-url"]', templateUrl);
    await page.click('button[data-action="start-workflow"]');

    // Wait for workflow to start
    await page.waitForSelector('.td-workflow-ui', { timeout: 5000 });

    // Check localStorage
    const savedState = await page.evaluate(() => {
      const key = Object.keys(localStorage).find(k => k.startsWith('workflow-'));
      return key ? localStorage.getItem(key) : null;
    });

    expect(savedState).not.toBeNull();
    const state = JSON.parse(savedState);
    expect(state).toHaveProperty('workflowId');
    expect(state).toHaveProperty('runId');
  });

  test('should auto-resume workflow from localStorage', async ({ page }) => {
    // Start a workflow
    const templateUrl = 'https://github.com/Azure-Samples/todo-nodejs-mongo';
    
    await page.fill('input[name="template-url"]', templateUrl);
    await page.click('button[data-action="start-workflow"]');

    await page.waitForSelector('.td-workflow-ui', { timeout: 5000 });

    // Get the run ID from localStorage
    const runId = await page.evaluate(() => {
      const key = Object.keys(localStorage).find(k => k.startsWith('workflow-'));
      const state = key ? JSON.parse(localStorage.getItem(key)) : null;
      return state?.runId;
    });

    // Reload the page
    await page.reload();

    // Workflow should auto-resume if still within 2-hour window
    await page.waitForSelector('.td-workflow-ui', { timeout: 5000 });
    
    const workflowUI = page.locator('.td-workflow-ui');
    await expect(workflowUI).toBeVisible();
  });

  test('should handle authentication errors gracefully', async ({ page }) => {
    // Clear OAuth token
    await page.evaluate(() => localStorage.removeItem('github_token'));

    const templateUrl = 'https://github.com/Azure-Samples/todo-nodejs-mongo';
    
    await page.fill('input[name="template-url"]', templateUrl);
    await page.click('button[data-action="start-workflow"]');

    // Should show authentication error
    await expect(page.locator('.notification.error')).toBeVisible();
    await expect(page.locator('.notification.error')).toContainText('authentication');
  });

  test('should display different states with correct CSS classes', async ({ page }) => {
    const templateUrl = 'https://github.com/Azure-Samples/todo-nodejs-mongo';
    
    await page.fill('input[name="template-url"]', templateUrl);
    await page.click('button[data-action="start-workflow"]');

    const workflowUI = page.locator('.td-workflow-ui');

    // Should start with running state
    await expect(workflowUI).toHaveClass(/td-workflow-running/);

    // Eventually should transition to success or failure
    await page.waitForSelector(
      '.td-workflow-ui.td-workflow-success, .td-workflow-ui.td-workflow-failure',
      { timeout: 300000 }
    );

    const finalState = await workflowUI.getAttribute('class');
    expect(finalState).toMatch(/td-workflow-(success|failure)/);
  });
});

test.describe('Workflow Service Integration', () => {
  test('should fetch workflow configurations', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Call API directly
    const response = await page.request.get('http://localhost:3000/api/v4/workflows');
    
    expect(response.ok()).toBe(true);
    const workflows = await response.json();
    expect(Array.isArray(workflows)).toBe(true);
    expect(workflows.length).toBeGreaterThan(0);

    // Should include azd-validation
    const azdValidation = workflows.find(w => w.id === 'azd-validation');
    expect(azdValidation).toBeDefined();
    expect(azdValidation.name).toBe('AZD Template Validation');
  });

  test('should require authentication for workflow execution', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Try to execute without token
    const response = await page.request.post('http://localhost:3000/api/v4/workflow-execute', {
      data: {
        workflowId: 'azd-validation',
        owner: 'Azure-Samples',
        repo: 'todo-nodejs-mongo',
      },
    });

    expect(response.status()).toBe(401);
  });
});
