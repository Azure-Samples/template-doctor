import { vi, beforeEach, afterEach } from 'vitest';
import type { HttpRequest } from '@azure/functions';

/**
 * Creates a mock context for testing Azure Functions
 */
export function createMockContext() {
  return {
    invocationId: 'test-invocation-id',
    functionName: 'test-function',
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    extraInputs: {
      get: vi.fn(),
      set: vi.fn()
    },
    extraOutputs: {
      get: vi.fn(),
      set: vi.fn()
    },
    options: {
      trigger: { 
        type: 'httpTrigger',
        name: 'req'
      },
      extraInputs: [],
      extraOutputs: []
    }
  };
}

/**
 * Creates a mock HttpRequest for testing Azure Functions
 */
export function createMockRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  params?: Record<string, string>;
  body?: any;
}): HttpRequest {
  const {
    method = 'GET',
    url = 'https://example.com/api/test',
    headers = {},
    query = {},
    params = {},
    body = undefined,
  } = options;

  // Convert query record to URLSearchParams for easier mocking
  const queryParams = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    queryParams.append(key, value);
  });

  // Create mock request
  const request = {
    method,
    url,
    headers: new Headers(headers),
    params,
    query: {
      get: (key: string) => queryParams.get(key),
      getAll: (key: string) => queryParams.getAll(key),
      has: (key: string) => queryParams.has(key),
      forEach: vi.fn(),
    },
    body,
    json: vi.fn().mockImplementation(async () => {
      if (typeof body === 'string') {
        return JSON.parse(body);
      }
      return body;
    }),
    text: vi.fn().mockImplementation(async () => {
      if (typeof body === 'string') {
        return body;
      }
      return JSON.stringify(body);
    }),
    formData: vi.fn().mockRejectedValue(new Error('Not implemented')),
    arrayBuffer: vi.fn().mockRejectedValue(new Error('Not implemented')),
    blob: vi.fn().mockRejectedValue(new Error('Not implemented')),
  } as unknown as HttpRequest;

  return request;
}

/**
 * Setup and teardown for mocking environment variables
 */
export function withEnvVars(envVars: Record<string, string | undefined>, fn: () => void) {
  const originalEnv = { ...process.env };
  
  beforeEach(() => {
    // Set environment variables
    Object.entries(envVars).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  });

  afterEach(() => {
    // Restore original environment
    Object.keys(envVars).forEach((key) => {
      if (key in originalEnv) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    });
  });

  fn();
}