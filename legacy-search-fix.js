// Template Doctor Legacy Search Fix
// This script implements the search functionality from the legacy app.js

(function() {
  console.log('[LegacySearchFix] Initializing search fix based on app.js...');
  
  // State
  let recentSearches = JSON.parse(localStorage.getItem('td_recent_searches') || '[]');
  let scannedTemplates = [];
  
  // UI elements
  const searchInput = document.getElementById('repo-search');
  const searchButton = document.getElementById('search-button');
  const searchResults = document.getElementById('search-results');
  const searchSection = document.getElementById('search-section');
  
  // Template section elements (will be created if needed)
  let scannedTemplatesSection;
  let templateGrid;
  
  // Check if elements exist
  if (!searchInput || !searchButton || !searchResults) {
    console.warn('[LegacySearchFix] Required search elements not found. This might not be the search page.');
    return;
  }
  
  console.log('[LegacySearchFix] Search elements found, proceeding with fix');
  
  // Load scanned templates
  function loadScannedTemplates() {
    // First check if user is authenticated
    if (!window.GitHubAuth || !window.GitHubAuth.isAuthenticated()) {
      console.log('[LegacySearchFix] User is not authenticated, not loading scanned templates');
      scannedTemplates = [];
      return false;
    }

    // Check if window.templatesData exists (loaded from results/index-data.js)
    if (window.templatesData) {
      console.log('[LegacySearchFix] Loading scanned templates from index-data.js', window.templatesData.length);
      scannedTemplates = window.templatesData;
      renderScannedTemplates();
      return true;
    } else {
      console.log('[LegacySearchFix] No scanned templates found');
      
      // Try to load templates data if not already loaded
      loadTemplatesData();
      return false;
    }
  }
  
  // Load templates data if needed
  function loadTemplatesData() {
    if (window.templatesData) return;
    
    console.log('[LegacySearchFix] Attempting to load templates data...');
    
    // Try to load via script tag
    const indexDataScript = document.querySelector('script[src*="index-data.js"]');
    if (!indexDataScript) {
      const script = document.createElement('script');
      script.src = '/results/index-data.js';
      script.onload = () => {
        console.log('[LegacySearchFix] Successfully loaded index-data.js, templatesData has', 
          Array.isArray(window.templatesData) ? window.templatesData.length : 0, 'items');
        
        // Once data is loaded, try to render the templates
        if (window.templatesData && Array.isArray(window.templatesData)) {
          scannedTemplates = window.templatesData;
          renderScannedTemplates();
          
          // Dispatch event to notify other components
          document.dispatchEvent(new CustomEvent('template-data-loaded'));
        }
      };
      script.onerror = (e) => {
        console.error('[LegacySearchFix] Failed to load index-data.js', e);
        
        // Try fallback to API endpoint
        fetch('/v4/templates')
          .then(response => response.json())
          .then(data => {
            console.log('[LegacySearchFix] Loaded templates data from API:', data.length, 'items');
            window.templatesData = data;
            scannedTemplates = data;
            renderScannedTemplates();
            document.dispatchEvent(new CustomEvent('template-data-loaded'));
          })
          .catch(err => {
            console.error('[LegacySearchFix] Failed to load templates from API:', err);
            window.templatesData = [];
            scannedTemplates = [];
          });
      };
      document.head.appendChild(script);
    }
  }
  
  // Create the scanned templates section
  function createScannedTemplatesSection() {
    // Create the section if it doesn't exist
    if (!document.getElementById('scanned-templates-section')) {
      scannedTemplatesSection = document.createElement('section');
      scannedTemplatesSection.id = 'scanned-templates-section';
      scannedTemplatesSection.className = 'scanned-templates-section';

      // Create collapsible header
      scannedTemplatesSection.innerHTML = `
        <div class="section-header collapsible">
            <h2>Previously Scanned Templates</h2>
            <button class="toggle-btn"><i class="fas fa-chevron-down"></i></button>
        </div>
        <div class="section-content">
            <div id="template-grid" class="template-grid"></div>
            <div class="pagination">
                <button class="prev-page" disabled>&laquo; Previous</button>
                <div class="page-numbers"></div>
                <button class="next-page">Next &raquo;</button>
            </div>
        </div>
      `;

      // Insert after the search section
      if (searchSection && searchSection.parentNode) {
        searchSection.parentNode.insertBefore(scannedTemplatesSection, searchSection.nextSibling);
      } else {
        // Fallback: insert into main container
        document.querySelector('main.container').appendChild(scannedTemplatesSection);
      }

      templateGrid = document.getElementById('template-grid');

      // Set up collapsible functionality
      const toggleBtn = scannedTemplatesSection.querySelector('.toggle-btn');
      const sectionContent = scannedTemplatesSection.querySelector('.section-content');

      toggleBtn.addEventListener('click', () => {
        const isCollapsed = sectionContent.style.display === 'none';
        sectionContent.style.display = isCollapsed ? 'block' : 'none';
        toggleBtn.innerHTML = isCollapsed
          ? '<i class="fas fa-chevron-down"></i>'
          : '<i class="fas fa-chevron-right"></i>';

        // Store preference in localStorage
        localStorage.setItem('td_templates_collapsed', isCollapsed ? 'false' : 'true');
      });

      // Apply stored collapse state
      const isCollapsed = localStorage.getItem('td_templates_collapsed') === 'true';
      if (isCollapsed) {
        sectionContent.style.display = 'none';
        toggleBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
      }
    } else {
      scannedTemplatesSection = document.getElementById('scanned-templates-section');
      templateGrid = document.getElementById('template-grid');
    }
  }
  
  // Variables for pagination
  let currentPage = 1;
  const templatesPerPage = 6;
  
  // Render scanned templates
  function renderScannedTemplates(page = 1) {
    createScannedTemplatesSection();

    if (!templateGrid) return;

    // Check if user is authenticated
    if (!window.GitHubAuth || !window.GitHubAuth.isAuthenticated()) {
      templateGrid.innerHTML =
        '<div class="no-templates">Please sign in to view scanned templates.</div>';
      // Hide pagination
      const pagination = scannedTemplatesSection.querySelector('.pagination');
      if (pagination) pagination.style.display = 'none';
      return;
    }

    if (scannedTemplates.length === 0) {
      templateGrid.innerHTML = '<div class="no-templates">No scanned templates found.</div>';
      // Hide pagination
      const pagination = scannedTemplatesSection.querySelector('.pagination');
      if (pagination) pagination.style.display = 'none';
      return;
    }

    // Update current page
    currentPage = page;

    // Calculate pagination
    const totalTemplates = scannedTemplates.length;
    const totalPages = Math.ceil(totalTemplates / templatesPerPage);
    const startIndex = (currentPage - 1) * templatesPerPage;
    const endIndex = Math.min(startIndex + templatesPerPage, totalTemplates);

    // Get templates for current page
    const currentTemplates = scannedTemplates.slice(startIndex, endIndex);

    // Render templates
    templateGrid.innerHTML = '';
    currentTemplates.forEach((template) => {
      const repoName = template.repoUrl.split('github.com/')[1] || template.repoUrl;
      const templateId = template.relativePath 
        ? `template-${template.relativePath.split('/')[0]}`.replace(/[^a-zA-Z0-9-]/g, '-')
        : `template-${Math.random().toString(36).substring(2, 10)}`;

      // Get ruleset information from template, default to "DoD" if not available
      const ruleSet = template.ruleSet || 'dod';
      const ruleSetDisplay =
        ruleSet === 'dod'
          ? 'DoD'
          : ruleSet === 'partner'
            ? 'Partner'
            : ruleSet === 'docs'
              ? 'Docs'
              : 'Custom';

      // Check for gistUrl in custom rulesets
      let gistUrl = '';
      if (ruleSet === 'custom' && template.customConfig && template.customConfig.gistUrl) {
        gistUrl = template.customConfig.gistUrl;
      }

      // Get the last scanner from the scannedBy array
      const lastScanner =
        template.scannedBy && template.scannedBy.length > 0
          ? template.scannedBy[template.scannedBy.length - 1]
          : 'Unknown';

      const card = document.createElement('div');
      card.className = 'template-card';
      card.id = templateId;
      card.dataset.repoUrl = template.repoUrl;
      card.dataset.dashboardPath = template.relativePath;
      card.dataset.ruleSet = ruleSet;
      
      card.innerHTML = `
        <div class="card-header">
            <h3 data-tooltip="${repoName}" class="has-permanent-tooltip">${repoName}</h3>
            <span class="scan-date">Last scanned by <strong>${lastScanner}</strong> on ${new Date(template.timestamp).toLocaleDateString()}</span>
        </div>
        <div class="card-body">
            ${
              ruleSet === 'custom' && gistUrl
                ? `<a href="${gistUrl}" target="_blank" class="ruleset-badge ${ruleSet}-badge" title="View custom ruleset on GitHub">
                    ${ruleSetDisplay} <i class="fas fa-external-link-alt fa-xs"></i>
                 </a>`
                : `<div class="ruleset-badge ${ruleSet}-badge">${ruleSetDisplay}</div>`
            }
            <div class="compliance-bar">
                <div class="compliance-fill" style="width: ${template.compliance ? template.compliance.percentage : 0}%"></div>
                <span class="compliance-value">${template.compliance ? template.compliance.percentage : 0}%</span>
            </div>
            <div class="stats">
                <div class="stat-item issues">
                    <i class="fas fa-exclamation-triangle"></i>
                    ${(() => {
                      // Get the template name from relativePath (first part before the slash)
                      const templateName = template.relativePath
                        ? template.relativePath.split('/')[0]
                        : null;
                      // Get the latest scanner (last in the scannedBy array)
                      const latestScanner =
                        template.scannedBy && template.scannedBy.length > 0
                          ? template.scannedBy[template.scannedBy.length - 1]
                          : null;

                      if (templateName && latestScanner) {
                        return `<a href="https://github.com/${latestScanner}/${templateName}/issues" target="_blank" 
                                class="issues-link" title="View issues for ${templateName} by ${latestScanner}">
                                ${template.compliance ? template.compliance.issues : 0} issues <i class="fas fa-external-link-alt fa-xs"></i>
                            </a>`;
                      } else {
                        return `<span>${template.compliance ? template.compliance.issues : 0} issues</span>`;
                      }
                    })()}
                </div>
                <div class="stat-item passed">
                    <i class="fas fa-check-circle"></i>
                    <span>${template.compliance ? template.compliance.passed : 0} passed</span>
                </div>
            </div>
        </div>
        <div class="card-footer">
            <button class="view-report-btn">View Report</button>
            <button class="rescan-btn">Rescan</button>
            <button class="validate-btn">Run Validation</button>
        </div>
      `;
      
      // Add click handlers for buttons (implementation will be added separately)
      card.querySelector('.view-report-btn').addEventListener('click', () => {
        console.log('[LegacySearchFix] View report button clicked for', repoName);
        viewTemplateReport(template);
      });
      
      card.querySelector('.rescan-btn').addEventListener('click', () => {
        console.log('[LegacySearchFix] Rescan button clicked for', repoName);
        rescanTemplate(template);
      });
      
      card.querySelector('.validate-btn').addEventListener('click', () => {
        console.log('[LegacySearchFix] Validate button clicked for', repoName);
        validateTemplate(template);
      });

      templateGrid.appendChild(card);
    });

    // Update pagination controls
    const pagination = scannedTemplatesSection.querySelector('.pagination');
    const pageNumbers = pagination.querySelector('.page-numbers');
    const prevBtn = pagination.querySelector('.prev-page');
    const nextBtn = pagination.querySelector('.next-page');

    // Show/hide pagination based on number of templates
    pagination.style.display = totalTemplates > templatesPerPage ? 'flex' : 'none';

    // Generate page numbers
    pageNumbers.innerHTML = '';

    // Only show up to 5 page numbers
    const maxPageButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);

    // Adjust start page if we're near the end
    if (endPage - startPage + 1 < maxPageButtons && startPage > 1) {
      startPage = Math.max(1, endPage - maxPageButtons + 1);
    }

    // Add page numbers
    for (let i = startPage; i <= endPage; i++) {
      const pageBtn = document.createElement('button');
      pageBtn.textContent = i;
      pageBtn.classList.add('page-btn');
      if (i === currentPage) {
        pageBtn.classList.add('active');
      }
      pageBtn.addEventListener('click', () => renderScannedTemplates(i));
      pageNumbers.appendChild(pageBtn);
    }

    // Update prev/next buttons
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;

    // Add event listeners to prev/next buttons
    prevBtn.onclick = () => {
      if (currentPage > 1) renderScannedTemplates(currentPage - 1);
    };

    nextBtn.onclick = () => {
      if (currentPage < totalPages) renderScannedTemplates(currentPage + 1);
    };

    // Make section visible
    if (scannedTemplatesSection) {
      scannedTemplatesSection.style.display = 'block';
    }
  }
  
  // Create recent searches section
  function createRecentSearchesSection() {
    const recentSearchesContainer = document.getElementById('recent-searches');
    if (!recentSearchesContainer) return null;

    // If the section has already been configured with collapsible functionality, return
    if (recentSearchesContainer.querySelector('.section-header')) {
      return document.getElementById('recent-list');
    }

    // Replace with new structure that includes collapsible header
    recentSearchesContainer.innerHTML = `
      <div class="section-header collapsible">
          <h3>Recent Searches</h3>
          <button class="toggle-btn"><i class="fas fa-chevron-down"></i></button>
      </div>
      <div class="section-content">
          <ul id="recent-list"></ul>
      </div>
    `;

    // Set up collapsible functionality
    const toggleBtn = recentSearchesContainer.querySelector('.toggle-btn');
    const sectionContent = recentSearchesContainer.querySelector('.section-content');

    toggleBtn.addEventListener('click', () => {
      const isCollapsed = sectionContent.style.display === 'none';
      sectionContent.style.display = isCollapsed ? 'block' : 'none';
      toggleBtn.innerHTML = isCollapsed
        ? '<i class="fas fa-chevron-down"></i>'
        : '<i class="fas fa-chevron-right"></i>';

      // Store preference in localStorage
      localStorage.setItem('td_recent_searches_collapsed', isCollapsed ? 'false' : 'true');
    });

    // Apply stored collapse state
    const isCollapsed = localStorage.getItem('td_recent_searches_collapsed') === 'true';
    if (isCollapsed) {
      sectionContent.style.display = 'none';
      toggleBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    }

    // Return the recent list
    return document.getElementById('recent-list');
  }
  
  // Render recent searches
  function renderRecentSearches() {
    const recentList = createRecentSearchesSection();
    if (!recentList) return;

    recentList.innerHTML = '';
    if (recentSearches.length === 0) {
      recentList.innerHTML = '<li class="no-recents">No recent searches</li>';
      return;
    }
    
    recentSearches.forEach((url) => {
      const li = document.createElement('li');
      const repoName = url.includes('github.com/') ? url.split('github.com/')[1] : url;
      li.innerHTML = `<a href="#" class="recent-item">${repoName}</a>`;
      li.querySelector('a').addEventListener('click', (e) => {
        e.preventDefault();
        if (searchInput) {
          searchInput.value = repoName;
          searchRepos();
        }
      });
      recentList.appendChild(li);
    });
  }
  
  // Update recent searches
  function updateRecentSearches(repoUrl) {
    if (!repoUrl) return;
    recentSearches = recentSearches.filter((url) => url !== repoUrl);
    recentSearches.unshift(repoUrl);
    if (recentSearches.length > 5) {
      recentSearches = recentSearches.slice(0, 5);
    }
    localStorage.setItem('td_recent_searches', JSON.stringify(recentSearches));
    renderRecentSearches();
  }
  
  // Find a template in scanned templates
  function findScannedTemplate(searchTerm) {
    if (!scannedTemplates || scannedTemplates.length === 0) return null;

    // Clean up search term to handle various formats
    let cleanedSearchTerm = searchTerm.trim().toLowerCase();
    
    // If it's a full GitHub URL, extract the repo part
    if (cleanedSearchTerm.includes('github.com/')) {
      cleanedSearchTerm = cleanedSearchTerm.split('github.com/')[1];
    }
    
    // Remove .git suffix if present
    cleanedSearchTerm = cleanedSearchTerm.replace(/\.git$/, '');
    
    console.log('[LegacySearchFix] Searching for template with term:', cleanedSearchTerm);
    
    // First try exact match on repoUrl
    let match = scannedTemplates.find((template) => {
      const repoUrl = (template.repoUrl || '').toLowerCase();
      return repoUrl.includes(`github.com/${cleanedSearchTerm}`) || repoUrl.endsWith(cleanedSearchTerm);
    });
    
    if (match) {
      console.log('[LegacySearchFix] Found exact match by repoUrl:', match.repoUrl);
      return match;
    }
    
    // Try match by name or path
    match = scannedTemplates.find((template) => {
      const name = (template.name || '').toLowerCase();
      const path = (template.relativePath || '').toLowerCase();
      return name === cleanedSearchTerm || path.startsWith(cleanedSearchTerm + '/');
    });
    
    if (match) {
      console.log('[LegacySearchFix] Found match by name or path:', match.name || match.relativePath);
      return match;
    }
    
    // Try partial match in any field
    match = scannedTemplates.find((template) => {
      const repoUrl = (template.repoUrl || '').toLowerCase();
      const name = (template.name || '').toLowerCase();
      const path = (template.relativePath || '').toLowerCase();
      const description = (template.description || '').toLowerCase();
      
      return (
        repoUrl.includes(cleanedSearchTerm) ||
        name.includes(cleanedSearchTerm) ||
        path.includes(cleanedSearchTerm) ||
        description.includes(cleanedSearchTerm)
      );
    });
    
    if (match) {
      console.log('[LegacySearchFix] Found partial match:', match.repoUrl);
      return match;
    }
    
    return null;
  }
  
  // Handle template actions
  function viewTemplateReport(template) {
    // This will be implemented with the report fix
    if (window.ReportLoader && typeof window.ReportLoader.loadReport === 'function') {
      console.log('[LegacySearchFix] Using ReportLoader to load report');
      window.ReportLoader.loadReport(template);
    } else {
      console.warn('[LegacySearchFix] ReportLoader not available');
      alert('Report loading functionality is not available');
    }
  }
  
  function rescanTemplate(template) {
    if (window.TemplateAnalyzer && typeof window.TemplateAnalyzer.analyzeTemplate === 'function') {
      console.log('[LegacySearchFix] Using TemplateAnalyzer to rescan template');
      window.TemplateAnalyzer.analyzeTemplate(template.repoUrl);
    } else {
      console.warn('[LegacySearchFix] TemplateAnalyzer not available');
      alert('Template scanning functionality is not available');
    }
  }
  
  function validateTemplate(template) {
    if (window.TemplateValidator && typeof window.TemplateValidator.validateTemplate === 'function') {
      console.log('[LegacySearchFix] Using TemplateValidator to validate template');
      window.TemplateValidator.validateTemplate(template.repoUrl);
    } else {
      console.warn('[LegacySearchFix] TemplateValidator not available');
      alert('Template validation functionality is not available');
    }
  }
  
  // Highlight a template card when found
  function highlightTemplateCard(templateId) {
    if (!templateId) return;
    
    console.log('[LegacySearchFix] Highlighting template card:', templateId);
    
    // First ensure the scanned templates section is visible
    if (scannedTemplatesSection) {
      scannedTemplatesSection.style.display = 'block';
      
      // Make sure the content is expanded
      const sectionContent = scannedTemplatesSection.querySelector('.section-content');
      const toggleBtn = scannedTemplatesSection.querySelector('.toggle-btn');
      
      if (sectionContent && sectionContent.style.display === 'none') {
        sectionContent.style.display = 'block';
        if (toggleBtn) {
          toggleBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';
        }
        localStorage.setItem('td_templates_collapsed', 'false');
      }
    }
    
    // Find the card
    const card = document.getElementById(templateId);
    if (!card) {
      console.warn('[LegacySearchFix] Template card not found:', templateId);
      return;
    }
    
    // Scroll to the card
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Add highlight animation class
    card.classList.add('highlight-pulse');
    
    // Remove the class after animation completes
    setTimeout(() => {
      card.classList.remove('highlight-pulse');
    }, 3000);
  }
  
  // Main search function
  async function searchRepos() {
    const searchTerm = searchInput.value.trim();
    if (!searchTerm) {
      searchResults.innerHTML = '<div class="no-results">Please enter a search term</div>';
      return;
    }
    
    console.log('[LegacySearchFix] Searching for:', searchTerm);
    
    // First look in scanned templates
    const matchedTemplate = findScannedTemplate(searchTerm);
    if (matchedTemplate) {
      console.log('[LegacySearchFix] Found matching template:', matchedTemplate);
      
      // Update recent searches
      updateRecentSearches(matchedTemplate.repoUrl);
      
      // Clear search results
      searchResults.innerHTML = '';
      
      // Extract template ID
      let templateId = null;
      if (matchedTemplate.relativePath) {
        templateId = `template-${matchedTemplate.relativePath.split('/')[0]}`.replace(/[^a-zA-Z0-9-]/g, '-');
      }
      
      // Highlight the template card
      if (templateId) {
        highlightTemplateCard(templateId);
      } else {
        // If we can't find the template card, show it in search results
        const repoName = matchedTemplate.repoUrl.split('github.com/')[1] || matchedTemplate.repoUrl;
        searchResults.innerHTML = `
          <div class="repo-item" data-repo-url="${matchedTemplate.repoUrl}">
            <div class="repo-name">${repoName}</div>
            <div class="repo-description">${matchedTemplate.description || ''}</div>
            <div class="repo-actions">
              <button class="view-report-btn">View Report</button>
              <button class="rescan-btn">Rescan</button>
            </div>
          </div>
        `;
        
        // Add click handlers
        const viewReportBtn = searchResults.querySelector('.view-report-btn');
        const rescanBtn = searchResults.querySelector('.rescan-btn');
        
        if (viewReportBtn) {
          viewReportBtn.addEventListener('click', () => viewTemplateReport(matchedTemplate));
        }
        
        if (rescanBtn) {
          rescanBtn.addEventListener('click', () => rescanTemplate(matchedTemplate));
        }
      }
      
      return;
    }
    
    // If not found locally, show loading state
    searchResults.innerHTML = '<div class="loading">Searching...</div>';
    
    // Build a GitHub URL if input is not already a full URL
    let repoUrl = searchTerm;
    if (!repoUrl.includes('github.com')) {
      // Check if it's in the format "owner/repo"
      if (repoUrl.includes('/')) {
        repoUrl = `https://github.com/${repoUrl}`;
      } else {
        // It might be just a repo name, we'll search GitHub API
        try {
          if (window.GitHubClient && typeof window.GitHubClient.searchRepositories === 'function') {
            console.log('[LegacySearchFix] Searching GitHub for repositories with name:', searchTerm);
            const repos = await window.GitHubClient.searchRepositories(searchTerm);
            
            if (!repos || repos.length === 0) {
              searchResults.innerHTML = '<div class="no-results">No repositories found</div>';
              return;
            }
            
            // Display the results
            searchResults.innerHTML = '';
            repos.slice(0, 5).forEach(repo => {
              const item = document.createElement('div');
              item.className = 'repo-item';
              item.dataset.repoUrl = repo.html_url;
              
              item.innerHTML = `
                <div class="repo-name">${repo.full_name}</div>
                <div class="repo-description">${repo.description || ''}</div>
                <div class="repo-meta">
                  ${repo.language ? `<div class="repo-language">${repo.language}</div>` : ''}
                  <div class="repo-stars"><i class="far fa-star"></i> ${repo.stargazers_count}</div>
                </div>
                <div class="repo-actions">
                  <button class="scan-btn">Scan</button>
                  <button class="validate-btn">Validate</button>
                </div>
              `;
              
              // Add click handlers
              const scanBtn = item.querySelector('.scan-btn');
              const validateBtn = item.querySelector('.validate-btn');
              
              if (scanBtn) {
                scanBtn.addEventListener('click', () => {
                  if (window.TemplateAnalyzer && typeof window.TemplateAnalyzer.analyzeTemplate === 'function') {
                    window.TemplateAnalyzer.analyzeTemplate(repo.html_url);
                    updateRecentSearches(repo.html_url);
                  } else {
                    console.warn('[LegacySearchFix] TemplateAnalyzer not available');
                    alert('Template scanning functionality is not available');
                  }
                });
              }
              
              if (validateBtn) {
                validateBtn.addEventListener('click', () => {
                  if (window.TemplateValidator && typeof window.TemplateValidator.validateTemplate === 'function') {
                    window.TemplateValidator.validateTemplate(repo.html_url);
                    updateRecentSearches(repo.html_url);
                  } else {
                    console.warn('[LegacySearchFix] TemplateValidator not available');
                    alert('Template validation functionality is not available');
                  }
                });
              }
              
              searchResults.appendChild(item);
            });
            
            return;
          }
        } catch (error) {
          console.error('[LegacySearchFix] Error searching GitHub:', error);
        }
        
        // If GitHub search failed or is not available, treat it as a direct repo URL
        repoUrl = `https://github.com/microsoft/${repoUrl}`;
      }
    }
    
    // If we got here, we're trying to scan a specific repo URL
    console.log('[LegacySearchFix] Using direct repo URL:', repoUrl);
    
    const repoName = repoUrl.includes('github.com/') ? repoUrl.split('github.com/')[1] : repoUrl;
    
    searchResults.innerHTML = `
      <div class="repo-item" data-repo-url="${repoUrl}">
        <div class="repo-name">${repoName}</div>
        <div class="repo-actions">
          <button class="scan-btn">Scan</button>
          <button class="validate-btn">Validate</button>
        </div>
      </div>
    `;
    
    // Add click handlers
    const scanBtn = searchResults.querySelector('.scan-btn');
    const validateBtn = searchResults.querySelector('.validate-btn');
    
    if (scanBtn) {
      scanBtn.addEventListener('click', () => {
        if (window.TemplateAnalyzer && typeof window.TemplateAnalyzer.analyzeTemplate === 'function') {
          window.TemplateAnalyzer.analyzeTemplate(repoUrl);
          updateRecentSearches(repoUrl);
        } else {
          console.warn('[LegacySearchFix] TemplateAnalyzer not available');
          alert('Template scanning functionality is not available');
        }
      });
    }
    
    if (validateBtn) {
      validateBtn.addEventListener('click', () => {
        if (window.TemplateValidator && typeof window.TemplateValidator.validateTemplate === 'function') {
          window.TemplateValidator.validateTemplate(repoUrl);
          updateRecentSearches(repoUrl);
        } else {
          console.warn('[LegacySearchFix] TemplateValidator not available');
          alert('Template validation functionality is not available');
        }
      });
    }
  }
  
  // Set up event handlers
  function setupEventHandlers() {
    // Search button click
    if (searchButton) {
      searchButton.addEventListener('click', searchRepos);
    }
    
    // Search input enter key
    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          searchRepos();
        }
      });
    }
    
    // Add CSS for template highlighting
    const style = document.createElement('style');
    style.textContent = `
      .highlight-pulse {
        animation: pulse-border 3s ease-out;
      }
      
      @keyframes pulse-border {
        0% { box-shadow: 0 0 0 0 rgba(0, 120, 212, 0.7); }
        20% { box-shadow: 0 0 0 20px rgba(0, 120, 212, 0.4); }
        40% { box-shadow: 0 0 0 20px rgba(0, 120, 212, 0.2); }
        60% { box-shadow: 0 0 0 20px rgba(0, 120, 212, 0.1); }
        80% { box-shadow: 0 0 0 20px rgba(0, 120, 212, 0.05); }
        100% { box-shadow: 0 0 0 0 rgba(0, 120, 212, 0); }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Initialize
  function init() {
    console.log('[LegacySearchFix] Initializing...');
    setupEventHandlers();
    loadScannedTemplates();
    renderRecentSearches();
    
    // ReportLoader Fix (to handle the HTML parsing issue)
    window.ReportLoader = window.ReportLoader || {};
    
    // Override or define loadReport to fix parsing issues
    window.ReportLoader.loadReport = function(template) {
      console.log('[LegacySearchFix] Loading report for template:', template);
      
      // Show loading state
      const searchSection = document.getElementById('search-section');
      const analysisSection = document.getElementById('analysis-section');
      const resultsContainer = document.getElementById('results-container');
      const loadingContainer = document.getElementById('loading-container');
      const errorSection = document.getElementById('error-section');
      
      if (searchSection) searchSection.style.display = 'none';
      if (scannedTemplatesSection) scannedTemplatesSection.style.display = 'none';
      if (analysisSection) analysisSection.style.display = 'block';
      if (resultsContainer) resultsContainer.style.display = 'none';
      if (loadingContainer) loadingContainer.style.display = 'flex';
      if (errorSection) errorSection.style.display = 'none';
      
      // Set repo info
      const repoNameEl = document.getElementById('repo-name');
      const repoUrlEl = document.getElementById('repo-url');
      
      if (repoNameEl) repoNameEl.textContent = template.repoUrl.split('github.com/')[1] || template.repoUrl;
      if (repoUrlEl) repoUrlEl.textContent = template.repoUrl;
      
      // Extract the folder name from the template path
      const folderName = template.relativePath ? template.relativePath.split('/')[0] : null;
      
      if (!folderName) {
        console.error('[LegacySearchFix] Error: No folder name could be extracted from template');
        if (loadingContainer) loadingContainer.style.display = 'none';
        if (errorSection) {
          errorSection.style.display = 'block';
          const errorMessage = document.getElementById('error-message');
          if (errorMessage) errorMessage.textContent = 'Could not determine template folder';
        }
        return;
      }
      
      // Determine if we need to prefix the folder with the scanner name
      const lastScanner =
        template.scannedBy && template.scannedBy.length > 0
          ? template.scannedBy[template.scannedBy.length - 1]
          : null;
      
      // Create the folder path with scanner prefix if needed
      const folderPath = lastScanner ? `${lastScanner}-${folderName}` : folderName;
      
      console.log(`[LegacySearchFix] Loading report for ${folderName} from path ${folderPath}`);
      
      // If resultsContainer exists, clear its content
      if (resultsContainer) resultsContainer.innerHTML = '';
      
      // Try direct approach - fetch dashboard.html
      const dashboardPath = `/results/${folderPath}/dashboard.html`;
      console.log(`[LegacySearchFix] Fetching dashboard from: ${dashboardPath}`);
      
      fetch(dashboardPath)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response.text();
        })
        .then(html => {
          console.log(`[LegacySearchFix] Dashboard HTML loaded, length: ${html.length}`);
          
          // Create an iframe to display the dashboard
          if (resultsContainer) {
            // Hide loading
            if (loadingContainer) loadingContainer.style.display = 'none';
            resultsContainer.style.display = 'block';
            
            // Create iframe
            resultsContainer.innerHTML = `
              <iframe id="report-frame" style="width:100%; height:800px; border:none;"></iframe>
            `;
            
            const iframe = document.getElementById('report-frame');
            if (iframe) {
              // Write the HTML content to the iframe
              const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
              iframeDoc.open();
              iframeDoc.write(html);
              iframeDoc.close();
              
              // Fix base URLs in the iframe
              const baseTag = document.createElement('base');
              baseTag.href = `/results/${folderPath}/`;
              iframeDoc.head.insertBefore(baseTag, iframeDoc.head.firstChild);
              
              // Add script to fix report paths
              const fixScript = document.createElement('script');
              fixScript.textContent = `
                // Fix relative URLs in the report
                document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
                  if (link.href.startsWith('./')) {
                    link.href = link.href.replace('./', '/results/${folderPath}/');
                  }
                });
                
                document.querySelectorAll('script[src]').forEach(script => {
                  if (script.src.startsWith('./')) {
                    script.src = script.src.replace('./', '/results/${folderPath}/');
                  }
                });
                
                // Fix history.json loading error
                window.addEventListener('error', function(event) {
                  if (event.message && event.message.includes('Unexpected token')) {
                    console.warn('[Report Fix] Suppressed JSON parse error:', event.message);
                    event.preventDefault();
                    event.stopPropagation();
                  }
                }, true);
              `;
              iframeDoc.head.appendChild(fixScript);
            }
          }
        })
        .catch(error => {
          console.error(`[LegacySearchFix] Error loading dashboard: ${error.message}`);
          
          // Hide loading
          if (loadingContainer) loadingContainer.style.display = 'none';
          
          // Show error
          if (errorSection) {
            errorSection.style.display = 'block';
            const errorMessage = document.getElementById('error-message');
            if (errorMessage) errorMessage.textContent = `Error loading report: ${error.message}`;
          }
        });
    };
    
    console.log('[LegacySearchFix] Initialization complete');
  }
  
  // Run the initialization
  init();
  
})();