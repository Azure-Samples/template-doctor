// Guard meta-spec: ensures the dialog-prevention fixture is active.
// This file now simply asserts the guard fixture works. Real guarding happens in fixtures/guardFixture.ts.
// Keeping this allows: `--grep setup.guard` to return a test instead of "No tests found".
import { test, expect } from './fixtures/guardFixture';

test.describe('setup.guard', () => {
  test('guard fixture active (meta)', async ({ page }) => {
    // Navigate so init scripts apply on actual app document.
    await page.goto('/');
    const error = await page.evaluate(() => {
      try {
        // eslint-disable-next-line no-alert
        alert('SHOULD_FAIL');
        return 'no error';
      } catch (e) {
        return e && e.message ? e.message : String(e);
      }
    });
    expect(error).toContain('Native alert called');
  });
});
