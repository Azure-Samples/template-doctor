import { test, expect } from '@playwright/test';

// Extended edge-case tests: failure, cancel, timeout, accessibility.

const FAST = { polling: { intervalMs: 150, maxAttempts: 8 } };

async function injectOverrides(page: import('@playwright/test').Page) {
  await page.addInitScript((o: any) => { (window as any).__ValidationTestOverrides = o; }, FAST);
}

test.describe('Unified Validation Extended', () => {
  test('failure path renders counts and collapsible sections', async ({ page }) => {
    await injectOverrides(page);
    await page.route('**/validation-template**', (route) => {
      route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ runId:'FAIL1' }) });
    });
    let polls = 0;
    await page.route('**/validation-status**', (route) => {
      polls++;
      const base = { status: polls < 2 ? 'in_progress' : 'completed', conclusion: polls < 2 ? undefined : 'failure', results: { details: [
        { status:'fail', category:'Readme', message:'Missing required section', issues:['No Usage section'] },
        { status:'warn', category:'Token', message:'Workflow scope not present' },
        { status:'pass', category:'License', message:'License file present' }
      ] } };
      route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(base) });
    });
    await page.goto('/');
    await page.evaluate(() => { const c=document.createElement('div'); c.id='val-fail'; document.body.appendChild(c); (window as any).TemplateValidation.init('val-fail','owner/repo', { mode:'workflow' }).start(); });
    await page.waitForSelector('#val-fail .td-val-summary.failure');
    const summaryText = await page.locator('#val-fail .td-val-summary').innerText();
    expect(summaryText).toMatch(/fail/i);
    expect(summaryText).toMatch(/Checks:.*pass/i);
    // Collapsible details exist
    await expect(page.locator('#val-fail details')).toHaveCount(3);
  });

  test('cancel path ends in cancelled state', async ({ page }) => {
    await injectOverrides(page);
    await page.route('**/validation-template**', (route) => { route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ runId:'CANCEL1' }) }); });
    let polls = 0;
    await page.route('**/validation-cancel**', (route) => { route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ ok:true }) }); });
    await page.route('**/validation-status**', async (route) => {
      polls++;
      if (polls === 1) {
        route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ status:'in_progress' }) });
      } else {
        route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ status:'completed', conclusion:'cancelled' }) });
      }
    });
    await page.goto('/');
    await page.evaluate(() => { const c=document.createElement('div'); c.id='val-cancel'; document.body.appendChild(c); const api=(window as any).TemplateValidation.init('val-cancel','owner/repo', { mode:'workflow' }); (window as any).__cancelApi=api; api.start(); });
    // trigger cancel after first poll
    await page.waitForTimeout(400); // allow trigger + first poll
    await page.evaluate(() => { (window as any).__cancelApi.cancel(); });
    await page.waitForSelector('#val-cancel .td-val-summary.timeout, #val-cancel .td-val-summary');
    const txt = await page.locator('#val-cancel .td-val-summary').innerText();
    expect(txt.toLowerCase()).toMatch(/cancel/);
  });

  test('timeout path shows continue button', async ({ page }) => {
    await page.addInitScript(() => { (window as any).__ValidationTestOverrides = { polling:{ intervalMs:120, maxAttempts:2 } }; });
    await page.route('**/validation-template**', (route) => { route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ runId:'TIMEOUT1' }) }); });
    await page.route('**/validation-status**', (route) => { route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ status:'in_progress' }) }); });
    await page.goto('/');
    await page.evaluate(() => { const c=document.createElement('div'); c.id='val-timeout'; document.body.appendChild(c); (window as any).TemplateValidation.init('val-timeout','owner/repo', { mode:'workflow' }).start(); });
    await page.waitForSelector('#val-timeout .td-val-summary.timeout');
    await expect(page.locator('#val-timeout .td-val-summary button')).toHaveText(/continue/i);
  });

  test('accessibility summary region present', async ({ page }) => {
    await injectOverrides(page);
    await page.route('**/validation-template**', (route) => { route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ runId:'ACC1' }) }); });
    await page.route('**/validation-status**', (route) => { route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ status:'completed', conclusion:'success', results:{ details:[] } }) }); });
    await page.goto('/');
    await page.evaluate(() => { const c=document.createElement('div'); c.id='val-acc'; document.body.appendChild(c); (window as any).TemplateValidation.init('val-acc','owner/repo').start(); });
    await page.waitForSelector('#val-acc .td-val-summary.success');
    const role = await page.locator('#val-acc .td-val-summary').getAttribute('role');
    expect(role).toBe('region');
    const aria = await page.locator('#val-acc .td-val-summary').getAttribute('aria-live');
    expect(aria).toBe('polite');
  });
});
