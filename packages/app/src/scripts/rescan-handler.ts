// Rescan handler with real backend submission + polling until completion.
(function(){
  const POLL_INTERVAL = 5000; // ms
  const MAX_POLL_MINUTES = 10;
  function debug(...args:any[]){
    if (typeof (window as any).debug === 'function') (window as any).debug('rescan-handler', ...args); else console.log('[RescanHandler]', ...args);
  }
  function getAuthHeaders(){
    const headers: any = { 'Content-Type': 'application/json' };
    try {
      const cfg: any = (window as any).TemplateDoctorConfig || {};
      if (cfg.functionKey) headers['x-functions-key'] = cfg.functionKey;
      const gh = (window as any).GitHubClient?.auth;
      if (gh?.isAuthenticated()) {
        const token = gh.getToken(); if (token) headers['Authorization'] = `Bearer ${token}`;
      }
    } catch(_) {}
    return headers;
  }
  function cacheDynamicReport(repoUrl: string, data: any){
    try {
      const norm = repoUrl.replace(/\.git$/,'').toLowerCase();
      (window as any).__dynamicReports = (window as any).__dynamicReports || {};
      (window as any).__dynamicReports[norm] = data;
      debug('Cached dynamic report', norm);
      document.dispatchEvent(new CustomEvent('report-updated', { detail: { repoUrl, data, dynamic: true } }));
    } catch(err){ console.warn('cacheDynamicReport failed', err); }
  }
  async function submit(repoUrl: string, mode: 'rescan'|'validate'){
    const cfg: any = (window as any).TemplateDoctorConfig || {};
    const base = (cfg.apiBase || window.location.origin).replace(/\/$/,'');
    const body: any = { repoUrl, ruleSet: cfg.defaultRuleSet || 'dod', mode };
    debug('Submitting analysis', body);
    const loading = (window as any).Notifications?.loading?.(mode === 'rescan' ? 'Rescan submitted' : 'Validation submitted', repoUrl);
    try {
      const resp = await fetch(`${base}/v4/analyze-template`, { method:'POST', headers: getAuthHeaders(), body: JSON.stringify(body) });
      if(!resp.ok){
        const txt = await resp.text();
        throw new Error(`HTTP ${resp.status} ${resp.statusText} - ${txt}`);
      }
      const json = await resp.json();
      debug('Initial analyze response', json);
      // Cache immediately for optimistic UI
      cacheDynamicReport(repoUrl, json);
      (window as any).Notifications?.success?.('Analysis started', repoUrl, 3000);
      document.dispatchEvent(new CustomEvent('analysis-submitted', { detail: { repoUrl, request: body, response: json } }));
      pollStatus(repoUrl, json.analysisId || json.id);
    } catch(err:any){
      console.error('[RescanHandler] submission failed', err);
      (window as any).Notifications?.error?.('Analysis Failed', err.message||String(err), 6000);
    } finally { loading?.close && loading.close(); }
  }
  async function pollStatus(repoUrl: string, analysisId?: string){
    if(!analysisId){ debug('No analysisId returned; skipping polling'); return; }
    const cfg: any = (window as any).TemplateDoctorConfig || {};
    const base = (cfg.apiBase || window.location.origin).replace(/\/$/,'');
    const started = Date.now();
    async function tick(){
      const elapsedMin = (Date.now() - started)/60000;
      if (elapsedMin > MAX_POLL_MINUTES){ debug('Polling timeout exceeded'); return; }
      try {
        const url = `${base}/v4/validation-status?analysisId=${encodeURIComponent(analysisId)}`;
        debug('Polling status', url);
        const resp = await fetch(url, { headers: getAuthHeaders() });
        if(!resp.ok) throw new Error(`Status HTTP ${resp.status}`);
        const statusJson = await resp.json();
        debug('Status payload', statusJson.state || statusJson.status || 'unknown');
        document.dispatchEvent(new CustomEvent('analysis-status', { detail: { repoUrl, analysisId, status: statusJson } }));
        if (/completed|succeeded|failed|error/i.test(statusJson.state || statusJson.status || '')){
          // final – assume report payload is embedded or fetchable now.
          if (statusJson.report){ cacheDynamicReport(repoUrl, statusJson.report); }
          (window as any).Notifications?.success?.('Analysis complete', repoUrl, 4000);
          // Auto refresh currently shown report if matches selection
          const selected = (window as any).CurrentSelectedTemplateRepo;
          if (selected && selected.toLowerCase() === repoUrl.toLowerCase()){
            try { (window as any).ReportLoader?.loadReport(repoUrl); } catch(_) {}
          }
          return;
        }
      } catch(err){ debug('Polling error', (err as any)?.message || err); }
      setTimeout(tick, POLL_INTERVAL);
    }
    setTimeout(tick, POLL_INTERVAL);
  }

  document.addEventListener('template-card-rescan', (e: any) => {
    const tmpl = e?.detail?.template; if(!tmpl?.repoUrl) return;
    debug('Rescan requested', tmpl.repoUrl);
    submit(tmpl.repoUrl, 'rescan');
  });
  // Provide global manual trigger for debugging
  (window as any).RescanHandler = { rescan: (r:string)=>submit(r,'rescan'), pollStatus };
})();
export {};
