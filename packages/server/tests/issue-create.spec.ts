import request from 'supertest';
import { createApp } from '../src/app.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

interface IssueCreateCall { owner: string; repo: string; title: string; body?: string; labels?: string[] }
interface IssuesAPI {
  getLabel: ReturnType<typeof vi.fn>;
  createLabel: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  addAssignees: ReturnType<typeof vi.fn>;
}

// Mutable factory swapped per test for custom behaviour
let currentIssuesImpl: () => IssuesAPI;

vi.mock('@octokit/rest', () => {
  const Octokit = vi.fn().mockImplementation(() => ({ issues: currentIssuesImpl() }));
  return { Octokit };
});
import { Octokit } from '@octokit/rest'; // import after mock

const app = createApp();

describe('POST /v4/issue-create', () => {
  beforeEach(() => {
    process.env.GH_WORKFLOW_TOKEN = 'tok';
    vi.clearAllMocks();
    currentIssuesImpl = () => {
      let issueCounter = 120;
      const issues: IssuesAPI = {
        getLabel: vi.fn().mockResolvedValue({}),
        createLabel: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockImplementation(({ title }: IssueCreateCall) => ({ data: { number: ++issueCounter, html_url: 'https://example/' + title } })),
        addAssignees: vi.fn().mockResolvedValue({})
      };
      return issues;
    };
  });

  it('400 on missing required fields', async () => {
    const res = await request(app).post('/v4/issue-create').send({ owner: 'o' });
    expect(res.status).toBe(400);
  });

  it('creates main issue and child issues with ensured labels', async () => {
    const res = await request(app).post('/v4/issue-create').send({
      owner: 'o', repo: 'r', title: 'Main', body: 'Body', labels: ['L1'], assignCopilot: true,
      childIssues: [ { title: 'Child 1', body: 'B1', labels: ['c1'] }, { title: 'Child 2', body: 'B2', labels: ['c2'] } ]
    });
    expect(res.status).toBe(201);
    expect(typeof res.body.issueNumber).toBe('number');
    expect(res.body.htmlUrl).toContain('Main');
    expect(res.body.labelsEnsured).toEqual(['L1']);
    expect(res.body.labelsCreated).toEqual([]); // no creations because getLabel succeeded
    expect(res.body.copilotAssigned).toBe(true);
    expect(res.body.childResults).toHaveLength(2);
    const titles = res.body.childResults.map((c: any) => c.title).sort();
    expect(titles).toEqual(['Child 1', 'Child 2']);
  });

  it('ensures missing labels via creation when getLabel returns 404', async () => {
    currentIssuesImpl = () => {
      let num = 200;
      const issues: IssuesAPI = {
        getLabel: vi.fn().mockRejectedValue({ status: 404 }),
        createLabel: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockImplementation(({ title }: IssueCreateCall) => ({ data: { number: ++num, html_url: 'https://example/' + title } })),
        addAssignees: vi.fn().mockResolvedValue({})
      };
      return issues;
    };
    const res = await request(app).post('/v4/issue-create').send({ owner: 'o', repo: 'r', title: 'MainLabels', labels: ['L1', 'L2'] });
    expect(res.status).toBe(201);
    expect(res.body.labelsCreated).toEqual(['L1', 'L2']);
    expect(res.body.labelsEnsured).toEqual(['L1', 'L2']);
    const instance = (Octokit as any).mock.results[0].value;
    expect(instance.issues.getLabel).toHaveBeenCalledTimes(2);
    expect(instance.issues.createLabel).toHaveBeenCalledTimes(2);
  });

  it('reports partial child issue failures while continuing others', async () => {
    currentIssuesImpl = () => {
      let mainIssued = false;
      const issues: IssuesAPI = {
        getLabel: vi.fn().mockResolvedValue({}),
        createLabel: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockImplementation(({ title }: IssueCreateCall) => {
          if (!mainIssued) { mainIssued = true; return { data: { number: 10, html_url: 'https://example/' + title } }; }
          if (title === 'Child Fail') return Promise.reject(new Error('child boom'));
          return { data: { number: 11, html_url: 'https://example/' + title } };
        }),
        addAssignees: vi.fn().mockResolvedValue({})
      };
      return issues;
    };
    const res = await request(app).post('/v4/issue-create').send({ owner: 'o', repo: 'r', title: 'MainPartial', childIssues: [ { title: 'Child OK', body: 'B' }, { title: 'Child Fail', body: 'B2' } ] });
    expect(res.status).toBe(201);
    expect(res.body.childResults).toHaveLength(2);
    const ok = res.body.childResults.find((c: any) => c.title === 'Child OK');
    const fail = res.body.childResults.find((c: any) => c.title === 'Child Fail');
    expect(ok.issueNumber).toBeDefined();
    expect(fail.error).toMatch(/child boom/i);
  });

  it('sets copilotAssigned=true when assignment succeeds', async () => {
    const res = await request(app).post('/v4/issue-create').send({ owner: 'o', repo: 'r', title: 'MainCopilot', assignCopilot: true });
    expect(res.status).toBe(201);
    expect(res.body.copilotAssigned).toBe(true);
  });

  it('sets copilotAssigned=false when assignment fails', async () => {
    currentIssuesImpl = () => {
      let issued = false;
      const issues: IssuesAPI = {
        getLabel: vi.fn().mockResolvedValue({}),
        createLabel: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockImplementation(({ title }: IssueCreateCall) => {
          if (!issued) { issued = true; return { data: { number: 99, html_url: 'https://example/' + title } }; }
          return { data: { number: 100, html_url: 'https://example/' + title } };
        }),
        addAssignees: vi.fn().mockRejectedValue(new Error('assign fail'))
      };
      return issues;
    };
    const res = await request(app).post('/v4/issue-create').send({ owner: 'o', repo: 'r', title: 'MainCopilotFail', assignCopilot: true });
    expect(res.status).toBe(201);
    expect(res.body.copilotAssigned).toBe(false);
  });

  it('handles main issue creation failure', async () => {
    currentIssuesImpl = () => ({
      getLabel: vi.fn().mockResolvedValue({}),
      createLabel: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockRejectedValue(new Error('boom')),
      addAssignees: vi.fn().mockResolvedValue({})
    }) as unknown as IssuesAPI;
    const res = await request(app).post('/v4/issue-create').send({ owner: 'o', repo: 'r', title: 'Failing' });
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/Failed to create issue/);
  });
});
