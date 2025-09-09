// Migrated from js/report-loader.js (behavior preserved)
console.log('Loading report-loader.ts');
(function(){
  if ((window as any).ReportLoader !== undefined){ console.log('ReportLoader already exists, skipping'); return; }
  type ReportLoaderResult = { success: boolean; error?: string; data?: any };
  type FetchOptions = Record<string, any>;
  type ReportData = { [key: string]: any; analyzerVersion?: string };
  function ReportLoaderClass(){
    this.debug = function(message: string, data?: any): void { 
      if (typeof (window as any).debug === 'function') { 
        (window as any).debug('report-loader', message, data); 
      } else { 
        console.log(`[ReportLoader] ${message}`, data !== undefined ? data : ''); 
      } 
    };
    this.loadReport = async function(repoUrl: string, options: FetchOptions = {}): Promise<ReportLoaderResult> { 
      this.debug('loadReport called', { repoUrl, options }); 
      try { 
        if (!repoUrl) throw new Error('Repository URL is required'); 
        const reportContainer = document.getElementById('report'); 
        if (!reportContainer){ 
          this.debug('Report container not found'); 
          return { success: false, error: 'Report container not found' }; 
        } 
        reportContainer.innerHTML = '<div class="loading-message">Loading report...</div>'; 
        const data = await this.fetchReportData(repoUrl, options); 
        if (!data){ 
          reportContainer.innerHTML = '<div class="error-message">No report data available</div>'; 
          return { success: false, error: 'No data' }; 
        }
        // Provide alias for legacy scripts
        (window as any).reportDataOriginal = data;
        if ((window as any).DashboardRenderer){ 
          (window as any).DashboardRenderer.render(data, reportContainer); 
          return { success: true, data }; 
        } else { 
          reportContainer.innerHTML = '<div class="error-message">Dashboard renderer not available</div>'; 
          return { success: false, error: 'Dashboard renderer not available' }; 
        }
      } catch (e: any){ 
        console.error('Error loading report:', e); 
        const reportContainer = document.getElementById('report'); 
        if (reportContainer){ 
          reportContainer.innerHTML = `<div class="error-message">Error loading report: ${e.message}</div>`; 
        } 
        return { success: false, error: e.message }; 
      } 
    };
    this.fetchReportData = async function(repoUrl: string, options: FetchOptions = {}): Promise<ReportData | null> { 
      this.debug('fetchReportData called', { repoUrl, options }); 
      try {
        const norm = String(repoUrl).replace(/\.git$/,'').toLowerCase();
        const dyn = (window as any).__dynamicReports;
        if (dyn && dyn[norm]) { 
          this.debug('Serving report from dynamic cache');
            return dyn[norm];
        }
      } catch(_) {}
      const strategies: Array<(repoUrl: string, options?: FetchOptions) => Promise<ReportData | null>> = [ 
        this.tryLatestJson.bind(this), 
        this.tryTimestampedJson.bind(this), 
        this.tryEmbeddedScript.bind(this), 
        this.tryDashboardHtml.bind(this) 
      ]; 
      for (const strat of strategies){ 
        try { 
          const data = await strat(repoUrl, options); 
          if (data){ 
            this.debug('Data loaded via strategy', strat.name); 
            return data; 
          } 
        } catch (e: any){ 
          this.debug('Strategy failed', { name: strat.name, error: e.message }); 
        } 
      } 
      this.debug('All strategies failed'); 
      return null; 
    };
    this.tryLatestJson = async function(repoUrl: string): Promise<ReportData | null> { 
      try { 
        const folder = this.getResultsFolderForRepo(repoUrl); 
        if (!folder) return null; 
        const url = `/results/${folder}/latest.json`; 
        this.debug('Trying latest.json', url); 
        const resp = await fetch(url, { cache: 'no-store' }); 
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`); 
        const data: ReportData = await resp.json(); 
        if (!data || typeof data !== 'object') return null; 
        if (!data.analyzerVersion){ data.analyzerVersion = 'unknown'; } 
        return data; 
      } catch (e: any){ 
        this.debug('tryLatestJson failed', e.message); 
        return null; 
      } 
    };
    this.tryDashboardHtml = async function(repoUrl: string): Promise<ReportData | null> {
      try {
        const folder = this.getResultsFolderForRepo(repoUrl);
        if(!folder) return null;
        if(Array.isArray((window as any).templatesData)){
          const match = (window as any).templatesData.find((t:any)=> (t.repoUrl||'').replace(/\.git$/,'').toLowerCase() === repoUrl.replace(/\.git$/,'').toLowerCase());
          if(match && match.dashboardPath){
            const raw = await fetch(`/results/${match.relativePath}`, { cache: 'no-store' });
            if(raw.ok){
              const html = await raw.text();
              // Light sanitation: strip script tags to avoid executing legacy inline logic when rendering fallback message.
              const sanitized = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '<!-- stripped script -->');
              return { rawHtml: sanitized, repoUrl, analyzerVersion: 'embedded-html' } as any;
            }
          }
        }
      } catch(_){}
      return null;
    };
    this.tryTimestampedJson = async function(repoUrl: string): Promise<ReportData | null> { 
      try { 
        const folder = this.getResultsFolderForRepo(repoUrl); 
        if (!folder) return null; 
        const url = `/results/${folder}`; 
        this.debug('Trying timestamped JSON in folder', url); 
        const listing = await fetch(url, { cache: 'no-store' }); 
        if (!listing.ok) throw new Error(`HTTP ${listing.status}`); 
        const html = await listing.text(); 
        const matches = [...html.matchAll(/href="(\d{4}-\d{2}-\d{2}T\d{6}Z\.json)"/g)]; 
        if (matches.length === 0) return null; 
        matches.sort((a,b)=> b[1].localeCompare(a[1])); 
        for (const m of matches){ 
          const file = m[1]; 
          try { 
            const fileUrl = `${url}/${file}`; 
            const resp = await fetch(fileUrl, { cache: 'no-store' }); 
            if (!resp.ok) continue; 
            const data: ReportData = await resp.json(); 
            if (data && typeof data === 'object'){ 
              if (!data.analyzerVersion){ data.analyzerVersion = 'unknown'; } 
              return data; 
            } 
          } catch (_){ } 
        } 
        return null; 
      } catch(e: any){ 
        this.debug('tryTimestampedJson failed', e.message); 
        return null; 
      } 
    };
    this.tryEmbeddedScript = async function(repoUrl: string): Promise<ReportData | null> { 
      try { 
        const scriptEl = document.getElementById('report-data-script'); 
        if (!scriptEl) return null; 
        this.debug('Trying embedded script data'); 
        const text = scriptEl.textContent || (scriptEl as HTMLElement).innerText; 
        if (!text) return null; 
        const jsonStart = text.indexOf('{'); 
        if (jsonStart === -1) return null; 
        const jsonText = text.slice(jsonStart); 
        const data: ReportData = JSON.parse(jsonText); 
        if (!data.analyzerVersion){ data.analyzerVersion = 'unknown'; } 
        return data; 
      } catch(e: any){ 
        this.debug('tryEmbeddedScript failed', e.message); 
        return null; 
      } 
    };
    this.getResultsFolderForRepo = function(repoUrl: string): string | null { 
      if (!repoUrl) return null; 
      try { 
        if (Array.isArray((window as any).templatesData)){ 
          const match = (window as any).templatesData.find((t: any)=>{ 
            const a = String(t.repoUrl || '').replace(/\.git$/, '').toLowerCase(); 
            const b = String(repoUrl).replace(/\.git$/, '').toLowerCase(); 
            return a===b; 
          }); 
          if (match && match.relativePath){ 
            const folder = match.relativePath.split('/')[0]; 
            if (folder) return folder; 
          } 
        } 
        const u = new URL(repoUrl); 
        const parts = u.pathname.split('/').filter(Boolean); 
        if (parts.length >= 2){ 
          const direct = `${parts[0]}-${parts[1]}`.toLowerCase();
          // Additional fallback: some historical result folders may have been stored under a different owner prefix (e.g., anfibiacreativa- instead of azure-samples-)
          // Scan known results directories once and memoize.
          if (!(window as any).__resultsFolderIndex) {
            try {
              // We cannot list server-side; rely on templatesData derived relativePath prefixes to build an index.
              const idx: Record<string,string> = {};
              if (Array.isArray((window as any).templatesData)) {
                (window as any).templatesData.forEach((t: any) => {
                  if (t.relativePath) {
                    const prefix = t.relativePath.split('/')[0];
                    if (t.repoUrl) {
                      const key = t.repoUrl.replace(/\.git$/,'').toLowerCase();
                      if (!idx[key]) idx[key] = prefix;
                    }
                  }
                });
              }
              (window as any).__resultsFolderIndex = idx;
            } catch(_) {}
          }
          try {
            const key = repoUrl.replace(/\.git$/,'').toLowerCase();
            const mapped = (window as any).__resultsFolderIndex && (window as any).__resultsFolderIndex[key];
            if (mapped) return mapped.toLowerCase();
          } catch(_){ }
          return direct; 
        } 
      } catch(e: any){ 
        this.debug('getResultsFolderForRepo error', e.message); 
      } 
      return null; 
    };
  }
  (window as any).ReportLoader = new ReportLoaderClass();
})();
export {};