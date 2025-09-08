import request from 'supertest';
import { createApp } from '../src/app.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Octokit for workflow runs
vi.mock('@octokit/rest', () => {
  const actions = {
    listWorkflowRuns: vi.fn().mockImplementation(() => ({ data: { workflow_runs: [ { id: 111, display_title: 'validate run run-abc', head_commit: { message: 'commit run-abc' }, status: 'in_progress', conclusion: null, html_url: 'https://gh/run/111', run_started_at: 't1', updated_at: 't1' } ] } })),
    listWorkflowRunsForRepo: vi.fn().mockImplementation(() => ({ data: { workflow_runs: [] } })),
    getWorkflowRun: vi.fn().mockImplementation(() => ({ data: { id: 111, status: 'completed', conclusion: 'success', html_url: 'https://gh/run/111', run_started_at: 't1', updated_at: 't2' } })),
    cancelWorkflowRun: vi.fn().mockResolvedValue({})
  };
  const ctor = vi.fn().mockImplementation(() => ({ actions }));
  return { Octokit: ctor };
});

describe('Validation lifecycle routes', () => {
  const app = createApp();
  beforeEach(() => { process.env.GH_WORKFLOW_TOKEN = 'tok'; });

  it('validation-status pending when no correlation (different runId)', async () => {
    // For this test override listWorkflowRuns to empty
    const { Octokit }: any = await import('@octokit/rest');
    Octokit.mockImplementationOnce(() => ({ actions: { listWorkflowRuns: vi.fn().mockResolvedValue({ data: { workflow_runs: [] } }), listWorkflowRunsForRepo: vi.fn().mockResolvedValue({ data: { workflow_runs: [] } }) } }));
    const r = await request(app).get('/v4/validation-status').query({ runId: 'run-miss' });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('pending');
  });

  it('validation-status correlates and returns run data', async () => {
    const r = await request(app).get('/v4/validation-status').query({ runId: 'run-abc' });
    expect(r.status).toBe(200);
    expect(r.body.githubRunId).toBe('111');
    expect(r.body.status).toBe('completed');
    expect(r.body.conclusion).toBe('success');
  });

  it('validation-cancel cancels run by correlation', async () => {
    const r = await request(app).post('/v4/validation-cancel').send({ runId: 'run-abc' });
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
  });
});
