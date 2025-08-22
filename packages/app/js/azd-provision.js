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
      'This will clone the template repository in an Azure Container and analyze it. Proceed?',
      {
        onConfirm: () => runAzdProvisionTest(),
      },
    );
  } else {
    if (
      confirm(
        'This will clone the template repository in an Azure Container and analyze it. Proceed?',
      )
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
  const FORCED_BACKEND_BASE = (window.TemplateDoctorConfig && window.TemplateDoctorConfig.apiBase)
    ? String(window.TemplateDoctorConfig.apiBase || '').trim()
    : window.location.origin;
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
  const upstreamFromReport = (window.reportData && (window.reportData.upstreamTemplate || window.reportData.upstream)) || '';
  if (typeof upstreamFromReport === 'string' && upstreamFromReport.includes('/')) {
    templateName = upstreamFromReport.trim();
  } else if (owner && repo) {
    templateName = `${owner}/${repo}`;
  }
  if (!templateName) {
    const msg = '[error] Could not determine template name from repository URL.';
    try { appendLog(document.getElementById('azd-provision-logs') || console, msg); } catch { console.error(msg); }
    return;
  }
  // Normalize to repo-only for azd init -t
  const templateRepo = normalizeTemplateToRepo(templateName);

  // Show loading state
  const testProvisionButton = document.getElementById('testProvisionButton');
  if (testProvisionButton) {
    const originalText = testProvisionButton.innerHTML;
    testProvisionButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting…';
    testProvisionButton.disabled = true;

    // Function to restore button
    const restoreButton = () => {
      setTimeout(() => {
        testProvisionButton.innerHTML = originalText;
        testProvisionButton.style.backgroundColor = '';
        testProvisionButton.disabled = false;
      }, 3000);
    };
  }

  // Create a live log container below the header (simple terminal-style area)
  let logEl = document.getElementById('azd-provision-logs');
  if (!logEl) {
    logEl = document.createElement('pre');
    logEl.id = 'azd-provision-logs';
    logEl.style.cssText = 'max-height: 300px; overflow:auto; background:#0b0c0c; color:#d0d0d0; padding:20px; border-radius:6px 0 0 6px; font-size:12px; margin:10px 0 50px 0;';
    const header = document.querySelector('.report-actions') || document.body;
    header.parentNode.insertBefore(logEl, header.nextSibling);
    // Add controls row (Stop button)
    const controls = document.createElement('div');
    controls.id = 'azd-provision-controls';
    controls.style.cssText = 'margin:10px 0 6px; display:flex; gap:8px; align-items:center;';
    const stopBtn = document.createElement('button');
    stopBtn.id = 'azd-stop-btn';
    stopBtn.textContent = 'Stop Provision';
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

  const baseUrl = window.location.origin + (window.location.pathname.includes('/index.html') ? window.location.pathname.replace('/index.html','') : window.location.pathname);

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
  // Kick off ACA Job via Function (public routes, now with /aca prefix)
  const startUrl = joinUrl(apiBase, '/api/aca-start-job');
  appendLog(logEl, `[info] Calling start URL: ${startUrl}`);
  console.log('[azd] startUrl:', startUrl);
  appendLog(logEl, `[info] Requested template: ${templateRepo} (server will normalize)`);
  fetch(startUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          templateName: templateRepo,
          mode: "list", // Force list mode which only clones and doesn't run azd commands
          action: "list", // Force list action
          jobName: "template-doctor-aca-job-app" // Explicitly request the app-runner job
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
        throw new Error(`Start failed: ${r.status}${detail}`);
      }
      const json = await r.json();
      const { executionName } = json;
      appendLog(logEl, `[info] Job started: ${executionName}`);
      if (json.templateUsed) {
        appendLog(logEl, `[info] Template used: ${json.templateUsed}`);
      }
      // Open SSE stream with polling fallback and Stop button support
      const streamPath = `/api/aca-job-logs/${encodeURIComponent(executionName)}`;
      const streamUrl = joinUrl(apiBase, streamPath);
      appendLog(logEl, `[info] Connecting logs stream: ${streamUrl}`);
      console.log('[azd] streamUrl:', streamUrl);
      const stopBtn = document.getElementById('azd-stop-btn');
  let ev;
      let pollTimer;
      let pollSince = '';
      let finished = false;
  let currentExecution = executionName;

      function finalize(result) {
        finished = true;
        if (ev) try { ev.close(); } catch {}
        if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
        if (stopBtn) stopBtn.disabled = true;
        if (!notification) return;
        if (result && result.succeeded) {
          notification.success('Provision Completed', 'azd completed successfully');
        } else if (result && result.status) {
          notification.error('Provision Failed', `Status: ${result.status}`);
        }
      }

      function startPolling() {
        const doPoll = async () => {
          if (finished) return;
          try {
            // Construct polling URL with mode=poll as a query parameter
            const url = streamUrl + `?mode=poll${pollSince ? `&since=${encodeURIComponent(pollSince)}` : ''}`;
            appendLog(logEl, `[debug] Polling full URL: ${url}`);
            console.log('[detailed-debug] Polling full URL:', url);
            const pr = await fetch(url, { headers: { Accept: 'application/json' } });
            if (!pr.ok) throw new Error(`poll ${pr.status}`);
            const data = await pr.json();
            
            // Debug raw response
            console.log('[debug] Poll response:', data);
            
            if (Array.isArray(data.messages)) {
              appendLog(logEl, `[debug] Received ${data.messages.length} messages`);
              data.messages.forEach((m) => appendLog(logEl, m));
            }
            if (data.nextSince) pollSince = data.nextSince;
            if (data.status) {
              const det = data.details || {};
              const extras = [];
              if (det.provisioningState) extras.push(`prov=${det.provisioningState}`);
              if (det.status) extras.push(`status=${det.status}`);
              if (typeof det.exitCode !== 'undefined' && det.exitCode !== null) extras.push(`exit=${det.exitCode}`);
              appendLog(logEl, `[status] ${data.status}${extras.length ? ' (' + extras.join(', ') + ')' : ''}`);
            }
            if (data.done) return finalize({ succeeded: data.status === 'Succeeded', status: data.status });
          } catch (e) {
            appendLog(logEl, `[error] poll: ${e.message}`);
          } finally {
            if (!finished) pollTimer = setTimeout(doPoll, 3000);
          }
        };
        doPoll();
      }

      function trySSE() {
        try {
          ev = new EventSource(streamUrl);
        } catch (e) {
          appendLog(logEl, `[warn] SSE unavailable, falling back to polling`);
          return startPolling();
        }
        ev.addEventListener('open', () => { if (stopBtn) stopBtn.disabled = false; });
        ev.addEventListener('status', (e) => {
          try {
            const d = JSON.parse(e.data);
            if (d && typeof d === 'object') {
              const det = d.details || {};
              const extras = [];
              if (det.provisioningState) extras.push(`prov=${det.provisioningState}`);
              if (det.status) extras.push(`status=${det.status}`);
              if (typeof det.exitCode !== 'undefined' && det.exitCode !== null) extras.push(`exit=${det.exitCode}`);
              appendLog(
                logEl,
                `[status] ${d.state}${extras.length ? ' (' + extras.join(', ') + ')' : ''}`,
              );
            } else {
              appendLog(logEl, `[status] ${d}`);
            }
          } catch {}
        });
        ev.addEventListener('message', (e) => { appendLog(logEl, e.data); });
        ev.addEventListener('error', () => {
          if (!finished) {
            appendLog(logEl, `[warn] Stream error, switching to polling`);
            try { ev.close(); } catch {}
            startPolling();
          }
        });
        ev.addEventListener('complete', (e) => {
          try {
            const d = JSON.parse(e.data);
            if (d && d.details) {
              const { startTime, endTime, exitCode } = d.details;
              if (startTime && endTime) {
                const st = new Date(startTime);
                const et = new Date(endTime);
                const durMs = Math.max(0, et - st);
                const mins = Math.floor(durMs / 60000);
                const secs = Math.floor((durMs % 60000) / 1000);
                appendLog(logEl, `[summary] ${d.status} in ${mins}m ${secs}s${typeof exitCode === 'number' ? ` (exit=${exitCode})` : ''}`);
              }
            }
            finalize(d);
          } catch {
            finalize({ succeeded: false, status: 'Unknown' });
          }
        });
      }

      // Wire Stop button
      if (stopBtn) {
        stopBtn.disabled = false;
        stopBtn.onclick = () => {
          appendLog(logEl, '[info] Stopping…');
          // Best-effort: ask backend to stop the job execution
          try {
            const stopUrl = joinUrl(apiBase, '/api/aca-stop-job');
            // Add additional debug for the container app job name prefix
            const containerAppJobName = 'template-doctor-aca-job'; // Hardcoded job name
            const jobExecutionName = `${containerAppJobName}-${currentExecution}`;
            
            appendLog(logEl, `[debug] Attempting to stop job with full execution name: ${jobExecutionName}`);
            appendLog(logEl, `[debug] Falling back to short execution name if that fails: ${currentExecution}`);
            
            // First try with the fully qualified name
            fetch(stopUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                executionName: jobExecutionName,
                originalExecutionName: currentExecution,
                resourceGroup: 'template-doctor-rg' 
              })
            }).then(async (r) => {
              if (!r.ok) {
                let msg = '';
                try { const j = await r.json(); msg = j.error || ''; } catch {}
                appendLog(logEl, `[warn] Stop request failed with full name: ${r.status}${msg ? ' - ' + msg : ''}`);
                
                // Fall back to the short name
                return fetch(stopUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    executionName: currentExecution,
                    resourceGroup: 'template-doctor-rg' 
                  })
                });
              } else {
                appendLog(logEl, '[info] Stop requested successfully with full execution name');
                return { ok: true };
              }
            }).then(async (r) => {
              if (r && !r.ok) {
                let msg = '';
                try { const j = await r.json(); msg = j.error || ''; } catch {}
                appendLog(logEl, `[warn] Stop request failed with short name: ${r.status}${msg ? ' - ' + msg : ''}`);
                appendLog(logEl, `[warn] Both stop attempts failed. The container job may need to be stopped manually.`);
              } else if (r && r.ok && r !== true) {
                appendLog(logEl, '[info] Stop requested successfully with short execution name');
              }
            }).catch((error) => {
              appendLog(logEl, `[error] Stop request error: ${error.message || error}`);
            });
          } catch (error) {
            appendLog(logEl, `[error] Error attempting to stop job: ${error.message || error}`);
          }
          finalize({ succeeded: false, status: 'Stopped' });
        };
      }

      // Skip SSE and go straight to polling since SSE consistently fails
      // trySSE();
      startPolling();
  })
  .catch((err) => {
      appendLog(logEl, `[error] ${err.message}`);
      if (notification) notification.error('Error', err.message);
  });
}

function appendLog(el, line) {
  el.textContent += (line.endsWith('\n') ? line : line + '\n');
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