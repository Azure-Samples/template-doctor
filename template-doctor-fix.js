// Template Doctor Fix-All Script
// This will be injected into the container to fix all issues

// 1. First, ensure all CSS is properly loaded (especially dashboard.css)
(function fixCSS() {
  const dashboardCss = document.querySelector('link[href*="dashboard.css"]');
  if (!dashboardCss) {
    console.log('[TemplateDoctorFix] Adding missing dashboard.css link');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/dashboard.css';
    document.head.appendChild(link);
  } else {
    console.log('[TemplateDoctorFix] dashboard.css link already exists');
  }
})();

// 2. Fix templatesData loading
(function fixTemplatesData() {
  // If templatesData is already loaded and valid, don't overwrite it
  if (window.templatesData && Array.isArray(window.templatesData) && window.templatesData.length > 0) {
    console.log('[TemplateDoctorFix] templatesData already loaded with', window.templatesData.length, 'items');
    return;
  }

  // If the script is already loaded but didn't properly set the templatesData, reinitialize it
  const indexDataScript = document.querySelector('script[src*="index-data.js"]');
  if (indexDataScript) {
    console.log('[TemplateDoctorFix] index-data.js script was loaded but templatesData is empty or invalid, attempting to fix');
    // Create a safer backup
    window.templatesData = window.templatesData || [];
    
    // Try to load it again after a delay (giving other scripts time to initialize)
    setTimeout(() => {
      const newScript = document.createElement('script');
      newScript.src = '/results/index-data.js?' + new Date().getTime(); // Cache buster
      newScript.onload = () => {
        console.log('[TemplateDoctorFix] Reloaded index-data.js, templatesData has', 
          Array.isArray(window.templatesData) ? window.templatesData.length : 0, 'items');
        
        // Dispatch event to notify listeners that data is loaded
        document.dispatchEvent(new CustomEvent('template-data-loaded'));
      };
      newScript.onerror = (e) => {
        console.error('[TemplateDoctorFix] Failed to reload index-data.js', e);
        // Fallback to API endpoint
        fetch('/v4/templates')
          .then(response => response.json())
          .then(data => {
            window.templatesData = data;
            console.log('[TemplateDoctorFix] Loaded templatesData via API endpoint,', data.length, 'items');
            document.dispatchEvent(new CustomEvent('template-data-loaded'));
          })
          .catch(err => {
            console.error('[TemplateDoctorFix] Failed to load templates via API endpoint', err);
          });
      };
      document.head.appendChild(newScript);
    }, 1000);
  } else {
    console.log('[TemplateDoctorFix] index-data.js script not found, adding it');
    // Initialize empty templatesData to prevent errors
    window.templatesData = window.templatesData || [];
    
    // Try to load the script
    const script = document.createElement('script');
    script.src = '/results/index-data.js';
    script.onload = () => {
      console.log('[TemplateDoctorFix] Loaded index-data.js, templatesData has', 
        Array.isArray(window.templatesData) ? window.templatesData.length : 0, 'items');
      document.dispatchEvent(new CustomEvent('template-data-loaded'));
    };
    script.onerror = (e) => {
      console.error('[TemplateDoctorFix] Failed to load index-data.js', e);
      // Fallback to API endpoint
      fetch('/v4/templates')
        .then(response => response.json())
        .then(data => {
          window.templatesData = data;
          console.log('[TemplateDoctorFix] Loaded templatesData via API endpoint,', data.length, 'items');
          document.dispatchEvent(new CustomEvent('template-data-loaded'));
        })
        .catch(err => {
          console.error('[TemplateDoctorFix] Failed to load templates via API endpoint', err);
        });
    };
    document.head.appendChild(script);
  }
})();

// 3. Fix search functionality
(function fixSearch() {
  // Ensure search functions are properly defined
  if (typeof window.performSearch !== 'function') {
    console.log('[TemplateDoctorFix] Adding missing performSearch function');
    window.performSearch = function(query) {
      const container = document.getElementById('search-results');
      if (!container) return;
      container.innerHTML = '';
      const q = query.trim().toLowerCase();
      if (!q) return;
      
      // Ensure templatesData is an array
      const data = Array.isArray(window.templatesData) ? window.templatesData : [];
      console.log('[TemplateDoctorFix] Performing search with query:', q, 'on', data.length, 'items');
      
      const matches = data.filter(d => 
        (d.repoUrl && d.repoUrl.toLowerCase().includes(q)) || 
        (d.relativePath && d.relativePath.toLowerCase().includes(q)) ||
        (d.name && d.name.toLowerCase().includes(q)) ||
        (d.description && d.description.toLowerCase().includes(q))
      );
      
      if (matches.length === 0) {
        container.innerHTML = '<div class="no-results">No templates found</div>';
        return;
      }
      
      for (const m of matches.slice(0, 10)) {
        const div = document.createElement('div');
        div.className = 'repo-item';
        div.setAttribute('data-test', 'repo-item');
        const repoName = m.repoUrl && m.repoUrl.includes('github.com/') 
          ? m.repoUrl.split('github.com/')[1] 
          : (m.name || m.relativePath || m.repoUrl);
        
        let html = `<div class="repo-name">${repoName}</div>`;
        if (m.description) {
          html += `<div class="repo-description">${m.description}</div>`;
        }
        div.innerHTML = html;
        
        // Add click handler
        div.addEventListener('click', function() {
          console.log('[TemplateDoctorFix] Repo item clicked:', repoName);
          if (m.repoUrl) {
            if (window.TemplateAnalyzer && typeof window.TemplateAnalyzer.analyzeTemplate === 'function') {
              window.TemplateAnalyzer.analyzeTemplate(m.repoUrl);
            } else {
              window.location.href = `/templates/${encodeURIComponent(repoName)}`;
            }
          }
        });
        
        container.appendChild(div);
      }
      
      // Signal to tests that results are ready
      window.__lastSearchResultsCount = matches.length;
      document.dispatchEvent(new CustomEvent('search-results-ready', { detail: { count: matches.length } }));
    };
  }
  
  if (typeof window.attachSearch !== 'function') {
    console.log('[TemplateDoctorFix] Adding missing attachSearch function');
    window.attachSearch = function() {
      const input = document.getElementById('repo-search');
      const btn = document.getElementById('search-button');
      if (!input || !btn) return;
      if (btn._searchBound) return;
      btn._searchBound = true;
      
      console.log('[TemplateDoctorFix] Binding search handlers');
      const handler = () => window.performSearch(input.value);
      btn.addEventListener('click', handler);
      input.addEventListener('keydown', (e) => { 
        if (e.key === 'Enter') handler(); 
      });
      
      // If there's already a value in the input, trigger search
      if (input.value.trim()) {
        console.log('[TemplateDoctorFix] Auto-running search with existing input:', input.value);
        handler();
      }
    };
    
    // Call attachSearch once
    window.attachSearch();
    
    // Listen for template data loaded to re-attach search
    document.addEventListener('template-data-loaded', () => {
      console.log('[TemplateDoctorFix] template-data-loaded event received, re-attaching search');
      setTimeout(window.attachSearch, 100);
    });
  }
})();

// 4. Fix GitHub client and auth connection
(function fixGitHubClient() {
  // Ensure GitHubClient and GitHubAuth are properly connected
  if (window.GitHubClient && window.GitHubAuth && typeof window.GitHubClient.auth !== 'object') {
    console.log('[TemplateDoctorFix] Connecting GitHubClient to GitHubAuth');
    window.GitHubClient.auth = window.GitHubAuth;
  }
  
  // If GitHubClient's fork method is missing, add it
  if (window.GitHubClient && !window.GitHubClient.forkRepository) {
    console.log('[TemplateDoctorFix] Adding missing forkRepository method to GitHubClient');
    window.GitHubClient.forkRepository = async function(sourceOwner, sourceRepo) {
      const cfg = window.TemplateDoctorConfig || {};
      const apiBase = cfg.apiBase || window.location.origin;
      const endpoint = window.ApiRoutes 
        ? window.ApiRoutes.build('repo-fork') 
        : `${apiBase.replace(/\/$/,'')}/api/v4/repo-fork`;
      
      const username = this.auth.getUsername();
      const body = { 
        sourceOwner, 
        sourceRepo, 
        targetOwner: username, 
        waitForReady: true 
      };
      
      const resp = await fetch(endpoint, { 
        method: 'POST', 
        headers: Object.assign(
          { 'Content-Type': 'application/json' }, 
          this.auth.getAuthHeaders()
        ), 
        body: JSON.stringify(body) 
      });
      
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Failed to fork repository: ${text}`);
      }
      
      return true;
    };
  }
})();

// 5. Fix ForkWorkflow
(function fixForkWorkflow() {
  if (!window.ForkWorkflow) {
    console.log('[TemplateDoctorFix] Creating missing ForkWorkflow object');
    window.ForkWorkflow = {
      ensureFork: async function(repoUrl) {
        try {
          if (!window.GitHubClient || !window.GitHubClient.auth?.isAuthenticated()) {
            return { skipped: 'not-authenticated' };
          }
          
          const gh = window.GitHubClient;
          const username = gh.auth.getUsername ? gh.auth.getUsername() : 'unknown-user';
          const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)(?:\.git)?/i);
          if (!match) return { error: 'invalid-repo-url' };
          
          const sourceOwner = match[1];
          const sourceRepo = match[2];
          
          if (username.toLowerCase() === sourceOwner.toLowerCase()) {
            return { alreadyOwner: true };
          }
          
          // Check if fork exists already
          try {
            const forkUrl = `https://api.github.com/repos/${username}/${sourceRepo}`;
            const headers = gh.auth.getAuthHeaders ? gh.auth.getAuthHeaders() : 
              { 'Authorization': `token ${gh.auth.getToken()}` };
            
            const resp = await fetch(forkUrl, { headers });
            if (resp.status === 200) {
              return { forkExists: true };
            }
          } catch(e) {
            console.error('[TemplateDoctorFix] Error checking for existing fork:', e);
          }
          
          // Prompt user to create fork
          if (!confirm(`You do not have a fork of ${sourceOwner}/${sourceRepo}. Create one now?`)) {
            return { userDeclined: true };
          }
          
          console.log('[TemplateDoctorFix] Creating fork for', sourceOwner, sourceRepo);
          
          // Try to use GitHubClient's fork method if available
          if (typeof gh.forkRepository === 'function') {
            try {
              await gh.forkRepository(sourceOwner, sourceRepo);
              document.dispatchEvent(new CustomEvent('fork-created', { 
                detail: { sourceOwner, sourceRepo, username } 
              }));
              return { forkCreated: true };
            } catch (e) {
              console.error('[TemplateDoctorFix] Failed to fork using GitHubClient:', e);
              return { error: 'fork-failed', details: e.message };
            }
          } else {
            return { error: 'fork-method-missing' };
          }
        } catch (e) {
          return { error: e?.message || String(e) };
        }
      }
    };
    
    // Add event listener for before-analysis
    document.addEventListener('before-analysis', async (e) => {
      try {
        const repoUrl = e?.detail?.repoUrl;
        if (!repoUrl) return;
        console.log('[TemplateDoctorFix] before-analysis event received, checking fork for', repoUrl);
        const res = await window.ForkWorkflow.ensureFork(repoUrl);
        console.log('[TemplateDoctorFix] Fork check result:', res);
        if (res?.error) {
          console.warn('[TemplateDoctorFix] fork check error', res);
        }
      } catch(err) { 
        console.warn('[TemplateDoctorFix] fork workflow handler error', err); 
      }
    });
  }
})();

// 6. Fix Template Analyzer functionality
(function fixTemplateAnalyzer() {
  if (!window.TemplateAnalyzer) {
    console.log('[TemplateDoctorFix] Creating missing TemplateAnalyzer object');
    window.TemplateAnalyzer = {
      analyzeTemplate: async function(repoUrl) {
        console.log('[TemplateDoctorFix] Analyzing template:', repoUrl);
        
        // First, ensure we have a fork if needed
        if (window.ForkWorkflow) {
          try {
            const forkResult = await window.ForkWorkflow.ensureFork(repoUrl);
            console.log('[TemplateDoctorFix] Fork check result:', forkResult);
            if (forkResult.error) {
              throw new Error(`Fork check failed: ${forkResult.error}`);
            }
            if (forkResult.userDeclined) {
              throw new Error('User declined to create fork');
            }
          } catch (e) {
            console.error('[TemplateDoctorFix] Fork workflow error:', e);
            throw e;
          }
        }
        
        // Construct API endpoint
        const cfg = window.TemplateDoctorConfig || {};
        const apiBase = cfg.apiBase || window.location.origin;
        const endpoint = window.ApiRoutes 
          ? window.ApiRoutes.build('analyze-template') 
          : `${apiBase.replace(/\/$/,'')}/api/v4/analyze-template`;
        
        try {
          // Show loading indicator
          const loadingElement = document.getElementById('analysis-loading');
          if (loadingElement) loadingElement.style.display = 'block';
          
          // Prepare headers
          const headers = { 'Content-Type': 'application/json' };
          if (window.GitHubClient?.auth?.getAuthHeaders) {
            Object.assign(headers, window.GitHubClient.auth.getAuthHeaders());
          }
          
          // Make API request
          const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({ repoUrl })
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error (${response.status}): ${errorText}`);
          }
          
          const result = await response.json();
          console.log('[TemplateDoctorFix] Analysis completed successfully:', result);
          
          // Hide loading indicator
          if (loadingElement) loadingElement.style.display = 'none';
          
          // Navigate to results page if available
          if (result.reportUrl) {
            window.location.href = result.reportUrl;
            return result;
          }
          
          // Dispatch completion event
          document.dispatchEvent(new CustomEvent('template-analysis-complete', { 
            detail: { result } 
          }));
          
          return result;
        } catch (e) {
          console.error('[TemplateDoctorFix] Analysis error:', e);
          
          // Hide loading indicator
          const loadingElement = document.getElementById('analysis-loading');
          if (loadingElement) loadingElement.style.display = 'none';
          
          // Dispatch error event
          document.dispatchEvent(new CustomEvent('template-analysis-error', { 
            detail: { error: e.message || String(e) } 
          }));
          
          throw e;
        }
      }
    };
  }
})();

console.log('[TemplateDoctorFix] All fixes applied successfully');