// Migrated AZD Provision / validation workflow trigger (from legacy js/azd-provision.js)
// Provides: window.testAzdProvision, window.runAzdProvisionTest, window.appendLog
// Also exposes a typed facade at window.AzdProvision

/* eslint-disable @typescript-eslint/no-explicit-any */
interface ValidationStartResponse {
  runId?: string;
  githubRunId?: string;
  githubRunUrl?: string;
  requestId?: string;
}

interface ValidationStatusResponse {
  status?: string;
  conclusion?: string;
  logsArchiveUrl?: string;
  githubRunId?: string;
}

interface TemplateDoctorConfigShape {
  apiBase?: string;
  functionKey?: string;
  analysis?: { useServerSide?: boolean } & Record<string, any>;
  archiveEnabled?: boolean;
  nextAnalysisArchiveEnabledOverride?: boolean;
  archiveCollection?: string;
  dispatchTargetRepo?: string;
  backend?: { apiVersion?: string };
  [k: string]: any;
}

declare global {
  interface Window {
    reportData?: any; // existing loose type retained
    Notifications?: any;
    NotificationSystem?: any;
    // Widen existing declaration (elsewhere may be 'any'); keep shape via JSDoc
    /** @type {TemplateDoctorConfigShape} */
    TemplateDoctorConfig?: any;
  ApiRoutes?: { build: (name: string) => string }; // align with existing declaration
    GitHubClient?: any; // widen to avoid redeclaration conflicts
    testAzdProvision?: () => void;
    runAzdProvisionTest?: () => void;
    appendLog?: (el: HTMLElement | Console, line: string) => void;
    AzdProvision?: {
      test: () => void;
      run: () => void;
      appendLog: (el: HTMLElement | Console, line: string) => void;
    };
  }
}

// Utility: append a line to log element and auto-scroll viewport near Stop button
function appendLog(el: HTMLElement | Console, line: string) {
  try {
    if (el instanceof HTMLElement) {
      el.textContent += line.endsWith('\n') ? line : line + '\n';
      el.scrollTop = el.scrollHeight;
    } else if (el && typeof (el as any).log === 'function') {
      (el as any).log(line);
    }
  } catch {
    // noop
  }
  try {
    const sb = document.getElementById('azd-stop-btn');
    if (sb) {
      const rect = sb.getBoundingClientRect();
      const absY = rect.top + window.scrollY + 200;
      const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const targetY = Math.min(absY, maxY);
      const currentBottom = window.scrollY + window.innerHeight;
      if (currentBottom + 40 < targetY) {
        window.scrollTo({ top: targetY, behavior: 'smooth' });
      }
    }
  } catch {}
}

function confirmAction(message: string, onConfirm: () => void) {
  if (window.Notifications && window.Notifications.confirm) {
    try {
      window.Notifications.confirm('Test AZD Provision', message, { onConfirm });
      return;
    } catch {}
  }
  if (confirm(message)) onConfirm();
}

function testAzdProvision() {
  if (!window.reportData) {
    if (window.Notifications) {
      window.Notifications.error('Error', 'No compliance data available to test AZD provision');
    } else {
      console.error('No compliance data available to test AZD provision');
    }
    return;
  }
  confirmAction(
    'This will trigger the template validation GitHub workflow for this repository. Proceed?',
    () => runAzdProvisionTest(),
  );
}

function normalizeTemplateToRepo(input: string): string {
  if (!input || typeof input !== 'string') return '';
  let name = input.trim();
  try {
    if (name.startsWith('http://') || name.startsWith('https://') || name.startsWith('git@')) {
      if (name.startsWith('git@')) {
        const parts = name.split(':');
        if (parts.length > 1) name = parts[1];
      } else {
        const url = new URL(name);
        name = url.pathname;
      }
    }
  } catch {}
  name = name.replace(/^\/+/, '');
  const segments = name.split('/').filter(Boolean);
  name = segments.length ? segments[segments.length - 1] : name;
  return name.replace(/\.git$/i, '');
}

function computeApiBase(cfg: TemplateDoctorConfigShape): string {
  const isLocalhost =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const configuredBase = cfg && cfg.apiBase ? String(cfg.apiBase || '').trim() : window.location.origin;
  return isLocalhost ? 'http://localhost:7071' : configuredBase;
}

function runAzdProvisionTest() {
  const cfg = (window.TemplateDoctorConfig = window.TemplateDoctorConfig || {});
  const apiBase = computeApiBase(cfg).replace(/\/$/, '');
  const report = window.reportData || {};
  const templateUrl: string = report.repoUrl || '';
  let owner: string | undefined, repo: string | undefined;
  try {
    const urlParts = new URL(templateUrl).pathname.split('/');
    if (urlParts.length >= 3) {
      owner = urlParts[1];
      repo = urlParts[2];
    }
  } catch {}

  const upstream = (report.upstreamTemplate || report.upstream || '') as string;
  let templateName: string | null = null;
  if (typeof upstream === 'string' && upstream.includes('/')) templateName = upstream.trim();
  else if (owner && repo) templateName = `${owner}/${repo}`;
  if (!templateName) {
    appendLog(document.getElementById('azd-provision-logs') || console, '[error] Cannot determine template name.');
    return;
  }
  const templateRepo = normalizeTemplateToRepo(templateName);

  const testProvisionButton = ((): HTMLElement | null =>
    document.getElementById('testProvisionButton') ||
    document.getElementById('testProvisionButton-direct') ||
    document.getElementById('testProvisionButton-fallback'))();
  let originalText: string | null = null;
  const restoreButton = () => {
    if (!testProvisionButton) return;
    setTimeout(() => {
      testProvisionButton.innerHTML = originalText || 'Test AZD Provision';
      (testProvisionButton as HTMLButtonElement).disabled = false;
      testProvisionButton.style.backgroundColor = '';
    }, 500);
  };
  if (testProvisionButton) {
    originalText = testProvisionButton.innerHTML;
    testProvisionButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting…';
    (testProvisionButton as HTMLButtonElement).disabled = true;
  }

  // Log container setup
  let logEl = document.getElementById('azd-provision-logs');
  if (!logEl) {
    logEl = document.createElement('pre');
    logEl.id = 'azd-provision-logs';
    logEl.style.cssText =
      'max-height:300px;overflow:auto;background:#0b0c0c;color:#d0d0d0;padding:20px;border-radius:6px 0 0 6px;font-size:12px;margin:10px 0 50px 0;';
    const header = document.querySelector('.report-actions') || document.body;
    (header.parentNode || document.body).insertBefore(logEl, header.nextSibling);
    const controls = document.createElement('div');
    controls.id = 'azd-provision-controls';
    controls.style.cssText = 'margin:10px 0 6px;display:flex;gap:8px;align-items:center;';
    const stopBtn = document.createElement('button');
    stopBtn.id = 'azd-stop-btn';
    stopBtn.textContent = 'Cancel Validation';
    stopBtn.style.cssText =
      'padding:6px 12px;background:#b10e1e;color:#fff;border:none;border-radius:6px;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,0.15);margin:0 0 10px 20px';
    stopBtn.disabled = true;
    controls.appendChild(stopBtn);
    (logEl.parentNode as Node).insertBefore(controls, logEl);
  } else {
    logEl.textContent = '';
  }
  try {
    const sb = document.getElementById('azd-stop-btn');
    if (sb) {
      const rect = sb.getBoundingClientRect();
      const absY = rect.top + window.scrollY + 200;
      const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      window.scrollTo({ top: Math.min(absY, maxY), behavior: 'smooth' });
    } else {
      logEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  } catch {}

  const notification =
    window.Notifications && window.Notifications.loading
      ? window.Notifications.loading(
          'Starting AZD Provision',
          `Starting provisioning for ${templateRepo} in Azure Container App using Azure CLI image...`,
        )
      : null;

  if (!apiBase) {
    appendLog(logEl, '[error] Missing backend base URL.');
    return;
  }
  appendLog(logEl, `[debug] Template repo: ${templateRepo}, Template name: ${templateName}`);

  const validateUrl = window.ApiRoutes
    ? window.ApiRoutes.build('validation-template')
    : `${apiBase}/api/v4/validation-template`;
  appendLog(logEl, `[info] Triggering validation workflow: ${validateUrl}`);

  const payload = {
    templateUrl: report.repoUrl,
    targetRepoUrl: report.repoUrl,
  };

  fetch(validateUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(async (r) => {
      if (!r.ok) {
        let detail = '';
        try {
          const ct = r.headers.get('content-type') || '';
            if (ct.includes('application/json')) {
              const j = await r.json();
              detail = j && (j.error || j.message) ? ` - ${j.error || j.message}` : '';
            } else {
              const t = await r.text();
              detail = t ? ` - ${t.substring(0, 200)}` : '';
            }
        } catch {}
        throw new Error(`Validation start failed: ${r.status}${detail}`);
      }
      const data: ValidationStartResponse = await r.json();
      const { runId = null, githubRunId = null, githubRunUrl = null, requestId = null } = data || {};
      appendLog(logEl, `[info] Validation started. Run ID: ${runId}${requestId ? ` (req ${requestId})` : ''}`);
      if (githubRunId) appendLog(logEl, `[info] GitHub run id: ${githubRunId}`);
      if (githubRunUrl) appendLog(logEl, `[info] GitHub run url: ${githubRunUrl}`);
      try {
        localStorage.setItem(
          `validation_${runId}`,
          JSON.stringify({ githubRunId: githubRunId || null, githubRunUrl: githubRunUrl || null }),
        );
        localStorage.setItem(
          'lastValidationRunInfo',
          JSON.stringify({ runId, githubRunId: githubRunId || null, githubRunUrl: githubRunUrl || null }),
        );
      } catch {}
      if (notification) {
        notification.success(
          'Validation Started',
          githubRunUrl ? 'Workflow started. Opening GitHub run in a new tab.' : 'Workflow started. You can monitor status below.',
        );
      }
      if (githubRunUrl) {
        try { window.open(githubRunUrl, '_blank'); } catch {}
      }

      const statusUrlBase = window.ApiRoutes
        ? window.ApiRoutes.build('validation-status')
        : `${apiBase}/api/v4/validation-status`;

      const stopBtn = document.getElementById('azd-stop-btn') as HTMLButtonElement | null;
      if (stopBtn) {
        stopBtn.disabled = false;
        stopBtn.onclick = async () => {
          try {
            stopBtn.disabled = true;
            const prev = stopBtn.textContent;
            stopBtn.textContent = 'Cancelling…';
            const cancelUrl = window.ApiRoutes
              ? window.ApiRoutes.build('validation-cancel')
              : `${apiBase}/api/v4/validation-cancel`;
            const resp = await fetch(cancelUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ runId, githubRunId, githubRunUrl }),
            });
            if (!resp.ok) {
              const t = await resp.text().catch(() => '');
              throw new Error(`Cancel failed: ${resp.status} ${resp.statusText}${t ? ` - ${t.substring(0, 200)}` : ''}`);
            }
            const j = await resp.json().catch(() => ({}));
            appendLog(logEl!, `[info] Cancellation requested for GitHub run ${j.githubRunId || githubRunId}`);
          } catch (e: any) {
            appendLog(logEl!, `[error] ${e.message}`);
            stopBtn.disabled = false;
            stopBtn.textContent = 'Cancel Validation';
          }
        };
      }

      const MAX_POLLING_ATTEMPTS = 60; // ~30 minutes
      let attempts = 0;

      const pollOnce = async (): Promise<boolean> => {
        attempts++;
        try {
          const u = new URL(statusUrlBase);
          if (runId) u.searchParams.set('runId', String(runId));
          u.searchParams.set('includeLogsUrl', '1');
          if (githubRunId) u.searchParams.set('githubRunId', String(githubRunId));
          const resp = await fetch(u.toString(), { headers: { 'Content-Type': 'application/json' } });
          if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
          const s: ValidationStatusResponse = await resp.json();
          if (s.status) appendLog(logEl!, `[status] ${s.status}${s.conclusion ? ` (${s.conclusion})` : ''}`);
          if (s.logsArchiveUrl && !document.getElementById('gh-logs-link')) {
            const link = document.createElement('a');
            link.id = 'gh-logs-link';
            link.href = s.logsArchiveUrl;
            link.textContent = 'Download workflow logs';
            link.target = '_blank';
            const container = document.getElementById('azd-provision-controls') || logEl!.parentNode;
            const wrap = document.createElement('div');
            wrap.style.cssText = 'margin:8px 0 0 20px;';
            wrap.appendChild(link);
            container?.appendChild(wrap);
          }
          if (s.status === 'completed') {
            if (notification) {
              if (s.conclusion === 'success') notification.success('Validation Completed', 'Template passed validation.');
              else notification.error('Validation Completed', 'Template validation completed with issues.');
            }
            try { if (stopBtn) stopBtn.disabled = true; } catch {}
            restoreButton();
            return true;
          }
        } catch (e: any) {
          appendLog(logEl!, `[warn] Status check failed: ${e.message}`);
        }
        return false;
      };

      const loop = async () => {
        if (attempts === 0) appendLog(logEl!, '[info] Monitoring GitHub workflow status…');
        const done = await pollOnce();
        if (!done && attempts < MAX_POLLING_ATTEMPTS) setTimeout(loop, 30000);
        else if (!done) {
          appendLog(logEl!, '[warn] Timed out waiting for workflow to complete.');
          if (notification) {
            try {
              notification.warning
                ? notification.warning('Validation Timeout', 'Stopped polling after 30 minutes.')
                : notification.info('Validation Timeout', 'Stopped polling after 30 minutes.');
            } catch {}
          }
          try { if (stopBtn) stopBtn.disabled = true; } catch {}
          restoreButton();
        }
      };
      loop();
    })
    .catch((err: any) => {
      appendLog(logEl!, `[error] ${err.message}`);
      if (notification) notification.error('Error', err.message);
      restoreButton();
    });
}

// Expose globals for backward compatibility
window.appendLog = appendLog;
window.runAzdProvisionTest = runAzdProvisionTest;
window.testAzdProvision = testAzdProvision;
window.AzdProvision = { test: testAzdProvision, run: runAzdProvisionTest, appendLog };

console.debug('[azd-provision] TypeScript module loaded');
