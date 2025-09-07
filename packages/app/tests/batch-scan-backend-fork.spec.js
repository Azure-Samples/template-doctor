import { test, expect } from '@playwright/test';
import { enableBackendMigration, reaffirmBackendMigration, ensureApiClientReady } from './utils/feature-flags.js';

// Simulates starting a batch scan and receiving status updates using backend v4 endpoints.
// Focus: ensure frontend uses /v4/batch-scan-* (ApiClient path) rather than legacy /api/batch-scan/* when feature enabled.

test.describe('Batch Scan Backend Integration', () => {
  test('starts and polls batch via backend endpoints', async ({ page }) => {
    await enableBackendMigration(page);

    // Mock start endpoint
    await page.route('**/v4/batch-scan-start', route => {
      route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ batchId:'batch-123', acceptedCount:2 }) });
    });
    await page.route('**/api/v4/batch-scan-start', route => {
      route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ batchId:'batch-123', acceptedCount:2 }) });
    });

    // Sequence of status responses: in-progress then completed
    let pollCount = 0;
    const statusHandler = route => {
      pollCount++;
      const base = { batchId:'batch-123', total:2, processed: pollCount === 1 ? 1 : 2 };
      const body = pollCount === 1 ? { ...base, status:'running' } : { ...base, status:'completed' };
      route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(body) });
    };
    await page.route('**/v4/batch-scan-status**', statusHandler);
    await page.route('**/api/v4/batch-scan-status**', statusHandler);

  await page.goto('/');
  await ensureApiClientReady(page);
  await reaffirmBackendMigration(page);

    // Inject a minimal call using ApiClient directly
    const startRes = await page.evaluate(async () => {
      return await window.TemplateDoctorApiClient.startBatchScan(['owner1/repo1','owner2/repo2']);
    });
    expect(startRes.batchId).toBe('batch-123');

    // Poll manually using ApiClient
    const status1 = await page.evaluate(async () => {
      return await window.TemplateDoctorApiClient.getBatchStatus('batch-123');
    });
    expect(status1.status).toBe('running');

    const status2 = await page.evaluate(async () => {
      return await window.TemplateDoctorApiClient.getBatchStatus('batch-123');
    });
    expect(status2.status).toBe('completed');
    expect(pollCount).toBeGreaterThanOrEqual(2);
  });
});
