import request from 'supertest';
import { createApp } from '../src/app.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// We'll mock fetch globally via vi.spyOn(globalThis, 'fetch') in each test for clarity.

describe('POST /v4/archive-collection', () => {
  const app = createApp();
  beforeEach(() => { process.env.GH_WORKFLOW_TOKEN = 'tok'; (globalThis.fetch as any) && vi.restoreAllMocks(); });

  const goodBody = {
    collection: 'MyCollection',
    repoUrl: 'https://github.com/Org/Repo',
    repoName: 'Repo',
    analysisId: 'analysis123',
    username: 'dev1',
    timestamp: '2025-09-08T12:00:00Z',
    metadata: { score: 90 }
  };

  it('400 on missing fields', async () => {
    const res = await request(app).post('/v4/archive-collection').send({});
    expect(res.status).toBe(400);
  });

  it('archives and creates PR (200)', async () => {
    // Sequence: get ref, create ref, put file, create PR
    const mockSequence = [
      { ok: true, json: async () => ({ object: { sha: 'base-sha' } }) },
      { ok: true, json: async () => ({}) },
      { ok: true, json: async () => ({}) },
      { ok: true, json: async () => ({ html_url: 'https://github.com/Archive/PR/1' }) }
    ];
    let idx = 0;
    vi.spyOn(globalThis as any, 'fetch').mockImplementation(() => Promise.resolve(mockSequence[idx++]));
    const res = await request(app).post('/v4/archive-collection').send(goodBody);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.prUrl).toContain('github.com');
  });

  it('fails when PR creation fails', async () => {
    const mockSequence = [
      { ok: true, json: async () => ({ object: { sha: 'base-sha' } }) },
      { ok: true, json: async () => ({}) },
      { ok: true, json: async () => ({}) },
  { ok: false, status: 500, text: async () => 'boom' }
    ];
    let idx = 0;
    vi.spyOn(globalThis as any, 'fetch').mockImplementation(() => Promise.resolve(mockSequence[idx++]));
    const res = await request(app).post('/v4/archive-collection').send(goodBody);
  expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/PR/i);
  });
});
