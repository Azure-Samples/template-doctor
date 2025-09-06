import { describe, it, expect } from 'vitest';
import { issueCreateHandler } from '../src/functions/issue-create.js';
import { HttpRequest } from '@azure/functions';

function makeRequest(body: any): HttpRequest {
  return {
    method: 'POST',
    json: async () => body
  } as unknown as HttpRequest;
}

const contextMock: any = { log: () => {} };

describe('issue-create function', () => {
  it('rejects missing token', async () => {
    const original = process.env.GH_WORKFLOW_TOKEN;
    delete process.env.GH_WORKFLOW_TOKEN;
    const res = await issueCreateHandler(makeRequest({}), contextMock);
    expect(res.status).toBe(500);
    process.env.GH_WORKFLOW_TOKEN = original;
  });

  it('validates required fields', async () => {
    process.env.GH_WORKFLOW_TOKEN = 'testtoken';
    const res = await issueCreateHandler(makeRequest({ owner: 'o' }), contextMock);
    expect(res.status).toBe(400);
  });
});
