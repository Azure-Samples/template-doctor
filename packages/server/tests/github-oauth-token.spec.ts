import request from 'supertest';
import { createApp } from '../src/app.js';
import { makeOk } from './utils/mockFetch.js';

describe('POST /v4/github-oauth-token', () => {
  const app = createApp();
  const tokenResponse = { access_token: 'gho_example' };

  beforeEach(() => {
    process.env.GITHUB_CLIENT_ID = 'cid';
    process.env.GITHUB_CLIENT_SECRET = 'secret';
  });

  it('exchanges code for token', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch' as any).mockResolvedValue({
      ...makeOk(200, tokenResponse),
      json: async () => tokenResponse
    });
    const res = await request(app).post('/v4/github-oauth-token').send({ code: 'abc123' });
    expect(res.status).toBe(200);
    expect(res.body.access_token).toBe('gho_example');
    fetchSpy.mockRestore();
  });

  it('400 when code missing', async () => {
    const res = await request(app).post('/v4/github-oauth-token').send({});
    expect(res.status).toBe(400);
  });

  it('500 when client credentials missing', async () => {
    delete process.env.GITHUB_CLIENT_ID;
    const res = await request(app).post('/v4/github-oauth-token').send({ code: 'zzz' });
    expect(res.status).toBe(500);
  });

  it('400 on GitHub error response', async () => {
    process.env.GITHUB_CLIENT_ID = 'cid';
    process.env.GITHUB_CLIENT_SECRET = 'secret';
    const fetchSpy = vi.spyOn(global, 'fetch' as any).mockResolvedValue({
      ...makeOk(200, { error: 'bad_verification_code', error_description: 'Bad code' }),
      json: async () => ({ error: 'bad_verification_code', error_description: 'Bad code' })
    });
    const res = await request(app).post('/v4/github-oauth-token').send({ code: 'bad' });
    expect(res.status).toBe(400);
    fetchSpy.mockRestore();
  });
});
