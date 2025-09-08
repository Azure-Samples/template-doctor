/**
 * Unified Validation Module
 * Combines legacy simple template validation and workflow-based validation with cancellation & job logs.
 * Backward compatibility globals exposed:
 *  - window.TemplateValidation.init/run (simple mode)
 *  - window.GitHubWorkflowValidation.init/run (workflow mode)
 *  - window.initGithubWorkflowValidation / runGithubWorkflowValidation (aliases)
 */

// -------------------------------------- Types --------------------------------------
export type ValidationMode = 'simple' | 'workflow';

export interface ValidationInitOptions {
  container: string | HTMLElement;
  templateRef: string; // owner/repo or full URL
  mode?: ValidationMode;
  features?: {
    cancellation?: boolean; // default true in workflow mode
    jobLogs?: boolean; // expose per-job logs list
  };
  polling?: {
    intervalMs?: number; // default 10s simple / 30s workflow
    maxAttempts?: number; // default 30 simple / 60 workflow
  };
  onStatusChange?: (e: ValidationEvent) => void;
}

export type ValidationState =
  | 'idle'
  | 'starting'
  | 'triggered'
  | 'running'
  | 'cancelling'
  | 'cancelled'
  | 'completed-success'
  | 'completed-failure'
  | 'error'
  | 'timeout';

export interface ValidationEvent {
  state: ValidationState;
  runId?: string;
  githubRunId?: string;
  message?: string;
  details?: any;
  raw?: any;
}

export interface UnifiedValidationAPI {
  start(): Promise<void>;
  cancel(): Promise<void>;
  getState(): ValidationState;
  destroy(): void;
  resumeLastRun(): boolean; // attempts resume, returns true if resumed
}

// -------------------------------------- Internal Helpers --------------------------------------
interface InternalContext {
  opts: Required<ValidationInitOptions> & { mode: ValidationMode };
  containerEl: HTMLElement;
  ui: ReturnType<typeof buildUI> | null;
  state: ValidationState;
  runId?: string;
  githubRunId?: string;
  pollAttempts: number;
  abortController?: AbortController;
  cancelled?: boolean;
  pollTimer?: number;
}

function resolveContainer(container: string | HTMLElement): HTMLElement {
  if (typeof container === 'string') {
    const el = document.getElementById(container);
    if (!el) throw new Error(`Validation container '${container}' not found`);
    return el;
  }
  return container;
}

function normalizeTemplateRef(ref: string): string {
  // Accept full URL or owner/repo; attempt extraction
  try {
    if (ref.startsWith('http')) {
      const u = new URL(ref);
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
    }
  } catch {
    /* ignore */
  }
  return ref;
}

function buildApiRoute(name: 'validation-template' | 'validation-status' | 'validation-cancel', query?: Record<string, string | undefined>): string {
  const w: any = window as any;
  if (w.ApiRoutes && typeof w.ApiRoutes.build === 'function') {
    return w.ApiRoutes.build(name, { query });
  }

  // Fallback logic: differentiate local vs hosted; default to unversioned /api endpoints
  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const base = isLocal ? 'http://localhost:7071' : '';
  const path = `/api/${name}`; // legacy path (unversioned) for workflow script compatibility
  if (query && Object.keys(query).length) {
    const usp = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => v != null && usp.append(k, v));
    return `${base}${path}?${usp.toString()}`;
  }
  return `${base}${path}`;
}

function notify(type: 'success'|'error'|'warning'|'info', title: string, message: string, duration?: number) {
  const ns: any = (window as any).NotificationSystem;
  if (!ns) return;
  const map: Record<string,string> = { success:'showSuccess', error:'showError', warning:'showWarning', info:'showInfo' };
  const fn = ns[map[type]];
  if (typeof fn === 'function') fn(title, message, duration);
}

// -------------------------------------- UI Construction --------------------------------------
function buildUI(container: HTMLElement, mode: ValidationMode, features: { cancellation: boolean; jobLogs: boolean }) {
  // Clear prior instance
  container.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'td-validation';
  root.innerHTML = `
    <div class="td-val-header">
      <h3>${mode === 'workflow' ? 'Template Validation (Workflow)' : 'Template Validation'}</h3>
      <div class="td-val-controls">
        <button class="td-val-start btn btn-primary" type="button">Run Validation</button>
        ${features.cancellation ? '<button class="td-val-cancel btn btn-danger" type="button" style="display:none;">Cancel</button>' : ''}
      </div>
    </div>
    <div class="td-val-status" role="status" aria-live="polite" style="display:none;"></div>
    <div class="td-val-progress" style="display:none;">
      <div class="td-val-progress-bar"><div class="td-val-progress-inner" style="width:0%"></div></div>
    </div>
    <div class="td-val-logs" style="display:none;"><pre class="td-val-log-pre"></pre></div>
    <div class="td-val-joblogs" style="display:none;"></div>
    <div class="td-val-results" style="display:none;">
      <div class="td-val-summary"></div>
      <div class="td-val-details"></div>
    </div>
  `;
  container.appendChild(root);
  return {
    root,
    startBtn: root.querySelector<HTMLButtonElement>('.td-val-start'),
    cancelBtn: root.querySelector<HTMLButtonElement>('.td-val-cancel'),
    statusEl: root.querySelector<HTMLElement>('.td-val-status'),
    progressBar: root.querySelector<HTMLElement>('.td-val-progress'),
    progressInner: root.querySelector<HTMLElement>('.td-val-progress-inner'),
    logsWrap: root.querySelector<HTMLElement>('.td-val-logs'),
    logsPre: root.querySelector<HTMLPreElement>('.td-val-log-pre'),
    jobLogs: root.querySelector<HTMLElement>('.td-val-joblogs'),
    resultsWrap: root.querySelector<HTMLElement>('.td-val-results'),
    summary: root.querySelector<HTMLElement>('.td-val-summary'),
    details: root.querySelector<HTMLElement>('.td-val-details'),
  };
}

// Styles have been externalized to css/validation.css (imported via main bundle)
function injectBaseStylesOnce() { /* no-op retained for backward safety */ }

// -------------------------------------- Core Implementation --------------------------------------
export function initValidation(options: ValidationInitOptions): UnifiedValidationAPI {
  const defaults: Partial<ValidationInitOptions> = {
    mode: 'simple',
    features: {},
    polling: {},
  };
  const merged: ValidationInitOptions = { ...defaults, ...options } as ValidationInitOptions;
  const mode = merged.mode || 'simple';
  const features = {
    cancellation: mode === 'workflow',
    jobLogs: mode === 'workflow' && (merged.features?.jobLogs ?? true),
    ...merged.features,
  };
  const polling = {
    intervalMs: mode === 'workflow' ? 30000 : 10000,
    maxAttempts: mode === 'workflow' ? 60 : 30,
    ...merged.polling,
  };
  // Test harness overrides (non-production) for faster polling / edge-case simulation
  try {
    const overrides: any = (window as any).__ValidationTestOverrides;
    if (overrides?.polling) {
      if (typeof overrides.polling.intervalMs === 'number') polling.intervalMs = overrides.polling.intervalMs;
      if (typeof overrides.polling.maxAttempts === 'number') polling.maxAttempts = overrides.polling.maxAttempts;
    }
  } catch {/* ignore */}
  const ctx: InternalContext = {
    opts: { ...merged, mode, features, polling } as any,
    containerEl: resolveContainer(merged.container),
    ui: null,
    state: 'idle',
    pollAttempts: 0,
  };
  injectBaseStylesOnce();
  ctx.ui = buildUI(ctx.containerEl, mode, features);
  // Accessibility refinements
  if (ctx.ui?.summary) {
    ctx.ui.summary.setAttribute('role','region');
    ctx.ui.summary.setAttribute('aria-live','polite');
    ctx.ui.summary.setAttribute('aria-label','Validation summary');
  }

  // Bind start/cancel buttons
  ctx.ui.startBtn?.addEventListener('click', () => {
    if (ctx.state === 'idle' || ctx.state === 'completed-success' || ctx.state === 'completed-failure' || ctx.state === 'error' || ctx.state === 'timeout') {
      startValidation(ctx).catch((e) => console.error('[validation] start error', e));
    }
  });
  ctx.ui.cancelBtn?.addEventListener('click', () => {
    if (features.cancellation) cancelValidation(ctx).catch((e) => console.error('[validation] cancel error', e));
  });

  // Resume last run if available and appears incomplete (fresh within 2h) and no new run initiated yet
  try {
    const stored = localStorage.getItem('lastValidationRunInfo');
    if (stored) {
      const info = JSON.parse(stored);
      if (info?.runId && info.ts && Date.now() - info.ts < 2 * 60 * 60 * 1000) { // 2 hours freshness window
        ctx.runId = info.runId;
        ctx.githubRunId = info.githubRunId;
        ctx.state = 'triggered';
        transition(ctx, 'running', 'Resuming previous validation run…');
        if (ctx.ui?.logsWrap) ctx.ui.logsWrap.style.display = mode === 'workflow' ? 'block' : 'none';
        schedulePoll(ctx, 0);
      }
    }
  } catch {/* ignore */}

  return {
    start: () => startValidation(ctx),
    cancel: () => cancelValidation(ctx),
    getState: () => ctx.state,
    destroy: () => {
      if (ctx.pollTimer) window.clearTimeout(ctx.pollTimer);
      ctx.containerEl.innerHTML = '';
      ctx.state = 'idle';
    },
    resumeLastRun: () => manualResume(ctx)
  };
}

async function startValidation(ctx: InternalContext) {
  if (ctx.state !== 'idle' && !ctx.state.startsWith('completed') && ctx.state !== 'error' && ctx.state !== 'timeout') return;
  transition(ctx, 'starting', 'Starting validation…');
  ctx.cancelled = false;
  ctx.pollAttempts = 0;
  ctx.githubRunId = undefined;
  ctx.runId = undefined;
  const ui = ctx.ui!;
  ui.resultsWrap!.style.display = 'none';
  ui.logsWrap!.style.display = ctx.opts.mode === 'workflow' ? 'block' : 'none';
  ui.jobLogs!.style.display = 'none';
  ui.statusEl!.style.display = 'block';
  ui.progressBar!.style.display = 'block';
  setProgress(ui, 5);
  ui.startBtn!.disabled = true;
  if (ui.cancelBtn) ui.cancelBtn.style.display = ctx.opts.features.cancellation ? 'inline-block' : 'none';

  try {
    // Build trigger request body supporting both templateName and templateUrl
    const templateNormalized = normalizeTemplateRef(ctx.opts.templateRef);
    const triggerUrl = buildApiRoute('validation-template');
    log(ctx, `Trigger URL: ${triggerUrl}`);
    const abort = new AbortController();
    ctx.abortController = abort;
    const resp = await fetch(triggerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateName: templateNormalized, templateUrl: ctx.opts.templateRef, targetRepoUrl: ctx.opts.templateRef }),
      signal: abort.signal,
    });
    if (!resp.ok) {
      const txt = await safeResponseText(resp);
      throw new Error(`Trigger failed: ${resp.status} ${resp.statusText} ${txt}`);
    }
    const data = await resp.json();
    ctx.runId = data.runId;
    if (data.githubRunId) ctx.githubRunId = data.githubRunId;
    persistRunMeta(ctx);
    transition(ctx, 'triggered', 'Validation workflow triggered.');
    notify('info', 'Validation Started', `Run ${ctx.runId}`, 4000);
    setProgress(ui, 15);
    schedulePoll(ctx, 0);
  } catch (err: any) {
    transition(ctx, 'error', err?.message || 'Failed to start validation');
    ui.startBtn!.disabled = false;
    if (ui.cancelBtn) ui.cancelBtn.style.display = 'none';
    notify('error', 'Validation Error', err?.message || 'Failed to start', 8000);
  }
}

async function cancelValidation(ctx: InternalContext) {
  if (!ctx.opts.features.cancellation) return;
  if (!ctx.runId) return;
  if (ctx.state !== 'running' && ctx.state !== 'triggered') return;
  transition(ctx, 'cancelling', 'Cancelling…');
  try {
    const cancelUrl = buildApiRoute('validation-cancel');
    const resp = await fetch(cancelUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: ctx.runId, githubRunId: ctx.githubRunId }),
    });
    if (!resp.ok) {
      const txt = await safeResponseText(resp);
      throw new Error(`Cancel failed: ${resp.status} ${resp.statusText} ${txt}`);
    }
    notify('success', 'Cancellation Requested', `Run ${ctx.runId}`, 5000);
    ctx.cancelled = true;
    // Keep polling to observe final status
  } catch (err: any) {
    notify('error', 'Cancellation Error', err?.message || 'Failed to cancel', 8000);
    transition(ctx, 'running', 'Resuming…');
  }
}

function schedulePoll(ctx: InternalContext, delay: number) {
  if (ctx.pollTimer) window.clearTimeout(ctx.pollTimer);
  ctx.pollTimer = window.setTimeout(() => pollStatus(ctx).catch(e => console.error(e)), delay) as unknown as number;
}

async function pollStatus(ctx: InternalContext) {
  if (!ctx.runId) return;
  const { polling, mode, features } = ctx.opts;
  if (ctx.pollAttempts >= (polling.maxAttempts || 30)) {
    transition(ctx, 'timeout', 'Validation taking longer than expected.');
    finalize(ctx, 'timeout');
    return;
  }
  ctx.pollAttempts++;
  if (ctx.state === 'triggered') transition(ctx, 'running', 'Validation running…');
  const ui = ctx.ui!;
  if (ui.progressInner && ctx.opts.mode === 'simple') {
    // simple synthetic progress up to 90%
    const pct = Math.min(90, 15 + ctx.pollAttempts * 5);
    setProgress(ui, pct);
  }
  log(ctx, `Polling attempt ${ctx.pollAttempts}`);
  try {
    const qs: Record<string,string> = { runId: ctx.runId };
    if (ctx.githubRunId) qs.githubRunId = ctx.githubRunId;
    if (features.jobLogs) qs.includeJobLogs = '1';
    qs.includeLogsUrl = '1';
    const statusUrl = buildApiRoute('validation-status', qs);
    const resp = await fetch(statusUrl, { headers: { 'Content-Type': 'application/json' } });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();
    if (data.githubRunId && !ctx.githubRunId) {
      ctx.githubRunId = data.githubRunId;
      persistRunMeta(ctx);
    }
    renderStatus(ctx, data);
    if (data.status === 'completed') {
      if (data.conclusion === 'success') {
        finalize(ctx, 'completed-success', data);
      } else if (ctx.cancelled || data.conclusion === 'cancelled') {
        finalize(ctx, 'cancelled', data);
      } else {
        finalize(ctx, 'completed-failure', data);
      }
      return;
    }
    // continue polling
    schedulePoll(ctx, polling.intervalMs);
  } catch (err: any) {
    log(ctx, `Poll error: ${err?.message}`);
    // mild backoff on errors
    schedulePoll(ctx, Math.min(polling.intervalMs * 1.5, 60000));
  }
}

function renderStatus(ctx: InternalContext, data: any) {
  const ui = ctx.ui!;
  if (ctx.opts.mode === 'workflow' && ui.logsWrap && ui.logsPre) {
    ui.logsWrap.style.display = 'block';
    ui.logsPre.textContent += `[${new Date().toISOString()}] Status: ${data.status || 'unknown'}\n`;
    ui.logsPre.scrollTop = ui.logsPre.scrollHeight;
  }
  if (ctx.opts.features.jobLogs && data.jobLogs && ui.jobLogs) {
    const items = data.jobLogs.map((j: any) => `<li><strong>${escapeHtml(j.name)}</strong> <em>(${escapeHtml(j.conclusion || j.status || 'unknown')})</em>${j.logsUrl ? ` - <a href="${j.logsUrl}" target="_blank">logs</a>` : ''}</li>`).join('');
    ui.jobLogs.style.display = 'block';
    ui.jobLogs.innerHTML = `<h4 style="margin:0 0 6px 0;">Job Logs</h4><ul style="margin:0; padding-left:18px;">${items}</ul>`;
  }
}

function finalize(ctx: InternalContext, state: ValidationState, data?: any) {
  transition(ctx, state, stateMessage(state));
  const ui = ctx.ui!;
  setProgress(ui, state === 'completed-success' ? 100 : 100);
  ui.startBtn!.disabled = false;
  if (ui.cancelBtn) ui.cancelBtn.style.display = 'none';
  ui.resultsWrap!.style.display = 'block';
  if (ui.summary) {
    let cls = 'td-val-summary';
    if (state === 'completed-success') cls += ' success';
    else if (state === 'completed-failure') cls += ' failure';
    else if (state === 'timeout') cls += ' timeout';
    else if (state === 'cancelled') cls += ' timeout';
    ui.summary.className = cls;
    ui.summary.innerHTML = summaryTemplate(ctx, state, data);
  }
  if (ui.details && data?.results?.details) {
    ui.details.innerHTML = detailsTemplate(data.results.details);
  } else if (ui.details && state === 'completed-failure' && !data?.results?.details) {
    ui.details.innerHTML = `<div style="background:#f6f8fa; padding:12px; border-radius:6px;">No detailed results provided. Check GitHub run for more information.</div>`;
  }
  // Timeout continuation button support
  if (state === 'timeout' && ui.summary) {
    const btnId = `td-val-continue-${ctx.runId || 'x'}`;
    ui.summary.innerHTML += `<p><button id="${btnId}" class="btn btn-primary" style="margin-top:8px;">Continue Checking Status</button></p>`;
    setTimeout(() => {
      const b = document.getElementById(btnId);
      if (b) b.addEventListener('click', () => {
        if (!ctx.runId) return;
        ctx.state = 'running';
        transition(ctx, 'running', 'Continuing to poll…');
        schedulePoll(ctx, 0);
      });
    }, 0);
  }
  // Notifications
  switch (state) {
    case 'completed-success': notify('success', 'Validation Success', `Run ${ctx.runId}`, 5000); break;
    case 'completed-failure': notify('error', 'Validation Failed', `Run ${ctx.runId}`, 8000); break;
    case 'cancelled': notify('warning', 'Validation Cancelled', `Run ${ctx.runId}`, 5000); break;
    case 'timeout': notify('warning', 'Validation Timeout', `Run ${ctx.runId}`, 8000); break;
  }
}

function transition(ctx: InternalContext, state: ValidationState, msg?: string) {
  ctx.state = state;
  if (ctx.ui?.statusEl) ctx.ui.statusEl.textContent = msg || state;
  ctx.opts.onStatusChange?.({ state, runId: ctx.runId, githubRunId: ctx.githubRunId, message: msg });
}

function setProgress(ui: ReturnType<typeof buildUI>, pct: number) {
  if (ui.progressInner) ui.progressInner.style.width = `${pct}%`;
}

function stateMessage(state: ValidationState): string {
  switch (state) {
    case 'completed-success': return 'Validation completed successfully';
    case 'completed-failure': return 'Validation completed with issues';
    case 'cancelled': return 'Validation cancelled';
    case 'timeout': return 'Validation timed out';
    default: return state;
  }
}

function detailsTemplate(details: any[]): string {
  const failed = details.filter(d => d.status === 'fail');
  const warn = details.filter(d => d.status === 'warn');
  const pass = details.filter(d => d.status === 'pass');
  const section = (title: string, icon: string, arr: any[], color: string) => arr.length ? `
    <details open style="margin:0 0 12px 0; border:1px solid ${color}; border-radius:6px;">
      <summary style="cursor:pointer; padding:8px 12px; font-weight:600; background:rgba(0,0,0,0.03);">${icon} ${title} (${arr.length})</summary>
      <div style="padding:10px 14px; font-size:13px; line-height:1.45;">
        ${arr.map(d => `
          <div style="margin:0 0 12px 0;">
            <div style="font-weight:600;">${escapeHtml(d.category)}</div>
            <div style="margin:4px 0 6px 0;">${escapeHtml(d.message)}</div>
            ${d.issues?.length ? `<ul style=\"margin:4px 0 0 16px; padding:0; list-style:disc;\">${d.issues.map((i:any)=>`<li style=\"margin:2px 0;\">${escapeHtml(i)}</li>`).join('')}</ul>`:''}
          </div>
        `).join('')}
      </div>
    </details>` : '';
  return [
    section('Failed Checks','❌',failed,'#f9d0d0'),
    section('Warnings','⚠️',warn,'#f1e05a'),
    section('Passed Checks','✅',pass,'#34d058')
  ].join('');
}

function summaryTemplate(ctx: InternalContext, state: ValidationState, data: any): string {
  const runLink = data?.runUrl ? `<p><a href="${data.runUrl}" target="_blank" rel="noopener noreferrer">View workflow on GitHub</a></p>` : '';
  // Derive check counts if available
  let counts = '';
  try {
    const details = data?.results?.details;
    if (Array.isArray(details) && details.length) {
      const fail = details.filter((d:any)=>d.status==='fail').length;
      const warn = details.filter((d:any)=>d.status==='warn').length;
      const pass = details.filter((d:any)=>d.status==='pass').length;
      counts = `<div style="margin-top:8px; font-size:12px; line-height:1.4;">Checks: <strong>${pass}</strong> pass • <strong>${warn}</strong> warn • <strong>${fail}</strong> fail</div>`;
    }
  } catch {/* ignore */}
  switch (state) {
    case 'completed-success': return `<strong>Success!</strong> Template passed all checks.${counts}${runLink}`;
    case 'completed-failure': return `<strong>Validation Failed.</strong> Issues detected.${counts}${runLink}`;
    case 'cancelled': return `<strong>Cancelled.</strong> Workflow cancellation requested.${runLink}`;
    case 'timeout': return `<strong>Timeout.</strong> Still running in background? ${runLink}`;
    default: return `<strong>${state}</strong> ${runLink}`;
  }
}

function persistRunMeta(ctx: InternalContext) {
  if (!ctx.runId) return;
  try {
    const meta = { runId: ctx.runId, githubRunId: ctx.githubRunId, ts: Date.now() };
    localStorage.setItem(`validation_${ctx.runId}`, JSON.stringify(meta));
    localStorage.setItem('lastValidationRunInfo', JSON.stringify(meta));
  } catch {/* ignore */}
}

function manualResume(ctx: InternalContext): boolean {
  if (ctx.state !== 'idle') return false;
  try {
    const stored = localStorage.getItem('lastValidationRunInfo');
    if (!stored) return false;
    const info = JSON.parse(stored);
    if (!info?.runId) return false;
    ctx.runId = info.runId;
    ctx.githubRunId = info.githubRunId;
    ctx.pollAttempts = 0;
    transition(ctx, 'running', 'Resuming previous validation run…');
    schedulePoll(ctx, 0);
    return true;
  } catch {
    return false;
  }
}

async function safeResponseText(resp: Response) {
  try { return await resp.text(); } catch { return ''; }
}

function escapeHtml(str: string) {
  return String(str).replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s] as string));
}

// Lightweight logging helper: records to console and (for workflow mode) the live log panel
function log(ctx: InternalContext, message: string) {
  try { console.debug('[validation]', message); } catch { /* ignore */ }
  if (ctx.opts.mode === 'workflow' && ctx.ui?.logsPre) {
    ctx.ui.logsPre.textContent += `[${new Date().toISOString()}] ${message}\n`;
    ctx.ui.logsPre.scrollTop = ctx.ui.logsPre.scrollHeight;
  }
}

// -------------------------------------- Backward Compatibility Exports --------------------------------------
function legacyInitTemplateValidation(containerId: string, templateName: string, apiBase?: string) {
  // apiBase ignored; resolution done internally
  return initValidation({ container: containerId, templateRef: templateName, mode: 'simple' });
}
function legacyRunTemplateValidation(templateName: string, apiBase?: string) {
  const inst = initValidation({ container: 'validation-root', templateRef: templateName, mode: 'simple' });
  inst.start();
  return inst;
}
function legacyInitGithubWorkflowValidation(containerId: string, templateUrl: string, onStatusChange?: (e: any) => void) {
  return initValidation({ container: containerId, templateRef: templateUrl, mode: 'workflow', onStatusChange });
}
function legacyRunGithubWorkflowValidation(templateUrl: string, apiBase?: string, onStatusChange?: (e:any)=>void) {
  const inst = initValidation({ container: 'githubValidationContainer', templateRef: templateUrl, mode: 'workflow', onStatusChange });
  inst.start();
  return inst;
}

(window as any).TemplateValidation = {
  init: legacyInitTemplateValidation,
  run: legacyRunTemplateValidation,
};
(window as any).GitHubWorkflowValidation = {
  init: legacyInitGithubWorkflowValidation,
  run: legacyRunGithubWorkflowValidation,
};
(window as any).initGithubWorkflowValidation = legacyInitGithubWorkflowValidation;
(window as any).runGithubWorkflowValidation = legacyRunGithubWorkflowValidation;

console.debug('[validation] unified validation module loaded');
