import request from 'supertest';
import { createApp } from '../src/app.js';

describe('GET /v4/ping', () => {
  const app = createApp();
  it('returns ok response with timestamp', async () => {
    const res = await request(app).get('/v4/ping');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toBe('template-doctor');
    expect(typeof res.body.ts).toBe('number');
  });
});
