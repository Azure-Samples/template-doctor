import request from 'supertest';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp } from '../src/server.js';

// Mock Octokit & analyzer-core dynamic import
vi.mock('@octokit/rest', () => {
  const repos = {
    get: vi.fn().mockResolvedValue({ data: { default_branch: 'main' } }),
    getContent: vi.fn()
  };
  const ctor = vi.fn().mockImplementation(() => ({ repos }));
  return { Octokit: ctor };
});

// Provide a stable dynamic import for analyzer-core runAnalyzer
vi.mock('../../analyzer-core/dist/run-analyzer.js', () => ({
  runAnalyzer: vi.fn().mockImplementation(async (_repoUrl: string, files: any[], opts: any) => ({
    issues: files.some(f => f.path.toLowerCase() === 'readme.md') ? [] : [{ id: 'missing-readme', severity: 'error' }],
    compliant: [],
    meta: { ruleSet: opts.ruleSet }
  }))
}));

import { Octokit } from '@octokit/rest';
import { runAnalyzer } from '../../analyzer-core/dist/run-analyzer.js';

const app = createApp();

function ensureInstance(): any {
  if ((Octokit as any).mock.results.length === 0) {
    // Trigger route which constructs Octokit by making a trivial call with missing repoUrl to get 400
    // (side effect: route instantiates Octokit)
  }
  return (Octokit as any).mock.results[0].value;
}

async function primeInstance() {
  if ((Octokit as any).mock.results.length === 0) {
    await request(app).post('/v4/analyze-template').send({ repoUrl: 'https://github.com/org/dummy' });
  }
}

async function mockTree(paths: string[]) {
  await primeInstance();
  const inst = ensureInstance();
  const repos: any = inst.repos;
  repos.getContent.mockReset();
  repos.getContent.mockImplementation(async ({ path }: any) => {
    if (!path) {
      return { data: paths.filter(p => !p.includes('/')).map(p => ({ type: 'file', path: p, sha: p + '-sha' })) } as any;
    }
    return { data: [] } as any;
  });
}

describe('POST /v4/analyze-template', () => {
  beforeEach(() => { process.env.GITHUB_TOKEN_ANALYZER = 'analyzer-token'; });

  it('400 when repoUrl missing', async () => {
    const res = await request(app).post('/v4/analyze-template').send({});
    expect(res.status).toBe(400);
  });

  it('analyzes repository and returns 200', async () => {
    await mockTree(['README.md', 'LICENSE']);
    const res = await request(app).post('/v4/analyze-template').send({ repoUrl: 'https://github.com/org/repo' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('issues');
    expect(runAnalyzer).toHaveBeenCalled();
  });

  it('propagates analyzer failure as 500', async () => {
    // Force runAnalyzer throw
    await mockTree(['README.md']);
    // Replace implementation for next call
    (runAnalyzer as any).mockImplementationOnce(async () => { throw new Error('boom'); });
    const res = await request(app).post('/v4/analyze-template').send({ repoUrl: 'https://github.com/org/repo' });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/boom/);
  });

  it('sets archiveRequested when override true', async () => {
    await mockTree(['README.md']);
    const res = await request(app).post('/v4/analyze-template?categories=doc,ci').send({ repoUrl: 'https://github.com/org/repo', archiveOverride: true });
    expect(res.status).toBe(200);
    expect(res.body.archiveRequested).toBe(true);
  });
});
