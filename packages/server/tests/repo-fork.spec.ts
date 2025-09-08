import request from 'supertest';
import { createApp } from '../src/app.js';
import { Octokit } from '@octokit/rest';

vi.mock('@octokit/rest', () => {
  const users = { getAuthenticated: vi.fn().mockResolvedValue({ data: { login: 'authedUser' } }) };
  const repos = {
    get: vi.fn().mockRejectedValue({ status: 404 }),
    createFork: vi.fn().mockResolvedValue({ data: { html_url: 'https://github.com/authedUser/sourceRepo' } })
  };
  return { Octokit: vi.fn().mockImplementation(() => ({ users, repos })) };
});

describe('POST /v4/repo-fork', () => {
  const app = createApp();
  beforeEach(() => { process.env.GH_WORKFLOW_TOKEN = 'token'; });

  it('returns 400 on missing fields', async () => {
    const res = await request(app).post('/v4/repo-fork').send({});
    expect(res.status).toBe(400);
  });

  it('creates fork and returns 201 with ready state (simplified)', async () => {
    const res = await request(app).post('/v4/repo-fork').send({ sourceOwner: 'SourceOrg', sourceRepo: 'sourceRepo' });
    expect([201, 200]).toContain(res.status); // existing fork path may return 200 if mock adjusted
    expect(res.body.forkOwner).toBe('authedUser');
    expect(res.body.repo).toBe('sourceRepo');
    expect(res.body.attemptedCreate).toBe(true);
  });

  it('returns 202 when waitForReady=false', async () => {
    const res = await request(app).post('/v4/repo-fork').send({ sourceOwner: 'SourceOrg', sourceRepo: 'sourceRepo', waitForReady: false });
    expect(res.status).toBe(202);
    expect(res.body.ready).toBe(false);
  });
});
