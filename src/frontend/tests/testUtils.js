// @ts-nocheck
import { expect } from '@playwright/test';

/**
 * Enables Batch mode in the UI without relying on clicking the visually-hidden checkbox.
 * It programmatically checks the toggle and dispatches the change event, then waits
 * for the batch container to become active.
 */
export async function enableBatchMode(page) {
  await page.evaluate(() => {
    const toggle = document.getElementById('scan-mode-toggle');
    if (toggle) {
      toggle.checked = true;
      toggle.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await expect(page.locator('#batch-urls-container')).toHaveClass(/active/);
}
