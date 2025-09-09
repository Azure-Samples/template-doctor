// Template Doctor Comprehensive Fix
// Save this file to your local workspace then copy into the browser console

(function() {
  console.log('=== Template Doctor Comprehensive Fix ===');
  
  // Store original console.error to track errors
  if (!window.__templateDoctorErrors) {
    window.__templateDoctorErrors = [];
    const originalConsoleError = console.error;
    console.error = function() {
      window.__templateDoctorErrors.push(Array.from(arguments).join(' '));
      originalConsoleError.apply(console, arguments);
    };
  }
  
  // 1. Fix CSS Loading
  function fixCssLoading() {
    const dashboardCss = document.querySelector('link[href*="dashboard.css"]');
    if (!dashboardCss) {
      console.log('Adding missing dashboard.css');
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/css/dashboard.css';
      document.head.appendChild(link);
    }
  }
  
  // 2. Fix templatesData loading
  function fixTemplatesDataLoading() {
    if (!window.templatesData) {
      // Try to load index-data.js if it's not already loaded
      const indexDataScript = document.querySelector('script[src*="index-data.js"]');
      if (!indexDataScript) {
        console.log('Loading missing index-data.js');
        const script = document.createElement('script');
        script.src = '/results/index-data.js';
        script.onload = () => {
          console.log('index-data.js loaded, templatesData:', 
            typeof window.templatesData, 
            window.templatesData ? `(${Object.keys(window.templatesData).length} templates)` : '');
          
          // Initialize search functionality after data is loaded
          if (typeof window.attachSearch === 'function') {
            window.attachSearch();
          }
        };
        script.onerror = (e) => {
          console.error('Failed to load index-data.js', e);
          // Try fallback loading from v4 endpoint
          const fallbackScript = document.createElement('script');
          fallbackScript.src = '/api/v4/templates';
          fallbackScript.onload = () => {
            console.log('Fallback templates loaded via API endpoint');
            if (typeof window.attachSearch === 'function') {
              window.attachSearch();
            }
          };
          document.head.appendChild(fallbackScript);
        };
        document.head.appendChild(script);
      }
    }
  }
  
  // 3. Fix GitHub auth connection to client
  function fixGitHubClientAuth() {
    if (window.GitHubClient && window.GitHubAuth && typeof window.GitHubClient.auth !== 'object') {
      console.log('Fixing GitHubClient auth connection');
      window.GitHubClient.auth = window.GitHubAuth;
    }
  }
  
  // 4. Fix ForkWorkflow
  function fixForkWorkflow() {
    if (!window.ForkWorkflow) {
      console.log('Creating ForkWorkflow helper');
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
              console.error('Error checking for existing fork:', e);
            }
            
            // Prompt user to create fork
            if (!confirm(`You do not have a fork of ${sourceOwner}/${sourceRepo}. Create one now?`)) {
              return { userDeclined: true };
            }
            
            console.log('Creating fork for', sourceOwner, sourceRepo);
            
            // Try to use GitHubClient's fork method if available
            if (typeof gh.forkRepository === 'function') {
              try {
                await gh.forkRepository(sourceOwner, sourceRepo);
                document.dispatchEvent(new CustomEvent('fork-created', { 
                  detail: { sourceOwner, sourceRepo, username } 
                }));
                return { forkCreated: true };
              } catch (e) {
                console.error('Failed to fork using GitHubClient:', e);
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
          const res = await window.ForkWorkflow.ensureFork(repoUrl);
          if (res?.error) {
            console.warn('[fork-workflow] fork check error', res);
          }
        } catch(err) { 
          console.warn('[fork-workflow] handler error', err); 
        }
      });
    }
  }
  
  // 5. Fix search functionality
  function fixSearchFunctionality() {
    // Define search functions if missing
    if (typeof window.performSearch !== 'function') {
      window.performSearch = function(query) {
        if (!window.templatesData) {
          console.warn('Cannot search: templatesData not available');
          return [];
        }
        
        query = query.trim().toLowerCase();
        if (!query) return Object.values(window.templatesData);
        
        return Object.values(window.templatesData).filter(template => {
          const searchFields = [
            template.name,
            template.description,
            template.repoUrl,
            template.languages?.join(' '),
            template.tags?.join(' '),
          ].filter(Boolean).map(s => s.toLowerCase());
          
          return searchFields.some(field => field.includes(query));
        });
      };
    }
    
    if (typeof window.attachSearch !== 'function') {
      window.attachSearch = function() {
        const searchInput = document.getElementById('search-input');
        const searchResults = document.getElementById('search-results');
        
        if (!searchInput || !searchResults) {
          console.warn('Search elements not found in DOM');
          return;
        }
        
        searchInput.addEventListener('input', function() {
          const query = this.value;
          const results = window.performSearch(query);
          
          searchResults.innerHTML = '';
          
          if (results.length === 0) {
            searchResults.innerHTML = '<p class="no-results">No templates found</p>';
            return;
          }
          
          results.forEach(template => {
            const item = document.createElement('div');
            item.className = 'repo-item';
            item.innerHTML = `
              <div class="repo-name">${template.name}</div>
              <div class="repo-description">${template.description || ''}</div>
              <div class="repo-meta">
                ${template.languages ? `<div class="repo-languages">${template.languages.join(', ')}</div>` : ''}
                ${template.tags ? `<div class="repo-tags">${template.tags.join(', ')}</div>` : ''}
              </div>
            `;
            
            item.addEventListener('click', function() {
              if (template.repoUrl) {
                // Trigger analysis if TemplateAnalyzer is available
                if (window.TemplateAnalyzer && typeof window.TemplateAnalyzer.analyzeTemplate === 'function') {
                  window.TemplateAnalyzer.analyzeTemplate(template.repoUrl)
                    .catch(err => {
                      console.error('Analysis error:', err);
                      alert('Error analyzing repository: ' + (err.message || String(err)));
                    });
                } else {
                  window.location.href = `/templates/${encodeURIComponent(template.name)}`;
                }
              }
            });
            
            searchResults.appendChild(item);
          });
        });
        
        // Trigger initial search if there's a value
        if (searchInput.value) {
          searchInput.dispatchEvent(new Event('input'));
        }
      };
    }
    
    // Attach search functionality
    if (typeof window.attachSearch === 'function') {
      window.attachSearch();
    }
  }
  
  // Apply all fixes
  fixCssLoading();
  fixTemplatesDataLoading();
  fixGitHubClientAuth();
  fixForkWorkflow();
  fixSearchFunctionality();
  
  console.log('=== Template Doctor Comprehensive Fix Complete ===');
  console.log('Refresh the page to see if issues are resolved. If problems persist, check browser console for errors.');
})();