import request from 'supertest';
import { createApp } from '../src/app.js';
import { describe, it, expect } from 'vitest';

describe('Batch Scan Routes', () => {
  const app = createApp();

  it('rejects invalid body', async () => {
    const r = await request(app).post('/v4/batch-scan-start').send({});
    expect(r.status).toBe(400);
  });

  it('starts batch and progresses to done', async () => {
    const r = await request(app).post('/v4/batch-scan-start').send({ repos: ['Org/A', 'Org/B', 'Org/A'] });
    expect(r.status).toBe(202);
    const { batchId } = r.body;
    expect(batchId).toBeTruthy();
    // Poll until completed
    let completed = 0; let attempts = 0;
    while (attempts < 25) { // ~5s max
      const s = await request(app).get('/v4/batch-scan-status').query({ batchId });
      expect(s.status).toBe(200);
      completed = s.body.completed;
      if (completed === s.body.total) break;
      await new Promise(r => setTimeout(r, 200));
      attempts++;
    }
    expect(completed).toBe(2); // unique repos 2
  });

  it('returns 404 for unknown batch', async () => {
    const s = await request(app).get('/v4/batch-scan-status').query({ batchId: 'missing' });
    expect(s.status).toBe(404);
  });
});
