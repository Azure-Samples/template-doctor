// AZD Provision test and live log streaming
// Decoupled from github-issue-handler.js so issue creation logic stays separate.

/**
 * Test AZD provision for the template
 */
function testAzdProvision() {
  // Make sure we have report data
  if (!window.reportData) {
    console.error('No report data available');
    if (window.Notifications) {
      window.Notifications.error('Error', 'No compliance data available to test AZD provision');
    } else {
      console.error('No compliance data available to test AZD provision');
    }
    return;
  }

  // Show a confirmation dialog
  if (window.Notifications) {
    window.Notifications.confirm(
      'Test AZD Provision',
      'This will trigger the template validation GitHub workflow for this repository. Proceed?',
      {
        onConfirm: () => runAzdProvisionTest(),
      },
    );
  } else {
    if (
      confirm('This will trigger the template validation GitHub workflow for this repository. Proceed?')
    ) {
      runAzdProvisionTest();
    }
  }
}

/**
 * Run the AZD provision test
 */
function runAzdProvisionTest() {
  // Normalize incoming template identifiers to just the repo name (for azd -t)
  function normalizeTemplateToRepo(input) {
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
    name = name.replace(/\.git$/i, '');
    return name;
  }
  // Determine backend base URL via runtime config with safe fallback
  // Align with GitHub workflow validation behavior: use Functions port on localhost
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const configuredBase = (window.TemplateDoctorConfig && window.TemplateDoctorConfig.apiBase)
    ? String(window.TemplateDoctorConfig.apiBase || '').trim()
    : window.location.origin;
  const FORCED_BACKEND_BASE = isLocalhost ? 'http://localhost:7071' : configuredBase;
  // Helper to fetch runtime config (cached)
  function getBasePath() {
    const pathname = window.location.pathname || '/';
    const withoutFile = pathname.match(/\.[a-zA-Z0-9]+$/)
      ? pathname.substring(0, pathname.lastIndexOf('/'))
      : pathname;
    if (withoutFile === '/') return '';
    return withoutFile.endsWith('/') ? withoutFile.slice(0, -1) : withoutFile;
  }
  // No runtime-config fetch: we will use FORCED_BACKEND_BASE directly to avoid 404s
  function joinUrl(base, path, query) {
    const b = (base || '').replace(/\/$/, '');
    const p = (path || '').startsWith('/') ? path : `/${path || ''}`;
    const q = query ? (query.startsWith('?') ? query : `?${query}`) : '';
    return `${b}${p}${q}`;
  }
  // Get the template URL and parse owner/repo
  const templateUrl = window.reportData.repoUrl;
  let owner, repo;
  try {
    const urlParts = new URL(templateUrl).pathname.split('/');
    if (urlParts.length >= 3) {
      owner = urlParts[1];
      repo = urlParts[2];
    }
  } catch (e) {
    console.error('Failed to parse repository URL', e);
  }

  // Prefer upstream template name if provided in report data; otherwise use owner/repo from the report URL
  let templateName = null;
  const upstreamFromReport =
    (window.reportData && (window.reportData.upstreamTemplate || window.reportData.upstream)) || '';
  if (typeof upstreamFromReport === 'string' && upstreamFromReport.includes('/')) {
    templateName = upstreamFromReport.trim();
  } else if (owner && repo) {
    templateName = `${owner}/${repo}`;
  }
  if (!templateName) {
    const msg = '[error] Could not determine template name from repository URL.';
    try {
      appendLog(document.getElementById('azd-provision-logs') || console, msg);
    } catch {
      console.error(msg);
    }
    return;
  }
  // Normalize to repo-only for azd init -t
  const templateRepo = normalizeTemplateToRepo(templateName);

  // Show loading state
  const testProvisionButton = (function() {
    return document.getElementById('testProvisionButton')
      || document.getElementById('testProvisionButton-direct')
      || document.getElementById('testProvisionButton-fallback');
  })();
  let originalText = null;
  const restoreButton = () => {
    if (!testProvisionButton) return;
    // small delay lets last UI updates render before flipping back
    setTimeout(() => {
      testProvisionButton.innerHTML = originalText || 'Test AZD Provision';
      testProvisionButton.style.backgroundColor = '';
      testProvisionButton.disabled = false;
    }, 500);
  };
  if (testProvisionButton) {
    originalText = testProvisionButton.innerHTML;
    testProvisionButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting…';
    testProvisionButton.disabled = true;
  }

  // Create a live log container below the header (simple terminal-style area)
  let logEl = document.getElementById('azd-provision-logs');
  if (!logEl) {
    logEl = document.createElement('pre');
    logEl.id = 'azd-provision-logs';
    logEl.style.cssText =
      'max-height: 300px; overflow:auto; background:#0b0c0c; color:#d0d0d0; padding:20px; border-radius:6px 0 0 6px; font-size:12px; margin:10px 0 50px 0;';
    const header = document.querySelector('.report-actions') || document.body;
    header.parentNode.insertBefore(logEl, header.nextSibling);
    // Add controls row (Stop button)
    const controls = document.createElement('div');
    controls.id = 'azd-provision-controls';
    controls.style.cssText = 'margin:10px 0 6px; display:flex; gap:8px; align-items:center;';
    const stopBtn = document.createElement('button');
    stopBtn.id = 'azd-stop-btn';
    stopBtn.textContent = 'Cancel Validation';
    stopBtn.style.cssText = 'padding:6px 12px; background:#b10e1e; color:#fff; border:none; border-radius:6px; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.15); margin: 0 0 10px 20px';
    stopBtn.disabled = true;
    controls.appendChild(stopBtn);
    logEl.parentNode.insertBefore(controls, logEl);
  } else {
    logEl.textContent = '';
  }
  try {
    const sb = document.getElementById('azd-stop-btn');
    if (sb) {
      const rect = sb.getBoundingClientRect();
      const absY = rect.top + window.scrollY + 200; // target Stop button + 200px offset
      const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const targetY = Math.min(absY, maxY);
      window.scrollTo({ top: targetY, behavior: 'smooth' });
    } else {
      logEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  } catch {}

  const baseUrl =
    window.location.origin +
    (window.location.pathname.includes('/index.html')
      ? window.location.pathname.replace('/index.html', '')
      : window.location.pathname);

  let notification;
  if (window.Notifications) {
    notification = window.Notifications.loading(
      'Starting AZD Provision',
      `Starting provisioning for ${templateRepo} in Azure Container App using Azure CLI image...`,
    );
  }

  // Resolve backend base URL and optional function key from runtime config
  const apiBase = (FORCED_BACKEND_BASE || '').trim();
  if (!apiBase) {
    appendLog(logEl, '[error] Missing backend base URL. Set FORCED_BACKEND_BASE.');
    return;
  }
  console.log('[azd] apiBase:', apiBase);

  // Add debug log to show we're using the latest frontend code
  appendLog(logEl, `[debug] Using updated frontend code with enhanced debugging`);
  appendLog(logEl, `[debug] Template repo: ${templateRepo}, Template name: ${templateName}`);
  // Trigger GitHub workflow via the same endpoint used by Run Analysis
  const validateUrl = joinUrl(apiBase, '/api/validation-template');
  appendLog(logEl, `[info] Triggering validation workflow: ${validateUrl}`);
  console.log('[azd] validationUrl:', validateUrl);
  const templateUrlFull = window.reportData.repoUrl;

  fetch(validateUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      templateUrl: templateUrlFull,
      targetRepoUrl: templateUrlFull
    })
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
      const data = await r.json();
  const { runId = null, githubRunId = null, githubRunUrl = null, requestId = null } = data || {};
      appendLog(logEl, `[info] Validation started. Run ID: ${runId}${requestId ? ` (req ${requestId})` : ''}`);
      if (githubRunId) appendLog(logEl, `[info] GitHub run id: ${githubRunId}`);
      if (githubRunUrl) appendLog(logEl, `[info] GitHub run url: ${githubRunUrl}`);

      // Persist correlation so other views can pick it up
      try {
        localStorage.setItem(`validation_${runId}`, JSON.stringify({ githubRunId: githubRunId || null, githubRunUrl: githubRunUrl || null }));
        localStorage.setItem('lastValidationRunInfo', JSON.stringify({ runId, githubRunId: githubRunId || null, githubRunUrl: githubRunUrl || null }));
      } catch {}

      if (notification) {
        notification.success(
          'Validation Started',
          githubRunUrl ? 'Workflow started. Opening GitHub run in a new tab.' : 'Workflow started. You can monitor status below.'
        );
      }
      // Offer to open the GitHub run if we have a URL
      if (githubRunUrl) {
        try { window.open(githubRunUrl, '_blank'); } catch {}
      }

      // Start a lightweight polling loop to surface status updates in the same log area
      const statusUrlBase = joinUrl(apiBase, '/api/validation-status');
      const stopBtn = document.getElementById('azd-stop-btn');
      // Wire up cancel button for workflow runs
      if (stopBtn) {
        stopBtn.disabled = false;
        stopBtn.onclick = async () => {
          try {
            stopBtn.disabled = true;
            const prev = stopBtn.textContent;
            stopBtn.textContent = 'Cancelling…';
            const cancelUrl = joinUrl(apiBase, '/api/validation-cancel');
            const resp = await fetch(cancelUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ runId, githubRunId, githubRunUrl })
            });
            if (!resp.ok) {
              const t = await resp.text().catch(() => '');
              throw new Error(`Cancel failed: ${resp.status} ${resp.statusText}${t ? ` - ${t.substring(0,200)}` : ''}`);
            }
            const j = await resp.json().catch(() => ({}));
            appendLog(logEl, `[info] Cancellation requested for GitHub run ${j.githubRunId || githubRunId}. Waiting for status to reflect 'cancelled'…`);
          } catch (e) {
            appendLog(logEl, `[error] ${e.message}`);
            stopBtn.disabled = false;
            stopBtn.textContent = 'Cancel Validation';
          }
        };
      }
      const MAX_POLLING_ATTEMPTS = 60; // ~30 minutes at 30s
      let attempts = 0;
      const maxAttempts = MAX_POLLING_ATTEMPTS;

      const pollOnce = async () => {
        attempts++;
        try {
          const u = new URL(statusUrlBase);
          u.searchParams.set('runId', runId);
          u.searchParams.set('includeLogsUrl', '1');
          if (githubRunId) u.searchParams.set('githubRunId', githubRunId);
          const resp = await fetch(u.toString(), { headers: { 'Content-Type': 'application/json' } });
          if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
          const s = await resp.json();
          if (s.status) appendLog(logEl, `[status] ${s.status}${s.conclusion ? ` (${s.conclusion})` : ''}`);
          if (s.logsArchiveUrl && !document.getElementById('gh-logs-link')) {
            const link = document.createElement('a');
            link.id = 'gh-logs-link';
            link.href = s.logsArchiveUrl;
            link.textContent = 'Download workflow logs';
            link.target = '_blank';
            const container = document.getElementById('azd-provision-controls') || logEl.parentNode;
            const wrap = document.createElement('div');
            wrap.style.cssText = 'margin: 8px 0 0 20px;';
            wrap.appendChild(link);
            container.appendChild(wrap);
          }
          if (s.status === 'completed') {
            if (notification) {
              if (s.conclusion === 'success') notification.success('Validation Completed', 'Template passed validation.');
              else notification.error('Validation Completed', 'Template validation completed with issues.');
            }
            // disable cancel and restore the main button
            try {
              const stop = document.getElementById('azd-stop-btn');
              if (stop) stop.disabled = true;
            } catch {}
            restoreButton();
            return true;
          }
        } catch (e) {
          appendLog(logEl, `[warn] Status check failed: ${e.message}`);
        }
        return false;
      };
      const loop = async () => {
        if (attempts === 0) {
          appendLog(logEl, '[info] Monitoring GitHub workflow status…');
        }
        const done = await pollOnce();
        if (!done && attempts < maxAttempts) {
          setTimeout(loop, 30000);
        } else if (!done && attempts >= maxAttempts) {
          appendLog(logEl, '[warn] Timed out waiting for workflow to complete. You can open the GitHub run to check live status.');
          if (notification) {
            try { notification.warning ? notification.warning('Validation Timeout', 'Stopped polling after 30 minutes.') : notification.info('Validation Timeout', 'Stopped polling after 30 minutes.'); } catch {}
          }
          try {
            const stop = document.getElementById('azd-stop-btn');
            if (stop) stop.disabled = true;
          } catch {}
          restoreButton();
        }
      };
      loop();
    })
    .catch((err) => {
      appendLog(logEl, `[error] ${err.message}`);
      if (notification) notification.error('Error', err.message);
      restoreButton();
    });
}

function appendLog(el, line) {
  el.textContent += line.endsWith('\n') ? line : line + '\n';
  el.scrollTop = el.scrollHeight;
  // Also scroll the viewport so the console is fully visible: target Stop button + 200px
  try {
    const sb = document.getElementById('azd-stop-btn');
    if (sb) {
      const rect = sb.getBoundingClientRect();
      const absY = rect.top + window.scrollY + 200; // 200px below the Stop button
      const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const targetY = Math.min(absY, maxY);
      // Only scroll down if the target is below current viewport by a noticeable margin
      const currentBottom = window.scrollY + window.innerHeight;
      if (currentBottom + 40 < targetY) {
        window.scrollTo({ top: targetY, behavior: 'smooth' });
      }
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  } catch {}
}

// Expose globally for button onclick handlers and other scripts
window.testAzdProvision = testAzdProvision;
window.runAzdProvisionTest = runAzdProvisionTest;
window.appendLog = appendLog;
