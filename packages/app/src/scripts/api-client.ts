// Unified frontend ApiClient with feature flag to route to backend functions
// Falls back to direct GitHubClient if backend feature is disabled.

interface IssueCreateRequest {
  owner: string; repo: string; title: string; body?: string; labels?: string[]; assignCopilot?: boolean;
  childIssues?: { title: string; body: string; labels?: string[] }[];
}
interface IssueCreateResponse {
  issueNumber: number; htmlUrl: string; labelsEnsured: string[]; labelsCreated: string[]; copilotAssigned?: boolean;
  childResults?: { title: string; issueNumber?: number; error?: string }[];
}
interface ForkRequest { sourceOwner: string; sourceRepo: string; targetOwner?: string; waitForReady?: boolean; }
interface ForkResponse { forkOwner: string; repo: string; htmlUrl?: string; ready: boolean; attemptedCreate: boolean; samlRequired?: boolean; documentationUrl?: string; authorizeUrl?: string; error?: string; }

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
    const err: any = new Error(`HTTP ${res.status} ${path} ${(detail && detail.error) || ''}`);
    if (detail) Object.assign(err, detail);
    err.status = res.status;
    throw err;
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
      try {
        return await httpJson('/v4/repo-fork', { method: 'POST', body: JSON.stringify(req) });
      } catch (e: any) {
        // If SAML required, propagate structured object
        if (e?.samlRequired) {
          // Always surface a warning notification even if the notification system
          // is not yet initialized when the 403 response is handled. We defer
          // rendering until 'notifications-ready' if needed to avoid race flakiness
          // observed in Playwright tests.
          try {
            const showSamlNotification = () => {
              try {
                const ns = (window as any).NotificationSystem;
                if (ns && typeof ns.show === 'function') {
                  ns.show({
                    title: 'SAML Authorization Required',
                    message: 'This repository requires SAML SSO authorization before forking. Use the authorization link if provided.',
                    type: 'warning',
                    duration: 12000,
                    actions: e.authorizeUrl ? [{ label: 'Authorize SAML', primary: true, onClick: () => window.open(e.authorizeUrl,'_blank') }] : []
                  });
                }
              } catch(_) {}
            };
            if ((window as any).NotificationSystem && typeof (window as any).NotificationSystem.show === 'function') {
              showSamlNotification();
            } else {
              document.addEventListener('notifications-ready', showSamlNotification, { once: true });
            }
          } catch(_) {}
          return { forkOwner: req.targetOwner || 'unknown', repo: req.sourceRepo, htmlUrl: undefined, ready: false, attemptedCreate: false, samlRequired: true, documentationUrl: e.documentationUrl, authorizeUrl: e.authorizeUrl, error: e.error };
        }
        throw e;
      }
    }
    const gh: any = (window as any).GitHubClient;
    if (!gh) throw new Error('GitHubClient not ready');
    const result = await gh.forkRepository(req.sourceOwner, req.sourceRepo);
    return { forkOwner: result.forkOwner, repo: req.sourceRepo, htmlUrl: result.htmlUrl, ready: true, attemptedCreate: true };
  },
  async startBatchScan(repos: string[], mode?: string): Promise<{ batchId: string; acceptedCount: number; }> {
    if (!backendEnabled()) throw new Error('Backend feature disabled');
    return httpJson('/v4/batch-scan-start', { method: 'POST', body: JSON.stringify({ repos, mode }) });
  },
  async getBatchStatus(batchId: string): Promise<any> {
    if (!backendEnabled()) throw new Error('Backend feature disabled');
    const res = await fetch(apiBase().replace(/\/$/, '') + '/v4/batch-scan-status?batchId=' + encodeURIComponent(batchId));
    if (!res.ok) throw new Error('HTTP ' + res.status + ' batch-scan-status');
    return res.json();
  }
};

// Expose for debugging
(window as any).TemplateDoctorApiClient = ApiClient;

document.dispatchEvent(new CustomEvent('api-client-ready'));
