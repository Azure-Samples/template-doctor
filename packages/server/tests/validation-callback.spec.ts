import request from 'supertest';
import { createApp } from '../src/app.js';

describe('POST /v4/validation-callback', () => {
  const app = createApp();
  it('sets cookie and echoes mapping', async () => {
    const res = await request(app)
      .post('/v4/validation-callback')
      .send({ runId: 'r123', githubRunId: 'g456' });
    expect(res.status).toBe(200);
    expect(res.body.runId).toBe('r123');
    const setCookie = res.headers['set-cookie'];
    expect(Array.isArray(setCookie) ? setCookie.join(';') : setCookie).toContain('td_runId=');
  });
  it('400 if missing fields', async () => {
    const res = await request(app).post('/v4/validation-callback').send({ runId: 'onlyOne' });
    expect(res.status).toBe(400);
  });
});
