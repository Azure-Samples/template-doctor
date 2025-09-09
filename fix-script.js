// Template Doctor fix script
// Save this file to your local workspace then copy into the browser console

(function() {
  console.log('=== Template Doctor Fix Script ===');
  
  // 1. Fix the templates data loading issue
  window.templatesData = window.templatesData || [];
  if (!Array.isArray(window.templatesData)) {
    window.templatesData = [];
  }
  
  // Create sample data if empty
  if (window.templatesData.length === 0) {
    window.templatesData = [
      {
        "timestamp": "2025-09-01T12:54:12.843Z",
        "dashboardPath": "1756731277912-dashboard.html",
        "dataPath": "1756731277912-data.js",
        "repoUrl": "https://github.com/Azure-Samples/rag-postgres-openai-python",
        "collection": "aigallery",
        "ruleSet": "dod",
        "compliance": {
          "percentage": 19,
          "issues": 43,
          "passed": 11
        },
        "scannedBy": ["user"],
        "relativePath": "sample-repo/1756731277912-dashboard.html"
      },
      {
        "timestamp": "2025-07-25T10:14:02.435Z",
        "dashboardPath": "1753438442443-dashboard.html",
        "dataPath": "1753438442443-data.js",
        "repoUrl": "https://github.com/Azure-Samples/get-started-with-ai-agents",
        "originUpstream": "Azure-Samples/get-started-with-ai-agents",
        "ruleSet": "partner",
        "compliance": {
          "percentage": 56,
          "issues": 19,
          "passed": 24
        },
        "scannedBy": ["user"],
        "relativePath": "get-started-with-ai-agents/1753438442443-dashboard.html"
      }
    ];
    console.log('Added sample template data');
  }
  
  // 2. Fix the search functionality
  if (typeof window.performSearch !== 'function') {
    window.performSearch = function(query) {
      const container = document.getElementById('search-results');
      if (!container) return;
      container.innerHTML = '';
      const q = query.trim().toLowerCase();
      if (!q) return;
      const data = window.templatesData || [];
      console.log('[Search Fix] performing search', { query: q, datasetSize: data.length });
      const matches = data.filter(d => (d.repoUrl && d.repoUrl.toLowerCase().includes(q)) || (d.relativePath && d.relativePath.toLowerCase().includes(q)));
      if (matches.length === 0) {
        container.innerHTML = '<div class="no-results">No results found</div>';
        return;
      }
      for (const m of matches.slice(0, 5)) {
        const div = document.createElement('div');
        div.className = 'repo-item';
        div.setAttribute('data-test','repo-item');
        const repoName = m.repoUrl.includes('github.com/') ? m.repoUrl.split('github.com/')[1] : (m.relativePath || m.repoUrl);
        div.innerHTML = `<div class="repo-name">${repoName}</div>`;
        div.addEventListener('click', function() {
          window.location.href = `results/${m.relativePath || '#'}`;
        });
        container.appendChild(div);
      }
      window.__lastSearchResultsCount = matches.length;
      document.dispatchEvent(new CustomEvent('search-results-ready', { detail: { count: matches.length } }));
    };
    
    // Attach search handler to button
    const searchBtn = document.getElementById('search-button');
    const searchInput = document.getElementById('repo-search');
    if (searchBtn && searchInput) {
      searchBtn.addEventListener('click', function() {
        window.performSearch(searchInput.value);
      });
      searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          window.performSearch(searchInput.value);
        }
      });
      console.log('Fixed search button handlers');
    }
  }
  
  // 3. Make sure dashboard CSS is loaded
  const stylesheets = Array.from(document.styleSheets || []);
  const dashboardCss = stylesheets.find(s => s.href && s.href.includes('dashboard.css'));
  if (!dashboardCss) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/dashboard.css';
    document.head.appendChild(link);
    console.log('Injected dashboard.css');
  }
  
  // 4. Dispatch event to notify template data is loaded
  if (!window._templateDataDispatchDone) {
    window._templateDataDispatchDone = true;
    document.dispatchEvent(new CustomEvent('template-data-loaded'));
    console.log('Dispatched template-data-loaded event');
  }
  
  // 5. Make search section visible if hidden
  const searchSection = document.getElementById('search-section');
  if (searchSection) {
    searchSection.style.display = 'block';
    console.log('Made search section visible');
  }
  
  // 6. Verify GitHub auth if needed
  if (window.GitHubAuth && typeof window.GitHubAuth.isAuthenticated === 'function' && !window.GitHubAuth.isAuthenticated()) {
    console.log('User is not authenticated. Some features may not work correctly.');
    // Don't auto-trigger login to avoid interrupting the user
  }
  
  console.log('=== Template Doctor Fix Script Complete ===');
  console.log('If search still doesn\'t work, try clicking the Search button or pressing Enter in the search box.');
})();