import request from 'supertest';
import { createApp } from '../src/app.js';
import { makeOk } from './utils/mockFetch';

describe('POST /v4/submit-analysis-dispatch', () => {
  const app = createApp();
  beforeEach(() => {
    process.env.GH_WORKFLOW_TOKEN = 'test-token';
  });
  it('dispatches to default repo when none provided', async () => {
  const fetchSpy = vi.spyOn(global, 'fetch' as any).mockResolvedValue(makeOk(204));
    const res = await request(app)
      .post('/v4/submit-analysis-dispatch')
      .send({ event_type: 'analyze', client_payload: { foo: 'bar' } });
    expect(res.status).toBe(204);
    expect(res.headers['x-template-doctor-repo-slug']).toBe('Template-Doctor/template-doctor');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });
  it('uses targetRepo from client_payload precedence', async () => {
  const fetchSpy = vi.spyOn(global, 'fetch' as any).mockResolvedValue(makeOk(204));
    const res = await request(app)
      .post('/v4/submit-analysis-dispatch')
      .send({ event_type: 'analyze', client_payload: { targetRepo: 'Owner/RepoX' } });
    expect(res.status).toBe(204);
    expect(res.headers['x-template-doctor-repo-slug']).toBe('Owner/RepoX');
    fetchSpy.mockRestore();
  });
});
