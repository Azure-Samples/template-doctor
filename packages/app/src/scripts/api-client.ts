// Unified frontend ApiClient with feature flag to route to backend functions
// Falls back to direct GitHubClient if backend feature is disabled.

interface IssueCreateRequest {
  owner: string; repo: string; title: string; body?: string; labels?: string[]; assignCopilot?: boolean;
}
interface IssueCreateResponse {
  issueNumber: number; htmlUrl: string; labelsEnsured: string[]; labelsCreated: string[]; copilotAssigned?: boolean;
}
interface ForkRequest { sourceOwner: string; sourceRepo: string; targetOwner?: string; waitForReady?: boolean; }
interface ForkResponse { forkOwner: string; repo: string; htmlUrl?: string; ready: boolean; attemptedCreate: boolean; }

const backendEnabled = () => (window as any).TemplateDoctorConfig?.features?.backendMigration === true;
const apiBase = () => (window as any).TemplateDoctorConfig?.apiBase || '/api';

async function httpJson(path: string, init: RequestInit): Promise<any> {
  const res = await fetch(apiBase().replace(/\/$/, '') + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) }
  });
  if (!res.ok) {
    let detail: any = undefined;
    try { detail = await res.json(); } catch {}
    throw new Error(`HTTP ${res.status} ${path} ${(detail && detail.error) || ''}`);
  }
  return res.json();
}

export const ApiClient = {
  async createIssue(req: IssueCreateRequest): Promise<IssueCreateResponse> {
    if (backendEnabled()) {
      return httpJson('/v4/issue-create', { method: 'POST', body: JSON.stringify(req) });
    }
    // Fallback: use window.GitHubClient directly
    const gh: any = (window as any).GitHubClient;
    if (!gh) throw new Error('GitHubClient not ready');
    // Ensure labels then create via existing TS client methods
    if (req.labels?.length) {
      await gh.ensureLabelsExist(req.owner, req.repo, req.labels);
    }
    const issue = await gh.createIssueGraphQL({ owner: req.owner, repo: req.repo, title: req.title, body: req.body, labels: req.labels });
    if (req.assignCopilot) {
      try { await gh.assignIssueToCopilotBot(issue.issueNodeId); } catch {}
    }
    return { issueNumber: issue.number, htmlUrl: issue.url, labelsEnsured: req.labels || [], labelsCreated: [], copilotAssigned: !!req.assignCopilot };
  },
  async forkRepository(req: ForkRequest): Promise<ForkResponse> {
    if (backendEnabled()) {
      return httpJson('/v4/repo-fork', { method: 'POST', body: JSON.stringify(req) });
    }
    const gh: any = (window as any).GitHubClient;
    if (!gh) throw new Error('GitHubClient not ready');
    const result = await gh.forkRepository(req.sourceOwner, req.sourceRepo);
    return { forkOwner: result.forkOwner, repo: req.sourceRepo, htmlUrl: result.htmlUrl, ready: true, attemptedCreate: true };
  }
};

// Expose for debugging
(window as any).TemplateDoctorApiClient = ApiClient;

document.dispatchEvent(new CustomEvent('api-client-ready'));
