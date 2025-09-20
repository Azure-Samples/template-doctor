// Control visibility of results via runtime config
(function() {
  console.log('###############[index-data] Loading template data, authentication check:',
              window.GitHubAuth ? 'GitHubAuth exists' : 'GitHubAuth missing',
              window.GitHubAuth?.isAuthenticated ? 'Auth method exists' : 'Auth method missing',
              window.GitHubAuth?.isAuthenticated ? 'Auth state: ' + window.GitHubAuth.isAuthenticated() : 'Cannot check auth state');
  // Seed removed: dynamic meta files now provide entries. If nothing loads yet, initialize empty array.
  if (!Array.isArray(window.templatesData)) window.templatesData = [];
  
  const cfg = window.TemplateDoctorConfig || {};
  // Default was 'true' which hid results when GitHub auth not yet established; flipping to false to improve initial UX.
  const requireAuth = typeof cfg.requireAuthForResults === 'boolean' ? cfg.requireAuthForResults : false;
  const isAuthed = !!(window.GitHubAuth && window.GitHubAuth.isAuthenticated && window.GitHubAuth.isAuthenticated());

  // Auth gate flag (UI may choose to hide when deferred)

  if (requireAuth && !isAuthed) {
    console.log('[index-data] Auth required but user not authenticated – leaving templatesData populated (UI may hide it).');
    window.__TEMPLATE_RESULTS_DEFERRED = true;
  } else {
    window.__TEMPLATE_RESULTS_DEFERRED = false;
  }
  console.log('[index-data] Template data loaded (non-destructive). Entries:', window.templatesData.length, 'authRequired:', requireAuth, 'isAuthed:', isAuthed);

  // --- Dynamic aggregation extension (conflict-free scan ingestion) ---
  // New model: Each scan can drop a small meta file that pushes an object into window.__TD_DYNAMIC_RESULTS.
  // Example (results/<repo-slug>/scan-meta-<ts>.js):
  //   window.__TD_DYNAMIC_RESULTS = window.__TD_DYNAMIC_RESULTS || [];
  //   window.__TD_DYNAMIC_RESULTS.push({ timestamp: '...', repoUrl: '...', dashboardPath: '...', dataPath: '...', ruleSet: 'dod', compliance: { percentage: 50, issues: 10, passed: 15 }, relativePath: '<folder>/<dashboard>' });
  // This avoids concurrent PR merge conflicts because no central index file needs modifying.
  try {
    if (Array.isArray(window.__TD_DYNAMIC_RESULTS) && window.__TD_DYNAMIC_RESULTS.length) {
      const existingKeys = new Set(
        (window.templatesData || []).map(e => `${e.repoUrl}::${e.dashboardPath}`)
      );
      const toAdd = window.__TD_DYNAMIC_RESULTS.filter(e => e && !existingKeys.has(`${e.repoUrl}::${e.dashboardPath}`));
      if (toAdd.length) {
        window.templatesData.push(...toAdd);
        console.log(`[index-data] Merged ${toAdd.length} dynamic scan entries (total now ${window.templatesData.length}).`);
      }
    }
  } catch (e) {
    console.warn('[index-data] Failed merging dynamic results:', e);
  }

  // Hard fallback: if nothing loaded dynamically, embed a static snapshot so the UI isn't empty.
  if ((window.__TD_DYNAMIC_RESULTS == null || window.__TD_DYNAMIC_RESULTS.length === 0) && window.templatesData.length === 0) {
    console.warn('[index-data] Dynamic meta files appear to have NOT loaded (dynamicCount=0). Using embedded fallback meta.');
    const fallbackMeta = [
      {"timestamp":"2025-09-01T12:54:12.843Z","repoUrl":"https://github.com/anfibiacreativa/rag-postgres-openai-python","ruleSet":"dod","dashboardPath":"1756731277912-dashboard.html","dataPath":"1756731277912-data.js","compliance":{"percentage":19,"issues":0,"passed":0},"relativePath":"anfibiacreativa-rag-postgres-openai-python/1756731277912-dashboard.html"},
      {"timestamp":"2025-07-25T10:14:02.435Z","repoUrl":"https://github.com/anfibiacreativa/get-started-with-ai-agents","ruleSet":"partner","dashboardPath":"1753438442443-dashboard.html","dataPath":"1753438442443-data.js","compliance":{"percentage":56,"issues":19,"passed":24},"relativePath":"anfibiacreativa-get-started-with-ai-agents/1753438442443-dashboard.html"},
      {"timestamp":"2025-07-25T08:38:45.913Z","repoUrl":"https://github.com/anfibiacreativa/openai-langchainjs","ruleSet":"partner","dashboardPath":"1753432725919-dashboard.html","dataPath":"1753432725919-data.js","compliance":{"percentage":60,"issues":6,"passed":9},"relativePath":"anfibiacreativa-openai-langchainjs/1753432725919-dashboard.html"},
      {"timestamp":"2025-07-24T19:00:06.379Z","repoUrl":"https://github.com/anfibiacreativa/todo-csharp-sql-swa-func","ruleSet":"dod","dashboardPath":"1753383606390-dashboard.html","dataPath":"1753383606390-data.js","compliance":{"percentage":51,"issues":40,"passed":41},"relativePath":"anfibiacreativa-todo-csharp-sql-swa-func/1753383606390-dashboard.html"},
      {"timestamp":"2025-07-24T16:34:48.932Z","repoUrl":"https://github.com/anfibiacreativa/todo-nodejs-mongo-coreconf","ruleSet":"dod","dashboardPath":"1753374888936-dashboard.html","dataPath":"1753374888936-data.js","compliance":{"percentage":52,"issues":12,"passed":13},"relativePath":"anfibiacreativa-todo-nodejs-mongo-coreconf/1753374888936-dashboard.html"},
      {"timestamp":"2025-07-25T06:06:06.910Z","repoUrl":"https://github.com/anfibiacreativa/todo-nodejs-mongo-swa","ruleSet":"dod","dashboardPath":"1753423566922-dashboard.html","dataPath":"1753423566922-data.js","compliance":{"percentage":52,"issues":16,"passed":17},"relativePath":"anfibiacreativa-todo-nodejs-mongo-swa/1753423566922-dashboard.html"}
    ];
    window.templatesData.push(...fallbackMeta);
    window.__TD_FALLBACK_EMBEDDED = true;
    
    // Try to dynamically inject the script that should have loaded automatically
    try {
      if (typeof document !== 'undefined') {
        const dynamicScript = document.createElement('script');
        dynamicScript.src = '/results/scan-meta-backfill.js';
        dynamicScript.onload = function() {
          console.log('[index-data] Dynamically injected scan-meta-backfill.js loaded successfully');
          // Try to merge again after loaded
          if (Array.isArray(window.__TD_DYNAMIC_RESULTS) && window.__TD_DYNAMIC_RESULTS.length) {
            console.log('[index-data] Dynamic script loaded entries:', window.__TD_DYNAMIC_RESULTS.length);
            const banner = document.getElementById('td-fallback-banner');
            if (banner) {
              banner.style.background = '#dff6dd';
              banner.style.color = '#107c10';
              banner.style.borderColor = '#107c10';
              banner.textContent = 'Dynamic load succeeded after injection! Refresh page to use dynamic data only.';
            }
          }
        };
        dynamicScript.onerror = function() {
          console.error('[index-data] Failed to dynamically load scan-meta-backfill.js - fallback will remain');
        };
        document.head.appendChild(dynamicScript);
        console.log('[index-data] Attempted dynamic script injection for scan-meta-backfill.js');
      }
    } catch(e) {
      console.error('[index-data] Error during dynamic script injection:', e);
    }
  }

  // --- Inline immediate diagnostics & fallback renderer (keeps things dead simple) ---
  try {
    const diag = {
      dynamicCount: (window.__TD_DYNAMIC_RESULTS||[]).length,
      templatesCount: window.templatesData.length,
      deferred: !!window.__TEMPLATE_RESULTS_DEFERRED,
      validatedFlag: !!window.__TD_META_VALIDATED,
      keys: window.templatesData.map(e=> e.repoUrl+"::"+e.dashboardPath)
    };
    console.log('[index-data][diagnostics]', diag);
  } catch(_) {}

  // Fallback: if index-render.js not present, attempt basic rendering directly.
  if (!window.__TD_INDEX_RENDER_ATTEMPTED) {
    window.__TD_INDEX_RENDER_ATTEMPTED = true;
    function basicRender(){
      const grid = document.getElementById('templates-container');
      if (!grid) return; // Not on index page.
      if (!Array.isArray(window.templatesData) || window.templatesData.length === 0) return;
      if (window.__TD_FALLBACK_EMBEDDED) {
        let banner = document.getElementById('td-fallback-banner');
        if (!banner) {
          banner = document.createElement('div');
          banner.id = 'td-fallback-banner';
          banner.style.cssText = 'background:#ffe08a;color:#512c00;padding:8px 12px;margin:4px 0 12px;border:1px solid #d19400;border-radius:4px;font-size:12px;font-family:monospace;';
          banner.textContent = 'Fallback meta used (dynamic scan-meta files not loaded). Ensure scan-meta-backfill.js is present and not blocked.';
          grid.parentElement.insertBefore(banner, grid);
        }
      }
      const empty = document.getElementById('empty-state');
      if (empty) empty.style.display='none';
      grid.querySelectorAll('.template-card.__auto').forEach(n=>n.remove());
      window.templatesData.forEach(t => {
        const p = (t.compliance && typeof t.compliance.percentage==='number') ? t.compliance.percentage : 0;
        const issues = t.compliance?.issues ?? 0;
        const passed = t.compliance?.passed ?? 0;
        const repoMatch = t.repoUrl && t.repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
        const repoName = repoMatch ? repoMatch[1]+'/'+repoMatch[2] : t.repoUrl;
        const ruleSet = t.ruleSet || 'dod';
        const ruleBadge = ruleSet.charAt(0).toUpperCase()+ruleSet.slice(1);
        const cls = p>=80?'high':(p>=50?'medium':'low');
        const card = document.createElement('div');
        card.className = 'template-card __auto';
        card.innerHTML = `\n<div class="template-header">\n  <div class="template-name">${repoName}</div>\n  <div class="template-url" title="${t.repoUrl}">${t.repoUrl}</div>\n</div>\n<div>\n  <div style="display:flex;justify-content:space-between;">\n    <div>Compliance <span class="rule-set-badge rule-${ruleSet}">${ruleBadge}</span>:</div>\n    <div><strong>${p}%</strong></div>\n  </div>\n  <div class="gauge"><div class="gauge-fill ${cls}" style="width:${p}%"></div></div>\n</div>\n<div class="template-stats">\n  <div class="stat-item"><div class="stat-value">${issues}</div><div class="stat-label">Issues</div></div>\n  <div class="stat-item"><div class="stat-value">${passed}</div><div class="stat-label">Passed</div></div>\n</div>\n<a href="${t.relativePath}" class="btn"><i class="fas fa-chart-bar"></i> View Report</a>\n<div class="template-timestamp"><i class="far fa-clock"></i> ${t.timestamp}</div>`;
        grid.appendChild(card);
      });
      console.log('[index-data] Basic inline render complete (cards:', window.templatesData.length, ')');
    }
    // Delay a tick to allow DOM of index page to exist.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', basicRender);
    } else {
      setTimeout(basicRender, 0);
    }
  }
})();
