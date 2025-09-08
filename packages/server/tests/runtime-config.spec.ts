import request from 'supertest';
import { createApp } from '../src/app.js';

describe('GET /v4/client-settings', () => {
  const app = createApp();
  beforeAll(() => {
    process.env.GITHUB_CLIENT_ID = 'abc123';
    process.env.DEFAULT_RULE_SET = 'default-rules';
  });
  it('returns runtime configuration with api version', async () => {
    const res = await request(app).get('/v4/client-settings');
    expect(res.status).toBe(200);
    expect(res.body.backend.apiVersion).toBe('v4');
    expect(res.body.GITHUB_CLIENT_ID).toBe('abc123');
  });
});
