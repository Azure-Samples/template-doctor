import { describe, it, expect } from 'vitest';
import { repoForkHandler } from '../src/functions/repo-fork.js';
import { Octokit } from '@octokit/rest';
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

  it('returns samlRequired on 403 SAML doc url', async () => {
    process.env.GH_WORKFLOW_TOKEN = 't';
    // @ts-ignore mock Octokit createFork to throw
    Octokit.prototype.repos = {
      createFork: async () => { const err: any = new Error('Requires SAML'); err.status = 403; err.response = { data: { documentation_url: 'https://api.github.com/saml-single-sign-on/authorize' } }; throw err; },
      get: async () => { throw Object.assign(new Error('not found'), { status:404 }); }
    };
    // @ts-ignore
    Octokit.prototype.users = { getAuthenticated: async () => ({ data: { login: 'me' } }) };
    const res = await repoForkHandler(makeRequest({ sourceOwner:'o', sourceRepo:'r' }), ctx);
    expect(res.status).toBe(403);
    expect((res.jsonBody as any).samlRequired).toBe(true);
  });
});
