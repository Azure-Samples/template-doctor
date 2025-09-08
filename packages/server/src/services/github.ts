import { Octokit } from '@octokit/rest';

// Basic redacting logger (no tokens). Accepts optional console-like interface for injection.
export interface GhLogger { info: (...args: any[]) => void; warn: (...args: any[]) => void; error: (...args: any[]) => void; }
const defaultLogger: GhLogger = { info: (...a) => console.log('[gh]', ...a), warn: (...a) => console.warn('[gh]', ...a), error: (...a) => console.error('[gh]', ...a) };

interface RetryOpts { attempts?: number; delayMs?: number; logger?: GhLogger; }

async function withRetry<T>(fn: () => Promise<T>, { attempts = 3, delayMs = 300, logger = defaultLogger }: RetryOpts = {}): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (err: any) {
      lastErr = err;
      logger.warn(`Retryable GitHub op failed (attempt ${i+1}/${attempts}):`, err?.status || err?.message || err);
      if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs * (i + 1))); // linear backoff
    }
  }
  throw lastErr;
}

/** Retrieve required workflow token or throw */
export function getGhToken(): string {
  const token = process.env.GH_WORKFLOW_TOKEN;
  if (!token) throw new Error('GH_WORKFLOW_TOKEN missing');
  return token;
}

export function createOctokit(token = getGhToken()) {
  return new Octokit({ auth: token, userAgent: 'TemplateDoctorBackend' });
}

/** Dispatch a repository event (POST /repos/:slug/dispatches) */
export async function dispatchRepositoryEvent(params: {
  repoSlug: string;
  event_type: string;
  client_payload: any;
  token?: string;
  logger?: GhLogger;
}): Promise<Response> {
  const { repoSlug, event_type, client_payload, token = getGhToken(), logger = defaultLogger } = params;
  const apiUrl = `https://api.github.com/repos/${repoSlug}/dispatches`;
  logger.info('dispatchRepositoryEvent', { repoSlug, event_type });
  return withRetry(() => fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ event_type, client_payload })
  }), { logger });
}

/** Trigger a workflow_dispatch */
export async function workflowDispatch(params: {
  owner: string;
  repo: string;
  workflowFile: string;
  ref: string;
  inputs: Record<string, string>;
  token?: string;
  logger?: GhLogger;
}): Promise<Response> {
  const { owner, repo, workflowFile, ref, inputs, token = getGhToken(), logger = defaultLogger } = params;
  const ghUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`;
  logger.info('workflowDispatch', { owner, repo, workflowFile });
  return withRetry(() => fetch(ghUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ref, inputs })
  }), { logger });
}

/** Fork a repository with optional readiness polling */
export async function forkRepository(params: {
  sourceOwner: string;
  sourceRepo: string;
  targetOwner?: string;
  waitForReady: boolean;
  maxPollAttempts?: number;
  logger?: GhLogger;
}): Promise<{ status: number; body: any }>{
  const { sourceOwner, sourceRepo, targetOwner, waitForReady, maxPollAttempts = 3, logger = defaultLogger } = params;
  const token = getGhToken();
  const octokit = createOctokit(token);

  // Identify authenticated user
  let authedUser: string | undefined;
  try { const me = await withRetry(() => octokit.users.getAuthenticated(), { logger }); authedUser = me.data.login; } catch { logger.warn('Could not get authenticated user'); }
  const forkOwner = targetOwner || authedUser;
  if (!forkOwner) return { status: 500, body: { error: 'Could not determine fork owner' } };

  // Existing fork?
  try {
    const existing = await withRetry(() => octokit.repos.get({ owner: forkOwner, repo: sourceRepo }), { attempts: 2, logger });
    return { status: 200, body: { forkOwner, repo: sourceRepo, htmlUrl: existing.data.html_url, ready: true, attemptedCreate: false } };
  } catch {}

  let forkHtml: string | undefined;
  try {
    const forkResp = await withRetry(() => octokit.repos.createFork({ owner: sourceOwner, repo: sourceRepo, organization: targetOwner }), { logger });
    forkHtml = forkResp.data?.html_url;
  } catch (err: any) {
    const docUrl: string | undefined = err?.response?.data?.documentation_url || err?.documentation_url || err?.data?.documentation_url;
    if (err?.status === 403 && docUrl && /\/saml-single-sign-on\//i.test(docUrl)) {
      return { status: 403, body: { error: 'SAML SSO authorization required to fork this repository', samlRequired: true, documentationUrl: docUrl, authorizeUrl: docUrl } };
    }
    return { status: 502, body: { error: 'Failed to initiate fork', details: err?.message, documentationUrl: docUrl } };
  }

  if (!waitForReady) return { status: 202, body: { forkOwner, repo: sourceRepo, htmlUrl: forkHtml, ready: false, attemptedCreate: true } };

  let ready = false;
  for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
    try { const r = await octokit.repos.get({ owner: forkOwner, repo: sourceRepo }); if (r.status === 200) { ready = true; break; } } catch {}
  }

  return { status: 201, body: { forkOwner, repo: sourceRepo, htmlUrl: forkHtml, ready, attemptedCreate: true } };
}

/** Utility for future issue-create migration: ensure labels (idempotent). */
export async function ensureLabels(octokit: ReturnType<typeof createOctokit>, owner: string, repo: string, labels: string[]): Promise<{ ensured: string[]; created: string[] }> {
  const ensured: string[] = []; const created: string[] = [];
  for (const label of labels) {
    if (!label) continue;
    try { await (octokit as any).issues.getLabel({ owner, repo, name: label }); ensured.push(label); }
    catch (err: any) {
      if (err?.status === 404) {
        try { await (octokit as any).issues.createLabel({ owner, repo, name: label, color: hashColor(label) }); created.push(label); ensured.push(label); } catch {}
      }
    }
  }
  return { ensured, created };
}

export function hashColor(input: string): string {
  let hash = 0; for (let i = 0; i < input.length; i++) { hash = (hash << 5) - hash + input.charCodeAt(i); hash |= 0; }
  const r = (hash >> 16) & 0xff, g = (hash >> 8) & 0xff, b = hash & 0xff; const brighten = (c: number) => (c + 200) % 256;
  return ((brighten(r) << 16) | (brighten(g) << 8) | brighten(b)).toString(16).padStart(6, '0');
}

// --- Workflow helpers (for validation-status / cancel) ---
export async function listRecentWorkflowRuns(octokit: ReturnType<typeof createOctokit>, params: { owner: string; repo: string; workflowFile: string; branch: string; perPage?: number; logger?: GhLogger }) {
  const { owner, repo, workflowFile, branch, perPage = 50, logger = defaultLogger } = params;
  try {
    const r = await octokit.actions.listWorkflowRuns({ owner, repo, workflow_id: workflowFile, branch, event: 'workflow_dispatch', per_page: perPage });
    return r.data.workflow_runs || [];
  } catch (err: any) {
    logger.warn('listRecentWorkflowRuns failed', err?.status || err?.message); return [];
  }
}

export async function listRepoWorkflowRuns(octokit: ReturnType<typeof createOctokit>, params: { owner: string; repo: string; branch: string; perPage?: number; logger?: GhLogger }) {
  const { owner, repo, branch, perPage = 50, logger = defaultLogger } = params;
  try {
    const r = await octokit.actions.listWorkflowRunsForRepo({ owner, repo, branch, event: 'workflow_dispatch', per_page: perPage });
    return r.data.workflow_runs || [];
  } catch (err: any) {
    logger.warn('listRepoWorkflowRuns failed', err?.status || err?.message); return [];
  }
}

export async function getWorkflowRun(octokit: ReturnType<typeof createOctokit>, params: { owner: string; repo: string; runId: number; logger?: GhLogger }) {
  const { owner, repo, runId, logger = defaultLogger } = params;
  try { const r = await octokit.actions.getWorkflowRun({ owner, repo, run_id: runId }); return r.data; } catch (err: any) { logger.warn('getWorkflowRun failed', err?.status || err?.message); throw err; }
}

export async function cancelWorkflowRun(octokit: ReturnType<typeof createOctokit>, params: { owner: string; repo: string; runId: number; logger?: GhLogger }) {
  const { owner, repo, runId, logger = defaultLogger } = params;
  try { await octokit.actions.cancelWorkflowRun({ owner, repo, run_id: runId }); return true; } catch (err: any) { logger.warn('cancelWorkflowRun failed', err?.status || err?.message); throw err; }
}
