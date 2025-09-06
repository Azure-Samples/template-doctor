import { describe, it, expect } from 'vitest';
import { issueCreateHandler } from '../src/functions/issue-create.js';
import { Octokit } from '@octokit/rest';
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

  it('creates main issue with child issues (mocked octokit)', async () => {
    process.env.GH_WORKFLOW_TOKEN = 'tok';
    // Mock Octokit methods used
    // @ts-ignore
    Octokit.prototype.issues = {
      getLabel: async () => ({}),
      createLabel: async () => ({}),
      create: async ({ title }: any) => ({ data: { number: Math.floor(Math.random()*1000), html_url: 'https://example/'+title } })
    };
    // @ts-ignore
    Octokit.prototype.users = { getAuthenticated: async () => ({ data: { login: 'bot' } }) };
    const res = await issueCreateHandler(makeRequest({ owner:'o', repo:'r', title:'Main', body:'Body', labels:['a'], childIssues:[{ title:'Child 1', body:'B1', labels:['c1'] }, { title:'Child 2', body:'B2', labels:['c2'] }] }), contextMock);
    expect(res.status).toBe(201);
    const json: any = res.jsonBody;
    expect(json.childResults.length).toBe(2);
  });
});
