// Simple helpers to mock global fetch without relying on the Response constructor,
// which was throwing in the current test environment for 204 status codes.
export interface MockFetchResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  text: () => Promise<string>;
  json?: () => Promise<any>;
}

export function makeOk(status: number = 200, body: any = ''): MockFetchResponse {
  return {
    ok: true,
    status,
    statusText: 'OK',
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    json: async () => body
  };
}

export function makeError(status: number = 500, body: any = 'error', statusText = 'Internal Server Error'): MockFetchResponse {
  return {
    ok: false,
    status,
    statusText,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    json: async () => body
  };
}
