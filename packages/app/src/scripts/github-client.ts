// Lightweight TypeScript GitHub client wrapper (phase 1 migration)
// Mirrors a subset of the legacy js/github-client-new.js API surface.
// Goal: provide typed, promise-based interface plus a readiness contract
// while we progressively retire the legacy script. Additional methods will
// be filled in future phases.

// NOTE: We intentionally avoid depending on any build-time env and keep
// everything browser-side like the legacy implementation.

// Minimal type helpers (can be expanded later)
interface GitHubUser { login: string; name?: string; avatar_url?: string }
interface GitHubTreeItem { path: string; type: string; sha: string; size?: number }

type IssueInput = { title: string; body?: string; labels?: string[] };

interface CreateIssueResult { html_url: string; number: number; title: string }

// GitHubAuthLike is declared centrally in global.d.ts to avoid interface merge conflicts.

/**
 * Design notes:
 * - constructor is non-blocking; consumers wanting to wait for auth can await ready()
 * - methods throw if a token is required and none is available (matching legacy behavior)
 * - request() is the primitive; higher-level helpers compose it
 */
class GitHubClientTS {
  baseUrl = 'https://api.github.com';
  graphQLUrl = 'https://api.github.com/graphql';
  auth: GitHubAuthLike | undefined;
  currentUser: GitHubUser | null = null;
  private _readyPromise: Promise<void>;
  private _resolveReady!: () => void;
  private _initialized = false;

  constructor() {
    this.auth = (window as any).GitHubAuth;
    this._readyPromise = new Promise((res) => (this._resolveReady = res));
    this.bootstrap();
  }

  private bootstrap() {
    // If auth already present we can resolve quickly; otherwise poll briefly.
    if (this.auth) {
      this.finishInit();
      return;
    }
    let attempts = 0;
    const max = 10; // ~5s
    const interval = setInterval(() => {
      attempts++;
      this.auth = (window as any).GitHubAuth;
      if (this.auth || attempts >= max) {
        clearInterval(interval);
        this.finishInit();
      }
    }, 500);
  }

  private async finishInit() {
    if (this._initialized) return;
    this._initialized = true;
    // Attempt to load user (ignore failures; not required for readiness)
    try {
      if (this.auth?.isAuthenticated?.()) {
        this.currentUser = await this.getAuthenticatedUser();
      }
    } catch (e) {
      // non-fatal
      console.warn('[GitHubClientTS] load current user failed (ignored)', e);
    }
    this._resolveReady();
    document.dispatchEvent(new CustomEvent('github-client-ready'));
  }

  /** Wait until initial auth probing is complete */
  ready(): Promise<void> {
    return this._readyPromise;
  }

  private getTokenOrThrow(): string {
    const token = this.auth?.getAccessToken?.() || this.auth?.getToken?.();
    if (!token) throw new Error('Not authenticated');
    return token;
  }

  async request(path: string, options: RequestInit = {}): Promise<any> {
    const token = this.getTokenOrThrow();
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `token ${token}`,
      ...(options.headers as any),
    };
    const resp = await fetch(url, { ...options, headers });
    if (!resp.ok) {
      let detail: any = null;
      try { detail = await resp.json(); } catch { /* ignore */ }
      const err = new Error(detail?.message || `GitHub API error: ${resp.status}`) as any;
      (err as any).status = resp.status;
      (err as any).data = detail;
      throw err;
    }
    // Some endpoints legitimately return 204 (no content)
    if (resp.status === 204) return null;
    return resp.json();
  }

  async requestAllPages(path: string, options: RequestInit = {}): Promise<any[]> {
    const token = this.getTokenOrThrow();
    const base = path.startsWith('http') ? '' : this.baseUrl;
    let next = `${base}${path}`;
    const out: any[] = [];
    const baseHeaders = {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `token ${token}`,
      ...(options.headers as any),
    };
    const getNext = (link: string | null) => {
      if (!link) return null;
      for (const part of link.split(',')) {
        const m = part.match(/<([^>]+)>;\s*rel="next"/);
        if (m) return m[1];
      }
      return null;
    };
    while (next) {
      const r = await fetch(next, { ...options, headers: baseHeaders });
      if (!r.ok) throw new Error(`GitHub API error: ${r.status}`);
      const data = await r.json();
      if (Array.isArray(data)) out.push(...data); else return data; // non-array early exit
      next = getNext(r.headers.get('Link'));
    }
    return out;
  }

  async getAuthenticatedUser(): Promise<GitHubUser> {
    return this.request('/user');
  }

  async getRepository(owner: string, repo: string): Promise<any> {
    return this.request(`/repos/${owner}/${repo}`);
  }

  async getDefaultBranch(owner: string, repo: string): Promise<string> {
    const repoData = await this.getRepository(owner, repo);
    return repoData.default_branch;
  }

  async listAllFiles(owner: string, repo: string, branch?: string): Promise<string[]> {
    const ref = branch || (await this.getDefaultBranch(owner, repo));
    // Use git trees API (recursive)
    const tree = await this.request(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`);
    if (!tree?.tree) return [];
    return (tree.tree as GitHubTreeItem[])
      .filter((i) => i.type === 'blob')
      .map((i) => i.path);
  }

  async getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<string> {
    const params = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    const data = await this.request(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}${params}`);
    if (data && data.content && data.encoding === 'base64') {
      try {
        return atob(data.content.replace(/\n/g, ''));
      } catch {
        // fallback decode
        return decodeURIComponent(escape(window.atob(data.content.replace(/\n/g, ''))));
      }
    }
    // If it is binary or not encoded, attempt raw fetch via media header
    return typeof data === 'string' ? data : '';
  }

  async checkTokenScopes(): Promise<string[]> {
    // HEAD grants scopes faster (no payload). Some browsers disallow HEAD -> fallback GET.
    const token = this.getTokenOrThrow();
    const headers: Record<string, string> = { Authorization: `token ${token}` };
    let resp: Response | null = null;
    try { resp = await fetch(`${this.baseUrl}/rate_limit`, { method: 'HEAD', headers }); }
    catch { /* fallback below */ }
    if (!resp || !resp.ok) {
      resp = await fetch(`${this.baseUrl}/rate_limit`, { headers });
    }
    const scopeHeader = resp.headers.get('x-oauth-scopes') || '';
    return scopeHeader ? scopeHeader.split(/,\s*/).filter(Boolean) : [];
  }

  async ensureLabelsExist(owner: string, repo: string, labels: string[]): Promise<string[]> {
    if (!labels || labels.length === 0) return [];
    const existing = await this.requestAllPages(`/repos/${owner}/${repo}/labels?per_page=100`);
    const existingLower = new Set(existing.map((l: any) => String(l.name).toLowerCase()));
    const toCreate = labels.filter((l) => !existingLower.has(l.toLowerCase()));
    await Promise.all(
      toCreate.map((name) =>
        this.request(`/repos/${owner}/${repo}/labels`, {
          method: 'POST',
          body: JSON.stringify({ name, color: 'ededed' }),
          headers: { 'Content-Type': 'application/json' },
        }).catch((e) => {
          console.warn('Label create failed (ignored)', name, e);
        }),
      ),
    );
    return labels;
  }

  async createIssue(owner: string, repo: string, input: IssueInput): Promise<CreateIssueResult> {
    await this.ensureLabelsExist(owner, repo, input.labels || []);
    const bodyPayload = {
      title: input.title,
      body: input.body || '',
      labels: input.labels || [],
    };
    return this.request(`/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
    });
  }

  async searchRepositories(query: string, page = 1, perPage = 10): Promise<any> {
    if (!query) return { total_count: 0, items: [] };
    const params = new URLSearchParams({ q: query, page: String(page), per_page: String(perPage) });
    return this.request(`/search/repositories?${params.toString()}`);
  }

  // Placeholder GraphQL method parity with legacy; may add richer error handling later
  async graphql(query: string, variables: Record<string, any> = {}): Promise<any> {
    const token = this.getTokenOrThrow();
    const resp = await fetch(this.graphQLUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `token ${token}` },
      body: JSON.stringify({ query, variables }),
    });
    const json = await resp.json();
    if (json.errors) {
      const err = new Error('GraphQL Error: ' + json.errors[0]?.message);
      (err as any).errors = json.errors;
      throw err;
    }
    return json.data;
  }

  // ---------------- Advanced / Issue & Fork Helpers (ported) ----------------
  getCurrentUsername(): string | null {
    try {
      // In case auth helper exposes richer API later
      if ((this.auth as any)?.getUsername) {
        const u = (this.auth as any).getUsername();
        if (u) return u;
      }
    } catch {}
    return this.currentUser?.login || null;
  }

  async getRepoNodeId(owner: string, name: string): Promise<string> {
    const q = `query($owner: String!, $name: String!){ repository(owner:$owner,name:$name){ id } }`;
    const data = await this.graphql(q, { owner, name });
    return data.repository.id;
  }

  async getLabelNodeIds(owner: string, name: string, labelNames: string[]): Promise<string[]> {
    if (!labelNames || labelNames.length === 0) return [];
    const q = `query($owner:String!,$name:String!){ repository(owner:$owner,name:$name){ labels(first:100){ nodes { id name } } } }`;
    const data = await this.graphql(q, { owner, name });
    const all = data.repository.labels.nodes as { id: string; name: string }[];
    return labelNames.map(l => all.find(a => a.name === l)?.id || null).filter(Boolean) as string[];
  }

  async createIssueGraphQL(owner: string, repo: string, title: string, body: string, labelNames: string[] = []): Promise<any> {
    // Scope check (soft)
    const scopes = await this.checkTokenScopes().catch(() => [] as string[]);
    if (!(scopes.includes('public_repo') || scopes.includes('repo'))) {
      throw new Error('Your GitHub token does not have the "public_repo" permission required to create issues');
    }
    let repoId: string;
    try { repoId = await this.getRepoNodeId(owner, repo); } catch { throw new Error(`Could not find repository: ${owner}/${repo}`); }
    // Try to locate copilot assignment candidate
    let copilotActor: { id: string } | null = null;
    try {
      const suggestedQ = `query($owner:String!,$repo:String!){ repository(owner:$owner,name:$repo){ id suggestedActors(capabilities:[CAN_BE_ASSIGNED],first:10){ nodes { login __typename ... on Bot { id } ... on User { id } } } } }`;
      const repoData = await this.graphql(suggestedQ, { owner, repo });
      copilotActor = repoData.repository.suggestedActors.nodes.find((n: any) => n.login === 'copilot-agent-swe') || repoData.repository.suggestedActors.nodes.find((n: any) => n.login === 'copilot-swe-agent') || null;
    } catch {}
    let labelIds: string[] = [];
    try { labelIds = await this.getLabelNodeIds(owner, repo, labelNames); } catch {}
    const start = Date.now();
    let data: any;
    if (copilotActor) {
      const mutation = `mutation($input:CreateIssueInput!){ createIssue(input:$input){ issue { id number url title assignees(first:5){nodes{login id}} } } }`;
      data = await this.graphql(mutation, { input: { repositoryId: repoId, title, body, assigneeIds: [copilotActor.id], labelIds } });
    } else {
      const mutation = `mutation($repositoryId:ID!,$title:String!,$body:String,$labelIds:[ID!]){ createIssue(input:{repositoryId:$repositoryId,title:$title,body:$body,labelIds:$labelIds}){ issue { id number url title } } }`;
      data = await this.graphql(mutation, { repositoryId: repoId, title, body, labelIds });
      // fallback assignment attempts (REST then GraphQL helper)
      try {
        const issueNumber = data.createIssue.issue.number;
        const token = this.getTokenOrThrow();
        const resp = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/issues/${issueNumber}/assignees`, {
          method: 'POST',
          headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignees: ['@copilot-agent-swe'] }),
        });
        if (!resp.ok) {
          await this.assignIssueToCopilotBot(owner, repo, issueNumber).catch(() => {});
        }
      } catch { /* ignore assignment failure */ }
    }
    const dur = Date.now() - start;
    console.debug(`[GitHubClientTS] Issue created in ${dur}ms`);
    return data.createIssue.issue;
  }

  async assignIssueToCopilotBot(owner: string, repo: string, issueNumber: number): Promise<boolean> {
    try {
      const q = `query($owner:String!,$repo:String!,$number:Int!){ repository(owner:$owner,name:$repo){ issue(number:$number){ id } suggestedActors(capabilities:[CAN_BE_ASSIGNED],first:10){ nodes { login __typename ... on Bot { id } ... on User { id } } } } }`;
      const d = await this.graphql(q, { owner, repo, number: issueNumber });
      const issueId = d.repository.issue.id;
      const actor = d.repository.suggestedActors.nodes.find((n: any) => n.login === 'copilot-agent-swe' || n.login === 'copilot-swe-agent');
      if (!actor) return false;
      const m = `mutation($issueId:ID!,$assigneeId:ID!){ addAssigneesToAssignable(input:{assignableId:$issueId,assigneeIds:[$assigneeId]}){ clientMutationId } }`;
      await this.graphql(m, { issueId, assigneeId: actor.id });
      return true;
    } catch { return false; }
  }

  async findIssuesByTitle(owner: string, repo: string, title: string, labelName?: string): Promise<any[]> {
    const q = `query($owner:String!,$name:String!){ repository(owner:$owner,name:$name){ issues(first:20,states:[OPEN,CLOSED],filterBy:{ since:"2022-01-01T00:00:00Z"}){ nodes { id number title url state labels(first:10){ nodes { name } } } } } }`;
    const d = await this.graphql(q, { owner, name: repo });
    return d.repository.issues.nodes.filter((iss: any) => iss.title === title && (!labelName || iss.labels.nodes.some((l: any) => l.name === labelName)));
  }

  async forkRepository(owner: string, repo: string): Promise<any> {
    const result = await this.request(`/repos/${owner}/${repo}/forks`, { method: 'POST' });
    try {
      const confirmed = await this.waitForForkAvailability(owner, repo);
      if (confirmed) return confirmed;
    } catch (e) {
      console.warn('[GitHubClientTS] Fork availability polling failed', e);
    }
    return result;
  }

  async waitForForkAvailability(owner: string, repo: string, timeoutMs = 60000, intervalMs = 1500): Promise<any | null> {
    const username = this.getCurrentUsername();
    if (!username) return null;
    const start = Date.now();
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    while (Date.now() - start < timeoutMs) {
      try {
        const info = await this.request(`/repos/${username}/${repo}`);
        const isFork = info?.fork === true;
        const parentMatches = info?.parent?.full_name ? info.parent.full_name.toLowerCase() === `${owner}/${repo}`.toLowerCase() : true;
        if (isFork && parentMatches) return info;
      } catch (err: any) {
        if (err?.status && err.status !== 404) {
          console.warn('[GitHubClientTS] waitForForkAvailability transient error:', err.message);
        }
      }
      await sleep(intervalMs);
    }
    return null;
  }

  async checkUserHasFork(owner: string, repo: string): Promise<boolean> {
    const username = this.getCurrentUsername();
    if (!username) return false;
    try {
      const repoData = await this.request(`/repos/${username}/${repo}`);
      return repoData.fork === true && repoData.parent && repoData.parent.full_name === `${owner}/${repo}`;
    } catch (err: any) {
      if (err?.status === 404) return false;
      console.warn('[GitHubClientTS] Error checking for existing fork:', err?.message || err);
      return false;
    }
  }
}

// Singleton creation with compatibility logic
(() => {
  try {
    const existing = (window as any).GitHubClient;
    const tsInstance = new GitHubClientTS();
    // Expose under a TS-specific handle for debugging
    (window as any).GitHubClientTS = tsInstance;
    // Overwrite legacy global (phase 1). If we need to keep original we could attach at window.GitHubClientLegacy.
    (window as any).GitHubClient = tsInstance;
    console.debug('[GitHubClientTS] Initialized (legacy existing:', !!existing, ')');
  } catch (e) {
    console.error('[GitHubClientTS] Failed to initialize', e);
  }
})();

export {}; // ensure module scope
