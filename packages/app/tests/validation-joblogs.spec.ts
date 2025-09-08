import { test, expect } from '@playwright/test';

// Tests rendering of job logs list.

test.describe('Validation Job Logs', () => {
  test('renders job logs when includeJobLogs enabled', async ({ page }) => {
    await page.addInitScript(() => { (window as any).__ValidationTestOverrides = { polling:{ intervalMs:150, maxAttempts:5 } }; });
    await page.route('**/validation-template**', (route) => { route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ runId:'JOB1' }) }); });
    let polls = 0;
    await page.route('**/validation-status**', (route) => {
      polls++;
      const body = polls < 2 ? { status:'in_progress', jobLogs:[{ name:'setup', status:'in_progress' }] } : {
        status:'completed', conclusion:'success', jobLogs:[
          { name:'setup', conclusion:'success', logsUrl:'https://example.com/setup' },
          { name:'lint', conclusion:'success' }
        ], results:{ details:[] }
      };
      route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(body) });
    });
    await page.goto('/');
  // Use workflow validation API (ensures mode=workflow and jobLogs enabled by default)
  await page.evaluate(() => { const c=document.createElement('div'); c.id='val-job'; document.body.appendChild(c); const api=(window as any).GitHubWorkflowValidation.init('val-job','https://github.com/owner/repo'); api.start(); });
    await page.waitForSelector('#val-job .td-val-joblogs ul li');
    const items = await page.locator('#val-job .td-val-joblogs li').allInnerTexts();
    expect(items.length).toBeGreaterThan(0);
    expect(items.join(' ')).toMatch(/setup/);
  });
});
