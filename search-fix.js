// Template Doctor Search Fix
// This script specifically fixes the search functionality

(function() {
  console.log('[SearchFix] Initializing search fix...');

  // Check if the search elements exist
  const searchInput = document.getElementById('repo-search');
  const searchButton = document.getElementById('search-button');
  const searchResults = document.getElementById('search-results');
  
  if (!searchInput || !searchButton || !searchResults) {
    console.warn('[SearchFix] Search elements not found. This might not be the search page.');
    return;
  }
  
  console.log('[SearchFix] Search elements found, proceeding with fix');
  
  // Ensure templatesData is available
  if (!window.templatesData || !Array.isArray(window.templatesData)) {
    console.warn('[SearchFix] templatesData not available or not an array. Creating empty array.');
    window.templatesData = [];
    
    // Try to load the data from the results endpoint
    fetch('/v4/templates')
      .then(response => response.json())
      .then(data => {
        console.log('[SearchFix] Successfully loaded templates data from API:', data.length, 'items');
        window.templatesData = data;
      })
      .catch(err => {
        console.error('[SearchFix] Failed to load templates data from API:', err);
      });
  }
  
  // Define the performSearch function that matches the reference implementation
  function performSearch(query) {
    console.log('[SearchFix] Performing search with query:', query);
    
    // Clear previous results
    searchResults.innerHTML = '';
    
    // If no query, show no results
    const q = query.trim().toLowerCase();
    if (!q) {
      searchResults.innerHTML = '<div class="no-results">Enter a search term</div>';
      return;
    }
    
    // Ensure we have templatesData to search through
    const data = Array.isArray(window.templatesData) ? window.templatesData : [];
    if (data.length === 0) {
      searchResults.innerHTML = '<div class="no-results">No templates available</div>';
      return;
    }
    
    // Perform the search
    const matches = data.filter(template => {
      // Search in multiple fields
      const searchableFields = [
        template.name,
        template.repoUrl,
        template.description,
        template.relativePath,
        Array.isArray(template.languages) ? template.languages.join(' ') : '',
        Array.isArray(template.tags) ? template.tags.join(' ') : ''
      ].filter(Boolean).map(field => field.toLowerCase());
      
      // Match if any field contains the query
      return searchableFields.some(field => field.includes(q));
    });
    
    // Show results or no results message
    if (matches.length === 0) {
      searchResults.innerHTML = '<div class="no-results">No matching templates found</div>';
      return;
    }
    
    // Display the matches
    matches.forEach(template => {
      const item = document.createElement('div');
      item.className = 'repo-item';
      item.setAttribute('data-test', 'repo-item');
      
      // Extract repository name from URL or use name/path
      const repoName = template.repoUrl && template.repoUrl.includes('github.com/') 
        ? template.repoUrl.split('github.com/')[1].replace(/\.git$/, '')
        : (template.name || template.relativePath || template.repoUrl || 'Unknown Template');
      
      // Build the HTML for the item
      let html = `<div class="repo-name">${repoName}</div>`;
      if (template.description) {
        html += `<div class="repo-description">${template.description}</div>`;
      }
      
      // Add metadata if available
      const metaItems = [];
      if (Array.isArray(template.languages) && template.languages.length > 0) {
        metaItems.push(`<div class="repo-languages">${template.languages.join(', ')}</div>`);
      }
      if (Array.isArray(template.tags) && template.tags.length > 0) {
        metaItems.push(`<div class="repo-tags">${template.tags.join(', ')}</div>`);
      }
      
      if (metaItems.length > 0) {
        html += `<div class="repo-meta">${metaItems.join('')}</div>`;
      }
      
      item.innerHTML = html;
      
      // Add click handler to analyze the template
      item.addEventListener('click', function() {
        console.log('[SearchFix] Template clicked:', repoName);
        if (template.repoUrl) {
          // Attempt to use the TemplateAnalyzer if available
          if (window.TemplateAnalyzer && typeof window.TemplateAnalyzer.analyzeTemplate === 'function') {
            window.TemplateAnalyzer.analyzeTemplate(template.repoUrl);
          } else {
            // Fallback to direct navigation
            window.location.href = `/templates/${encodeURIComponent(repoName)}`;
          }
        }
      });
      
      searchResults.appendChild(item);
    });
    
    // Signal that search results are ready (for tests)
    window.__lastSearchResultsCount = matches.length;
    document.dispatchEvent(new CustomEvent('search-results-ready', { 
      detail: { count: matches.length } 
    }));
  }
  
  // Replace or define the global performSearch function
  window.performSearch = performSearch;
  
  // Set up event handlers for search
  function setupSearchHandlers() {
    // Remove any existing handlers to prevent duplicates
    const oldButton = searchButton.cloneNode(true);
    searchButton.parentNode.replaceChild(oldButton, searchButton);
    
    // Get the new button reference
    const newSearchButton = document.getElementById('search-button');
    
    // Add click handler
    newSearchButton.addEventListener('click', function() {
      performSearch(searchInput.value);
    });
    
    // Add enter key handler
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        performSearch(this.value);
      }
    });
    
    console.log('[SearchFix] Search handlers attached');
    
    // If there's already text in the search box, perform search
    if (searchInput.value.trim()) {
      console.log('[SearchFix] Initial search with existing value:', searchInput.value);
      performSearch(searchInput.value);
    }
  }
  
  // Set up the search handlers
  setupSearchHandlers();
  
  // Listen for template data loaded events
  document.addEventListener('template-data-loaded', function() {
    console.log('[SearchFix] template-data-loaded event received');
    // Re-run search if there's a query
    if (searchInput.value.trim()) {
      performSearch(searchInput.value);
    }
  });
  
  console.log('[SearchFix] Search fix complete');
})();