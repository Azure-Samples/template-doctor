/**
 * This file defines setup for Vitest tests
 */
import { vi, beforeAll } from 'vitest';

// Mock fetch
beforeAll(() => {
  global.fetch = vi.fn();
});