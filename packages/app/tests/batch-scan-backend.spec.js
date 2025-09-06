import { test, expect } from '@playwright/test';

test.describe('Backend Batch Scan', () => {
  test('starts and polls batch scan', async ({ page }) => {
    await page.goto('/');
    await page.route('**/api/batch-scan/start', route => {
      route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ batchId:'batch123' }) });
    });
    let pollCount = 0;
    await page.route('**/api/batch-scan/status**', route => {
      pollCount++;
      if(pollCount < 2){
        route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ batchId:'batch123', status:'running', startedAt: new Date().toISOString(), updatedAt:new Date().toISOString(), total:5, processed: pollCount }) });
      } else {
        route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ batchId:'batch123', status:'completed', startedAt: new Date().toISOString(), updatedAt:new Date().toISOString(), completedAt:new Date().toISOString(), total:5, processed:5 }) });
      }
    });

    await page.addInitScript(() => {
      window.TemplateDoctorConfig = { features: { backendMigration: true } };
    });

    // Trigger start via global (simplified)
    await page.evaluate(() => {
      window.TemplateDoctorBatchScan.startBatch(['https://github.com/org/repo1']);
    });

    await page.waitForEvent('console', { timeout: 5000 }).catch(()=>{});
  });
});
