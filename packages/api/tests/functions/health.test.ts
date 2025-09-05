import { describe, it, expect } from 'vitest';

// This minimal test ensures the functions registration file can be imported without throwing.
// It guards against accidental late/double registration regressions.

describe('health', () => {
  it('imports dist/src/index without errors', async () => {
    const mod = await import('../../dist/src/index.js');
    expect(mod).toBeDefined();
  });
});
