import { describe, it, expect } from 'vitest';
import { repoForkHandler } from '../src/functions/repo-fork.js';
import { HttpRequest } from '@azure/functions';

function makeRequest(body: any): HttpRequest {
  return { method: 'POST', json: async () => body } as unknown as HttpRequest;
}
const ctx: any = { log: () => {} };

describe('repo-fork function', () => {
  it('errors without token', async () => {
    const original = process.env.GH_WORKFLOW_TOKEN; delete process.env.GH_WORKFLOW_TOKEN;
    const res = await repoForkHandler(makeRequest({}), ctx);
    expect(res.status).toBe(500);
    if (original) process.env.GH_WORKFLOW_TOKEN = original;
  });

  it('validates required fields', async () => {
    process.env.GH_WORKFLOW_TOKEN = 't';
    const res = await repoForkHandler(makeRequest({ sourceOwner: 'o' }), ctx);
    expect(res.status).toBe(400);
  });
});
