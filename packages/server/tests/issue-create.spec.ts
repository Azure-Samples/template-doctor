import request from 'supertest';
import { createApp } from '../src/app.js';

// Module-level mock of Octokit so route code gets mocked instance immediately.
vi.mock('@octokit/rest', () => {
  const issuesBase: any = {
    getLabel: vi.fn().mockResolvedValue({}),
    createLabel: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockImplementation(({ title }: any) => ({ data: { number: 123, html_url: 'https://example/'+title } })),
    addAssignees: vi.fn().mockResolvedValue({})
  };
  const ctor = vi.fn().mockImplementation(() => ({ issues: issuesBase }));
  return { Octokit: ctor };
});
import { Octokit } from '@octokit/rest';

describe('POST /v4/issue-create', () => {
  const app = createApp();
  beforeEach(() => { process.env.GH_WORKFLOW_TOKEN = 'tok'; });

  it('400 on missing required fields', async () => {
    const res = await request(app).post('/v4/issue-create').send({ owner: 'o' });
    expect(res.status).toBe(400);
  });

  it('creates main issue and child issues', async () => {
    const inst: any = (Octokit as any).mock.results[0]?.value || {}; // first constructed instance
    const res = await request(app).post('/v4/issue-create').send({
      owner: 'o', repo: 'r', title: 'Main', body: 'Body', labels: ['L1'], assignCopilot: true,
      childIssues: [ { title: 'Child 1', body: 'B1', labels: ['c1'] }, { title: 'Child 2', body: 'B2', labels: ['c2'] } ]
    });
    expect(res.status).toBe(201);
    expect(res.body.issueNumber).toBeTruthy();
    expect(res.body.childResults.length).toBe(2);
  });

  it('handles main issue creation failure', async () => {
    // Override mock for this test
    (Octokit as any).mockImplementationOnce(() => ({
      issues: {
        getLabel: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockRejectedValue(new Error('boom'))
      }
    }));
    const res = await request(app).post('/v4/issue-create').send({ owner: 'o', repo: 'r', title: 'Failing' });
    expect(res.status).toBe(502);
  });
});
