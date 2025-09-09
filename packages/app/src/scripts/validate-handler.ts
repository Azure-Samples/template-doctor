// Validation handler with submission + status polling (shares logic with rescan handler but separate for clarity)
(function(){
  const POLL_INTERVAL = 5000;
  const MAX_POLL_MINUTES = 10;
  function debug(...args:any[]){ if (typeof (window as any).debug === 'function') (window as any).debug('validate-handler', ...args); else console.log('[ValidateHandler]', ...args); }
  function getAuthHeaders(){
    const headers: any = { 'Content-Type': 'application/json' };
    try {
      const cfg: any = (window as any).TemplateDoctorConfig || {};
      if (cfg.functionKey) headers['x-functions-key'] = cfg.functionKey;
      const gh = (window as any).GitHubClient?.auth;
      if (gh?.isAuthenticated()) { const token = gh.getToken(); if (token) headers['Authorization'] = `Bearer ${token}`; }
    } catch(_) {}
    return headers;
  }
  function cacheDynamicReport(repoUrl: string, data: any){
    try {
      const norm = repoUrl.replace(/\.git$/,'').toLowerCase();
      (window as any).__dynamicReports = (window as any).__dynamicReports || {};
      (window as any).__dynamicReports[norm] = data;
      document.dispatchEvent(new CustomEvent('report-updated', { detail: { repoUrl, data, dynamic: true } }));
    } catch(err) { debug('cacheDynamicReport failed', err); }
  }
  async function submit(repoUrl: string){
    const cfg: any = (window as any).TemplateDoctorConfig || {};
    const base = (cfg.apiBase || window.location.origin).replace(/\/$/,'');
    const body: any = { repoUrl, ruleSet: cfg.defaultRuleSet || 'dod', mode: 'validate' };
    debug('Submitting validation', body);
    const loading = (window as any).Notifications?.loading?.('Validation submitted', repoUrl);
    try {
      const resp = await fetch(`${base}/v4/analyze-template`, { method:'POST', headers: getAuthHeaders(), body: JSON.stringify(body) });
      if(!resp.ok){ const txt = await resp.text(); throw new Error(`HTTP ${resp.status} ${resp.statusText} - ${txt}`); }
      const json = await resp.json();
      cacheDynamicReport(repoUrl, json);
      (window as any).Notifications?.success?.('Validation started', repoUrl, 3000);
      document.dispatchEvent(new CustomEvent('validation-submitted', { detail: { repoUrl, request: body, response: json } }));
      pollStatus(repoUrl, json.analysisId || json.id);
    } catch(err:any){
      console.error('[ValidateHandler] submission failed', err);
      (window as any).Notifications?.error?.('Validation Failed', err.message||String(err), 6000);
    } finally { loading?.close && loading.close(); }
  }
  async function pollStatus(repoUrl: string, analysisId?: string){
    if(!analysisId){ debug('No analysisId returned; skipping polling'); return; }
    const cfg: any = (window as any).TemplateDoctorConfig || {};
    const base = (cfg.apiBase || window.location.origin).replace(/\/$/,'');
    const started = Date.now();
    async function tick(){
      if ((Date.now()-started)/60000 > MAX_POLL_MINUTES){ debug('Validation polling timeout'); return; }
      try {
        const url = `${base}/v4/validation-status?analysisId=${encodeURIComponent(analysisId)}`;
        debug('Polling validation status', url);
        const resp = await fetch(url, { headers: getAuthHeaders() });
        if(!resp.ok) throw new Error(`Status HTTP ${resp.status}`);
        const statusJson = await resp.json();
        document.dispatchEvent(new CustomEvent('validation-status', { detail: { repoUrl, analysisId, status: statusJson } }));
        if (/completed|succeeded|failed|error/i.test(statusJson.state || statusJson.status || '')){
          if (statusJson.report) cacheDynamicReport(repoUrl, statusJson.report);
          (window as any).Notifications?.success?.('Validation complete', repoUrl, 4000);
          const selected = (window as any).CurrentSelectedTemplateRepo;
            if (selected && selected.toLowerCase() === repoUrl.toLowerCase()){
              try { (window as any).ReportLoader?.loadReport(repoUrl); } catch(_) {}
            }
          return;
        }
      } catch(err){ debug('Validation polling error', (err as any)?.message || err); }
      setTimeout(tick, POLL_INTERVAL);
    }
    setTimeout(tick, POLL_INTERVAL);
  }
  document.addEventListener('template-card-validate', (e: any) => {
    const tmpl = e?.detail?.template; if(!tmpl?.repoUrl) return;
    debug('Validation requested', tmpl.repoUrl);
    submit(tmpl.repoUrl);
  });
  (window as any).ValidateHandler = { validate: (r:string)=>submit(r) };
})();
export {};
