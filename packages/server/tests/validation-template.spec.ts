import request from 'supertest';
import { createApp } from '../src/app.js';
import { makeOk } from './utils/mockFetch';

describe('POST /v4/validation-template', () => {
  const app = createApp();
  beforeEach(() => {
    process.env.GH_WORKFLOW_TOKEN = 'workflow-token';
  });
  it('returns runId when dispatch succeeds', async () => {
  const fetchSpy = vi.spyOn(global, 'fetch' as any).mockResolvedValue(makeOk(204));
    const res = await request(app)
      .post('/v4/validation-template')
      .send({ targetRepoUrl: 'https://github.com/foo/bar' });
    expect(res.status).toBe(200);
    expect(typeof res.body.runId).toBe('string');
    expect(res.body.runId).toHaveLength(36);
    fetchSpy.mockRestore();
  });
  it('400 when targetRepoUrl missing', async () => {
    const res = await request(app).post('/v4/validation-template').send({});
    expect(res.status).toBe(400);
  });
});
