import request from 'supertest';
import { createApp } from '../src/app.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Octokit for deterministic behavior
vi.mock('@octokit/rest', () => {
  const git = {
    getRef: vi.fn().mockResolvedValue({ data: { object: { sha: 'base-sha' } } }),
    createRef: vi.fn().mockResolvedValue({}),
    deleteRef: vi.fn().mockResolvedValue({})
  };
  const repos = {
    createOrUpdateFileContents: vi.fn().mockResolvedValue({})
  };
  const pulls = {
    create: vi.fn().mockResolvedValue({ data: { number: 42, html_url: 'https://github.com/o/r/pull/42' } })
  };
  const ctor = vi.fn().mockImplementation(() => ({ git, repos, pulls }));
  return { Octokit: ctor };
});

describe('POST /v4/add-template-pr', () => {
  const app = createApp();
  beforeEach(() => { process.env.GH_WORKFLOW_TOKEN = 'tok'; });

  it('400 on missing fields', async () => {
    const r = await request(app).post('/v4/add-template-pr').send({});
    expect(r.status).toBe(400);
  });

  it('creates PR successfully', async () => {
    const r = await request(app).post('/v4/add-template-pr').send({
      repoUrl: 'https://github.com/example/template-repo',
      analysis: { score: 10 },
      repoCategory: 'infra'
    });
    expect(r.status).toBe(201);
    expect(r.body.prNumber).toBe(42);
    expect(r.body.prUrl).toContain('/pull/42');
  });

  it('handles PR creation failure', async () => {
    const { Octokit }: any = await import('@octokit/rest');
    // Force failure for pulls.create on next instantiation
    Octokit.mockImplementationOnce(() => ({
      git: {
        getRef: vi.fn().mockResolvedValue({ data: { object: { sha: 'base' } } }),
        createRef: vi.fn().mockResolvedValue({}),
        deleteRef: vi.fn().mockResolvedValue({})
      },
      repos: { createOrUpdateFileContents: vi.fn().mockResolvedValue({}) },
      pulls: { create: vi.fn().mockRejectedValue(new Error('pr boom')) }
    }));
    const r = await request(app).post('/v4/add-template-pr').send({ repoUrl: 'https://github.com/foo/bar', analysis: { ok: true } });
    expect(r.status).toBe(500);
    expect(r.body.error).toMatch(/pull request/i);
  });
});
