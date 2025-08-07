// Main Application Logic for Template Doctor Frontend
// Wires up authentication, search, analysis, and dashboard rendering

// Debug logging utility - consistent with auth.js
function debug(module, message, data) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}][${module}] ${message}`, data !== undefined ? data : '');   
}

// Enhanced debug function for report loading
function debugReport(stage, data) {
    console.group(`REPORT DEBUG - ${stage}`);
    console.log('Data:', data);
    if (data && typeof data === 'object') {
        console.log('Keys:', Object.keys(data));
        console.log('Is empty:', Object.keys(data).length === 0);
        if (data.repoUrl) console.log('RepoUrl:', data.repoUrl);
        if (data.compliance) console.log('Compliance:', data.compliance);
        if (data.timestamp) console.log('Timestamp:', data.timestamp);
        if (data.issues) console.log('Issues count:', data.issues.length);
        if (data.passedRules) console.log('Passed rules count:', data.passedRules.length);
    } else {
        console.log('Invalid data type:', typeof data);
    }
    console.groupEnd();
}

// Simple function to help with debugging
function debugReportData(label, data) {
    console.group(`REPORT DEBUG - ${label}`);
    console.log('Data:', data ? 'present' : 'null/undefined');
    if (data && typeof data === 'object') {
        console.log('Keys:', Object.keys(data));
        console.log('Compliance:', data.compliance ? 'present' : 'missing');
        if (data.compliance) {
            console.log('Issues:', Array.isArray(data.compliance.issues) ? data.compliance.issues.length : 'not an array');
            console.log('Compliant:', Array.isArray(data.compliance.compliant) ? data.compliance.compliant.length : 'not an array');
        }
    }
    console.groupEnd();
}

// Direct data loading function - uses direct loading with a script tag
function directLoadDataFile(folderName, dataFileName, successCallback, errorCallback) {
    // Clear any previous reportData
    window.reportData = null;
    
    console.log(`DIRECT LOAD: Loading /results/${folderName}/${dataFileName}`);
    
    // Create a script element to load the data.js file
    const script = document.createElement('script');
    script.src = `/results/${folderName}/${dataFileName}`; 
    script.id = `data-js-${Date.now()}`;
    script.async = true;
    
    // Set up onload handler
    script.onload = function() {
        console.log(`DIRECT LOAD: Script loaded successfully!`);
        
        // Use a brief timeout to ensure the script has executed
        setTimeout(function() {
            // Check if window.reportData was set by the script
            if (window.reportData) {
                console.log(`DIRECT LOAD: Found window.reportData, calling success callback`);
                debugReportData('DirectLoad Success', window.reportData);
                
                if (typeof successCallback === 'function') {
                    // Make a copy of the data to avoid reference issues
                    const data = JSON.parse(JSON.stringify(window.reportData));
                    successCallback(data);
                }
            } else {
                console.error(`DIRECT LOAD: Script loaded but window.reportData is undefined!`);
                if (typeof errorCallback === 'function') {
                    errorCallback('Data file loaded but did not set window.reportData');
                }
            }
        }, 100); // Small delay to ensure script execution
    };
    
    // Set up error handler
    script.onerror = function(e) {
        console.error(`DIRECT LOAD: Error loading script:`, e);
        if (typeof errorCallback === 'function') {
            errorCallback(`Failed to load data file: ${dataFileName}`);
        }
    };
    
    // Add the script to the document
    document.head.appendChild(script);
    console.log(`DIRECT LOAD: Script tag added to document head with ID ${script.id}`);
}



// Initialize key services
let appAuth, appGithub, appAnalyzer, appDashboard;

// Function to initialize the app with dependencies
function initializeApp() {
    debug('app', 'Application initializing');
    
    // Initialize core services
    appAuth = window.GitHubAuth;
    appGithub = window.GitHubClient;
    appAnalyzer = window.TemplateAnalyzer;
    appDashboard = window.DashboardRenderer;
    
    // Log initialization status
    debug('app', 'Service initialization status', {
        auth: !!appAuth,
        github: !!appGithub,
        analyzer: !!appAnalyzer,
        dashboard: !!appDashboard
    });
    
    if (!appAnalyzer) {
        debug('app', 'Template analyzer not available, waiting for initialization');
    }
}

// Define a local reference to the internal analyzeRepo function that will be defined later
let internalAnalyzeRepo;

// Export analyzeRepo to window object so it can be used by other components
window.analyzeRepo = async function(repoUrl, ruleSet = 'dod') {
    // Call the internal analyzeRepo function with the same parameters
    if (typeof internalAnalyzeRepo === 'function') {
        return internalAnalyzeRepo(repoUrl, ruleSet);
    } else {
        console.error('Internal analyzeRepo function not available yet');
        return null;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Check for auth errors from the callback page
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('auth_error')) {
        debug('app', 'Auth error detected in URL parameters', urlParams.get('auth_error'));
        showAuthError(urlParams.get('auth_error'));
    }
    
    // Check for stored auth errors
    const storedAuthError = sessionStorage.getItem('auth_error');
    if (storedAuthError) {
        debug('app', 'Auth error detected in session storage', storedAuthError);
        showAuthError(storedAuthError);
        sessionStorage.removeItem('auth_error');
    }
    
    // Check if user was redirected after logout due to missing permissions
    if (urlParams.has('require_permissions') && urlParams.has('logged_out')) {
        debug('app', 'User needs to log back in with required permissions');
        // Show notification after a slight delay to ensure the notification system is initialized
        setTimeout(() => {
            if (window.NotificationSystem) {
                window.NotificationSystem.showWarning(
                    'GitHub Permissions Required', 
                    'Please login with GitHub to grant the "public_repo" permission needed to create issues.',
                    10000
                );
            }
        }, 500);
    }
    
    // Initialize app with currently available dependencies
    initializeApp();

    // UI elements
    const searchInput = document.getElementById('repo-search');
    const searchButton = document.getElementById('search-button');
    const searchResults = document.getElementById('search-results');
    let recentList; // Will be initialized in createRecentSearchesSection
    const analysisSection = document.getElementById('analysis-section');
    const resultsContainer = document.getElementById('results-container');
    const loadingContainer = document.getElementById('loading-container');
    const backButton = document.getElementById('back-button');
    const errorSection = document.getElementById('error-section');
    const errorMessage = document.getElementById('error-message');
    const errorBackButton = document.getElementById('error-back-button');
    
    // Create elements for scanned templates section
    const searchSection = document.getElementById('search-section');
    let scannedTemplatesSection;
    let templateGrid;

    // State
    let recentSearches = JSON.parse(localStorage.getItem('td_recent_searches') || '[]');
    let scannedTemplates = [];
    
    // --- Scanned Templates Functionality ---
    function loadScannedTemplates() {
        // Check if window.templatesData exists (loaded from results/index-data.js)
        if (window.templatesData) {
            debug('app', 'Loading scanned templates from index-data.js', window.templatesData.length);
            scannedTemplates = window.templatesData;
            renderScannedTemplates();
            return true;
        } else {
            debug('app', 'No scanned templates found');
            return false;
        }
    }

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
                toggleBtn.innerHTML = isCollapsed ? 
                    '<i class="fas fa-chevron-down"></i>' : 
                    '<i class="fas fa-chevron-right"></i>';
                
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

    // Add these variables for pagination
    let currentPage = 1;
    const templatesPerPage = 6;
    
    function renderScannedTemplates(page = 1) {
        createScannedTemplatesSection();
        
        if (!templateGrid) return;
        
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
        currentTemplates.forEach(template => {
            const repoName = template.repoUrl.split('github.com/')[1] || template.repoUrl;
            const templateId = `template-${template.relativePath.split('/')[0]}`.replace(/[^a-zA-Z0-9-]/g, '-');
            
            // Get ruleset information from template, default to "DoD" if not available
            const ruleSet = template.ruleSet || 'dod';
            const ruleSetDisplay = ruleSet === 'dod' ? 'DoD' : (ruleSet === 'partner' ? 'Partner' : 'Custom');
            
            // Check for gistUrl in custom rulesets
            let gistUrl = '';
            if (ruleSet === 'custom' && template.customConfig && template.customConfig.gistUrl) {
                gistUrl = template.customConfig.gistUrl;
            }
            
            // Get the last scanner from the scannedBy array
            const lastScanner = template.scannedBy && template.scannedBy.length > 0 ? 
                template.scannedBy[template.scannedBy.length - 1] : 'Unknown';
            
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
                    ${ruleSet === 'custom' && gistUrl ? 
                        `<a href="${gistUrl}" target="_blank" class="ruleset-badge ${ruleSet}-badge" title="View custom ruleset on GitHub">
                            ${ruleSetDisplay} <i class="fas fa-external-link-alt fa-xs"></i>
                         </a>` : 
                        `<div class="ruleset-badge ${ruleSet}-badge">${ruleSetDisplay}</div>`
                    }
                    <div class="compliance-bar">
                        <div class="compliance-fill" style="width: ${template.compliance.percentage}%"></div>
                        <span class="compliance-value">${template.compliance.percentage}%</span>
                    </div>
                    <div class="stats">
                        <div class="stat-item issues">
                            <i class="fas fa-exclamation-triangle"></i>
                            ${(() => {
                                // Get the template name from relativePath (first part before the slash)
                                const templateName = template.relativePath ? template.relativePath.split('/')[0] : null;
                                // Get the latest scanner (last in the scannedBy array)
                                const latestScanner = template.scannedBy && template.scannedBy.length > 0 ? 
                                    template.scannedBy[template.scannedBy.length - 1] : null;
                                
                                if (templateName && latestScanner) {
                                    return `<a href="https://github.com/${latestScanner}/${templateName}/issues" target="_blank" 
                                        class="issues-link" title="View issues for ${templateName} by ${latestScanner}">
                                        ${template.compliance.issues} issues <i class="fas fa-external-link-alt fa-xs"></i>
                                    </a>`;
                                } else {
                                    return `<span>${template.compliance.issues} issues</span>`;
                                }
                            })()}
                        </div>
                        <div class="stat-item passed">
                            <i class="fas fa-check-circle"></i>
                            <span>${template.compliance.passed} passed</span>
                        </div>
                    </div>
                </div>
                <div class="card-footer">
                    <button class="view-report-btn">View Report</button>
                    <button class="rescan-btn">Rescan</button>
                </div>
            `;
            
            // Add click handlers
            card.querySelector('.view-report-btn').addEventListener('click', () => {
                // Instead of opening in a new tab, load the report and render it inline
                debug('app', `Loading report for template: ${template.relativePath}`);
                
                // Show loading state
                document.getElementById('search-section').style.display = 'none';
                if (scannedTemplatesSection) scannedTemplatesSection.style.display = 'none';
                analysisSection.style.display = 'block';
                resultsContainer.style.display = 'none';
                loadingContainer.style.display = 'flex';
                errorSection.style.display = 'none';
                
                // Set repo info
                document.getElementById('repo-name').textContent = template.repoUrl.split('github.com/')[1] || template.repoUrl;
                document.getElementById('repo-url').textContent = template.repoUrl;
                
                // Extract the folder name from the template path
                let folderName = template.relativePath ? template.relativePath.split('/')[0] : null;
                
                if (!folderName) {
                    debug('app', 'Error: No folder name could be extracted from template');
                    loadingContainer.style.display = 'none';
                    errorSection.style.display = 'block';
                    errorMessage.textContent = 'Could not determine template folder';
                    return;
                }
                
                // Determine if we need to prefix the folder with the scanner name
                const lastScanner = template.scannedBy && template.scannedBy.length > 0 ? 
                    template.scannedBy[template.scannedBy.length - 1] : null;
                
                // Create the folder path with scanner prefix if needed
                const folderPath = lastScanner ? `${lastScanner}-${folderName}` : folderName;
                
                console.log(`HANDLER: Loading report for ${folderName} from path ${folderPath}`);
                
                // First, try to load latest.json to find the current data file
                const latestJsonPath = `/results/${folderPath}/latest.json`;
                console.log(`HANDLER: Fetching latest.json from: ${latestJsonPath}`);
                
                // Clear any existing reportData
                resultsContainer.innerHTML = '';
                
                fetch(latestJsonPath)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }
                        return response.json();
                    })
                    .then(latestData => {
                        console.log(`HANDLER: Loaded latest.json:`, latestData);
                        
                        if (latestData && latestData.dataPath) {
                            console.log(`HANDLER: Found dataPath in latest.json: ${latestData.dataPath}`);
                            
                            // DISPLAY RAW DATA APPROACH: Use a direct fetch to get the data
                            const dataUrl = `/results/${folderPath}/${latestData.dataPath}`;
                            console.log(`Loading data from: ${dataUrl}`);
                            
                            // First display a message to show we're trying
                            loadingContainer.style.display = 'none';
                            resultsContainer.style.display = 'block';
                            resultsContainer.innerHTML = `
                                <div style="padding: 20px; background: #f8f9fa; border-radius: 5px; margin-bottom: 20px;">
                                    <h3>Template Report</h3>
                                    <div style="display: flex; justify-content: center; margin: 20px 0;">
                                        <button id="show-full-report-btn" style="padding: 10px 20px; background: #0078d4; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px;">
                                            Show full report
                                        </button>
                                    </div>
                                    <div class="raw-data-section" style="margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px;">
                                        <h4>Raw Data</h4>
                                        <p>Data source: <code>${dataUrl}</code></p>
                                        <div id="raw-data-container">Loading...</div>
                                    </div>
                                </div>
                            `;
                            
                            // Try to load via script tag
                            const scriptTag = document.createElement('script');
                            scriptTag.src = dataUrl;
                            
                            // When script loads, immediately display the data
                            scriptTag.onload = function() {
                                console.log("Script loaded! Window.reportData:", window.reportData);
                                
                                const rawDataContainer = document.getElementById('raw-data-container');
                                const showFullReportBtn = document.getElementById('show-full-report-btn');
                                
                                // Check if data is available
                                if (window.reportData) {
                                    // Display raw JSON
                                    rawDataContainer.innerHTML = `
                                        <pre style="background: #333; color: #fff; padding: 10px; border-radius: 5px; max-height: 400px; overflow: auto;">${JSON.stringify(window.reportData, null, 2)}</pre>
                                    `;
                                    
                                    // Add click handler for the show full report button
                                    if (showFullReportBtn) {
                                        showFullReportBtn.addEventListener('click', function() {
                                            try {
                                                // Get the data and ensure it's properly structured
                                                let data = JSON.parse(JSON.stringify(window.reportData));
                                                
                                                // Ensure compliance structure exists
                                                if (!data.compliance) {
                                                    data.compliance = {};
                                                }
                                                
                                                // Ensure compliance issues array exists
                                                if (!Array.isArray(data.compliance.issues)) {
                                                    // If issues don't exist, create an empty array
                                                    data.compliance.issues = [];
                                                }
                                                
                                                // Ensure there's a repoUrl
                                                if (!data.repoUrl) {
                                                    data.repoUrl = window.location.href;
                                                }
                                                
                                                // Clear the container
                                                resultsContainer.innerHTML = '';
                                                
                                                // Try to render
                                                appDashboard.render(data, resultsContainer);
                                                
                                                // Scroll to the top of the analysis section
                                                analysisSection.scrollIntoView({ behavior: 'smooth' });
                                            } catch (error) {
                                                resultsContainer.innerHTML = `<div style="padding: 20px; background: #f8d7da; color: #721c24; border-radius: 5px;">
                                                    <h3>Render Error</h3>
                                                    <p>Error rendering dashboard: ${error.message}</p>
                                                    <pre>${error.stack}</pre>
                                                </div>`;
                                            }
                                        });
                                    }
                                } else {
                                    rawDataContainer.innerHTML = `
                                        <div style="padding: 15px; background: #f8d7da; color: #721c24; border-radius: 5px;">
                                            <h4>Error: No Data Found</h4>
                                            <p>The script loaded but window.reportData is not defined!</p>
                                        </div>
                                    `;
                                    
                                    // Disable the show full report button
                                    if (showFullReportBtn) {
                                        showFullReportBtn.disabled = true;
                                        showFullReportBtn.style.backgroundColor = '#cccccc';
                                        showFullReportBtn.style.cursor = 'not-allowed';
                                    }
                                }
                            };
                            
                            // Handle load errors
                            scriptTag.onerror = function(error) {
                                console.error("Script loading error:", error);
                                const rawDataContainer = document.getElementById('raw-data-container');
                                
                                // Try alternative approach - fetch the content
                                rawDataContainer.innerHTML = `
                                    <div style="padding: 15px; background: #fff3cd; color: #856404; border-radius: 5px; margin-bottom: 15px;">
                                        <h4>Script loading failed</h4>
                                        <p>Trying alternative approach (fetch)...</p>
                                    </div>
                                `;
                                
                                // Try to fetch the content directly
                                fetch(dataUrl)
                                    .then(response => {
                                        rawDataContainer.innerHTML += `
                                            <div style="margin-bottom: 10px;">
                                                <strong>Fetch status:</strong> ${response.status} ${response.statusText}
                                            </div>
                                        `;
                                        return response.text();
                                    })
                                    .then(content => {
                                        // Show the raw file content
                                        rawDataContainer.innerHTML += `
                                            <h4>Raw file content:</h4>
                                            <pre style="background: #333; color: #fff; padding: 10px; border-radius: 5px; max-height: 300px; overflow: auto;">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
                                        `;
                                    })
                                    .catch(fetchError => {
                                        rawDataContainer.innerHTML += `
                                            <div style="padding: 15px; background: #f8d7da; color: #721c24; border-radius: 5px;">
                                                <h4>Fetch Error</h4>
                                                <p>${fetchError.message}</p>
                                            </div>
                                        `;
                                    });
                            };
                            
                            // Add the script to the document
                            document.head.appendChild(scriptTag);
                        } else {
                            throw new Error('No dataPath found in latest.json');
                        }
                    })
                    .catch(error => {
                        console.error(`HANDLER: Error in fetch process: ${error.message}`);
                        loadingContainer.style.display = 'none';
                        errorSection.style.display = 'block';
                        errorMessage.textContent = `Error loading report: ${error.message}`;
                        
                        // Try to load report with ReportLoader instead
                        if (window.ReportLoader) {
                            console.log(`HANDLER: Falling back to ReportLoader`);
                            // Add folderName and folderPath to template object for better context
                            const templateWithFolder = { ...template, folderName: folderName, folderPath: folderPath };
                            console.log(`HANDLER: Template object for ReportLoader:`, templateWithFolder);
                            
                            window.ReportLoader.loadReportData(
                                templateWithFolder,
                                (result) => {
                                    // Success callback
                                    loadingContainer.style.display = 'none';
                                    resultsContainer.style.display = 'block';
                                    
                                    console.log(`HANDLER: ReportLoader SUCCESS callback received:`, result);
                                    debugReport('Report Data Loaded via ReportLoader', result);
                                    
                                    if (!result || typeof result !== 'object' || Object.keys(result).length === 0) {
                                        console.warn(`HANDLER: Empty/invalid data from ReportLoader`);
                                        debug('app', 'WARNING: Report data is empty or invalid');
                                        loadingContainer.style.display = 'none';
                                        errorSection.style.display = 'block';
                                        errorMessage.textContent = 'Report data is empty or invalid. This could be due to a missing data.js file.';
                                        return;
                                    }
                                    
                                    debug('app', 'Report loaded successfully via ReportLoader, rendering dashboard', result);
                                    appDashboard.render(result, resultsContainer);
                                    
                                    // Scroll to the top of the analysis section
                                    analysisSection.scrollIntoView({ behavior: 'smooth' });
                                },
                                (errorMsg) => {
                                    // Error callback
                                    console.error(`HANDLER: ReportLoader ERROR callback received: ${errorMsg}`);
                                    debug('app', `Error loading report: ${errorMsg}`);
                                    loadingContainer.style.display = 'none';
                                    errorSection.style.display = 'block';
                                    errorMessage.textContent = errorMsg || 'An unknown error occurred loading the report';
                                }
                            );
                        } else {
                            debug('app', 'Report loader not available');
                            loadingContainer.style.display = 'none';
                            errorSection.style.display = 'block';
                            errorMessage.textContent = 'Report loader not initialized. Please reload the page and try again.';
                        }
            });
            });
            
            card.querySelector('.rescan-btn').addEventListener('click', () => {
                // Show ruleset selection modal
                internalAnalyzeRepo(template.repoUrl, 'show-modal');
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

    // --- Search Functionality ---
    function updateRecentSearches(repoUrl) {
        if (!repoUrl) return;
        recentSearches = recentSearches.filter(url => url !== repoUrl);
        recentSearches.unshift(repoUrl);
        if (recentSearches.length > 5) recentSearches = recentSearches.slice(0, 5);
        localStorage.setItem('td_recent_searches', JSON.stringify(recentSearches));
        renderRecentSearches();
    }

    function createRecentSearchesSection() {
        const recentSearchesContainer = document.getElementById('recent-searches');
        if (!recentSearchesContainer) return;
        
        // If the section has already been configured with collapsible functionality, return
        if (recentSearchesContainer.querySelector('.section-header')) return;
        
        // Store the original content
        const originalContent = recentSearchesContainer.innerHTML;
        
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
            toggleBtn.innerHTML = isCollapsed ? 
                '<i class="fas fa-chevron-down"></i>' : 
                '<i class="fas fa-chevron-right"></i>';
            
            // Store preference in localStorage
            localStorage.setItem('td_recent_searches_collapsed', isCollapsed ? 'false' : 'true');
        });
        
        // Apply stored collapse state
        const isCollapsed = localStorage.getItem('td_recent_searches_collapsed') === 'true';
        if (isCollapsed) {
            sectionContent.style.display = 'none';
            toggleBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        }
        
        // Update the reference to the recent list
        recentList = document.getElementById('recent-list');
    }

    function renderRecentSearches() {
        createRecentSearchesSection();
        
        recentList.innerHTML = '';
        if (recentSearches.length === 0) {
            recentList.innerHTML = '<li>No recent searches.</li>';
            return;
        }
        recentSearches.forEach(url => {
            const li = document.createElement('li');
            li.innerHTML = `<a href="#">${url}</a>`;
            li.querySelector('a').addEventListener('click', e => {
                e.preventDefault();
                // Set the search input value
                searchInput.value = url;
                // Trigger search which will find and scroll to the template if it exists
                searchRepos();
            });
            recentList.appendChild(li);
        });
    }
    
    // Search for a repo in the scanned templates
    function findScannedTemplate(searchTerm) {
        if (!scannedTemplates || scannedTemplates.length === 0) return null;
        
        // Clean up search term to handle various formats
        searchTerm = searchTerm.toLowerCase().trim();
        
        // Get only the repo name part, focusing on the last segment
        let repoNameToSearch = searchTerm;
        
        // Handle full URLs with protocol
        if (searchTerm.includes('/')) {
            // Get the last part of the URL or path which is the repo name
            const parts = searchTerm.split('/');
            repoNameToSearch = parts[parts.length - 1].replace('.git', '');
        }
        
        debug('app', `Searching for template with repo name: ${repoNameToSearch} (from: ${searchTerm})`);
        
        // Search through templates, focusing on the repo name
        let match = scannedTemplates.find(template => {
            const repoUrl = template.repoUrl.toLowerCase();
            
            // Extract just the repo name (last part of the URL)
            const parts = repoUrl.split('/');
            const templateRepoName = parts[parts.length - 1].replace('.git', '');
            
            // Try exact match on repo name
            return templateRepoName === repoNameToSearch;
        });
        
        // If no exact repo name match, try matching against the full repository identifier (owner/repo)
        if (!match && searchTerm.includes('/')) {
            match = scannedTemplates.find(template => {
                const repoUrl = template.repoUrl.toLowerCase();
                
                // Extract owner/repo part if this is a GitHub URL
                let ownerRepo = '';
                if (repoUrl.includes('github.com/')) {
                    ownerRepo = repoUrl.split('github.com/')[1] || '';
                    ownerRepo = ownerRepo.replace(/\/$|\.git$/g, '');
                }
                
                // Try matching against the owner/repo part
                if (searchTerm.includes('github.com/')) {
                    const searchOwnerRepo = searchTerm.split('github.com/')[1].replace(/\/$|\.git$/g, '');
                    return ownerRepo === searchOwnerRepo;
                } else {
                    // If search term might be just owner/repo format
                    return ownerRepo === searchTerm.replace(/\/$|\.git$/g, '');
                }
            });
        }
        
        // Last resort: try partial matching on the repo name
        if (!match) {
            match = scannedTemplates.find(template => {
                const repoUrl = template.repoUrl.toLowerCase();
                const parts = repoUrl.split('/');
                const templateRepoName = parts[parts.length - 1].replace('.git', '');
                
                return templateRepoName.includes(repoNameToSearch);
            });
        }
        
        if (match) {
            debug('app', `Found matching template:`, match);
        } else {
            debug('app', `No matching template found for repo: ${repoNameToSearch}`);
        }
        
        return match;
    }

    async function searchRepos() {
        const query = searchInput.value.trim();
        if (!query) return;
        searchResults.innerHTML = '<div>Searching...</div>';
        
        // First check if this matches an already scanned template
        const matchedTemplate = findScannedTemplate(query);
        if (matchedTemplate) {
            searchResults.innerHTML = '';
            
            // Create result for the matched template
            const div = document.createElement('div');
            div.className = 'repo-item previously-scanned';
            
            const repoName = matchedTemplate.repoUrl.split('github.com/')[1] || matchedTemplate.repoUrl;
            const templateId = `template-${matchedTemplate.relativePath.split('/')[0]}`.replace(/[^a-zA-Z0-9-]/g, '-');
            
            div.innerHTML = `
                <div>
                    <div class="repo-name" data-tooltip="${repoName}" class="has-permanent-tooltip">
                        ${repoName}
                        <span class="scanned-badge">Previously Scanned</span>
                    </div>
                    <div class="repo-description">This repository has already been scanned</div>
                </div>
                <div class="action-buttons">
                    <button class="view-report-btn">View Report</button>
                    <button class="rescan-btn">Rescan</button>
                </div>
            `;
            
            div.querySelector('.view-report-btn').addEventListener('click', () => {
                // Instead of opening in a new tab, load the report and render it inline
                debug('app', `Loading report for template: ${matchedTemplate.relativePath}`);
                
                // Show loading state
                document.getElementById('search-section').style.display = 'none';
                if (scannedTemplatesSection) scannedTemplatesSection.style.display = 'none';
                analysisSection.style.display = 'block';
                resultsContainer.style.display = 'none';
                loadingContainer.style.display = 'flex';
                errorSection.style.display = 'none';
                
                // Set repo info
                document.getElementById('repo-name').textContent = matchedTemplate.repoUrl.split('github.com/')[1] || matchedTemplate.repoUrl;
                document.getElementById('repo-url').textContent = matchedTemplate.repoUrl;
                
                // Use the ReportLoader to load the data
                if (window.ReportLoader) {
                    window.ReportLoader.loadReportData(
                        matchedTemplate,
                        (result) => {
                            // Success callback
                            loadingContainer.style.display = 'none';
                            resultsContainer.style.display = 'block';
                            
                            debug('app', 'Report loaded successfully, rendering dashboard', result);
                            appDashboard.render(result, resultsContainer);
                            
                            // Scroll to the top of the analysis section
                            analysisSection.scrollIntoView({ behavior: 'smooth' });
                        },
                        (errorMsg) => {
                            // Error callback
                            debug('app', `Error loading report: ${errorMsg}`);
                            loadingContainer.style.display = 'none';
                            errorSection.style.display = 'block';
                            errorMessage.textContent = errorMsg || 'An unknown error occurred loading the report';
                        }
                    );
                } else {
                    debug('app', 'Report loader not available');
                    loadingContainer.style.display = 'none';
                    errorSection.style.display = 'block';
                    errorMessage.textContent = 'Report loader not initialized. Please reload the page and try again.';
                }
                
                scrollAndHighlightTemplate(templateId);
            });
            
            div.querySelector('.rescan-btn').addEventListener('click', () => {
                internalAnalyzeRepo(matchedTemplate.repoUrl);
            });
            
            searchResults.appendChild(div);
            
            // Scroll to the template card and highlight it
            scrollAndHighlightTemplate(templateId);
            highlightRescanButton(templateId);
            
            return;
        }
        
        // If not found in scanned templates, proceed with GitHub API search
        try {
            const res = await appGithub.searchRepositories(query, 1, 10);
            if (!res.items || res.items.length === 0) {
                // No repositories found in GitHub search, but allow analyzing if it looks like a repo URL
                if (query.includes('github.com/') || query.includes('/')) {
                    // This could be a direct repository URL or owner/repo format
                    let repoUrl = query;
                    
                    // If it's in owner/repo format, convert to GitHub URL
                    if (!repoUrl.includes('github.com/') && repoUrl.includes('/')) {
                        repoUrl = `https://github.com/${repoUrl}`;
                    } else if (!repoUrl.startsWith('http')) {
                        repoUrl = `https://github.com/${repoUrl}`;
                    }
                    
                    searchResults.innerHTML = `
                        <div class="repo-item not-found">
                            <div>
                                <div class="repo-name">${repoUrl}</div>
                                <div class="repo-description">This repository hasn't been analyzed before</div>
                            </div>
                            <div class="action-buttons">
                                <button class="analyze-btn">Analyze Repository</button>
                            </div>
                        </div>
                    `;
                    
                    searchResults.querySelector('.analyze-btn').addEventListener('click', () => {
                        internalAnalyzeRepo(repoUrl, 'show-modal');
                    });
                } else {
                    searchResults.innerHTML = '<div>No repositories found.</div>';
                }
                return;
            }
            
            searchResults.innerHTML = '';
            res.items.forEach(repo => {
                const div = document.createElement('div');
                div.className = 'repo-item';
                
                // Check if this repo was previously scanned
                const previouslyScanneIndex = scannedTemplates.findIndex(t => 
                    t.repoUrl.includes(repo.full_name) || 
                    repo.html_url.includes(t.repoUrl.split('github.com/')[1]));
                
                const isPreviouslyScanned = previouslyScanneIndex !== -1;
                
                if (isPreviouslyScanned) {
                    div.classList.add('previously-scanned');
                }
                
                // Check if it belongs to the authenticated user
                const isUserRepo = repo.owner.login === appGithub.currentUser?.login;
                
                div.innerHTML = `
                    <div>
                        <div class="repo-name" data-tooltip="${repo.full_name}" class="has-permanent-tooltip">
                            ${repo.full_name}
                            ${isPreviouslyScanned ? '<span class="scanned-badge">Previously Scanned</span>' : ''}
                        </div>
                        <div class="repo-description" data-tooltip="${repo.description || ''}" class="has-permanent-tooltip">${repo.description || ''}</div>
                    </div>
                    <div class="action-buttons">
                        ${isPreviouslyScanned ? 
                            `<button class="view-report-btn" data-index="${previouslyScanneIndex}">View Report</button>` : 
                            ''}
                        <button class="analyze-btn">${isPreviouslyScanned ? 'Rescan' : (isUserRepo ? 'Scan Template' : 'Fork and Scan Template')}</button>
                    </div>
                `;
                
                div.querySelector('.analyze-btn').addEventListener('click', () => {
                    if (isUserRepo || isPreviouslyScanned) {
                        internalAnalyzeRepo(repo.html_url, 'show-modal');
                    } else {
                        // Would need to implement fork functionality
                        if (confirm(`This will fork ${repo.full_name} to your account before scanning. Continue?`)) {
                            // For now, just analyze without forking
                            internalAnalyzeRepo(repo.html_url, 'show-modal');
                        }
                    }
                });
                
                if (isPreviouslyScanned) {
                    div.querySelector('.view-report-btn').addEventListener('click', (e) => {
                        const index = parseInt(e.target.getAttribute('data-index'));
                        const template = scannedTemplates[index];
                        
                        // Instead of opening in a new tab, load the report and render it inline
                        debug('app', `Loading report for template: ${template.relativePath}`);
                        
                        // Show loading state
                        document.getElementById('search-section').style.display = 'none';
                        if (scannedTemplatesSection) scannedTemplatesSection.style.display = 'none';
                        analysisSection.style.display = 'block';
                        resultsContainer.style.display = 'none';
                        loadingContainer.style.display = 'flex';
                        errorSection.style.display = 'none';
                        
                        // Set repo info
                        document.getElementById('repo-name').textContent = template.repoUrl.split('github.com/')[1] || template.repoUrl;
                        document.getElementById('repo-url').textContent = template.repoUrl;
                        
                        // Use the ReportLoader to load the data
                        if (window.ReportLoader) {
                            window.ReportLoader.loadReportData(
                                template,
                                (result) => {
                                    // Success callback
                                    loadingContainer.style.display = 'none';
                                    resultsContainer.style.display = 'block';
                                    
                                    debug('app', 'Report loaded successfully, rendering dashboard', result);
                                    appDashboard.render(result, resultsContainer);
                                    
                                    // Scroll to the top of the analysis section
                                    analysisSection.scrollIntoView({ behavior: 'smooth' });
                                },
                                (errorMsg) => {
                                    // Error callback
                                    debug('app', `Error loading report: ${errorMsg}`);
                                    loadingContainer.style.display = 'none';
                                    errorSection.style.display = 'block';
                                    errorMessage.textContent = errorMsg || 'An unknown error occurred loading the report';
                                }
                            );
                        } else {
                            debug('app', 'Report loader not available');
                            loadingContainer.style.display = 'none';
                            errorSection.style.display = 'block';
                            errorMessage.textContent = 'Report loader not initialized. Please reload the page and try again.';
                        }
                        
                        // Also scroll to the template card and highlight it
                        const templateId = `template-${template.relativePath.split('/')[0]}`.replace(/[^a-zA-Z0-9-]/g, '-');
                        scrollAndHighlightTemplate(templateId);
                    });
                }
                
                searchResults.appendChild(div);
                
                // If this repo was previously scanned, highlight the template
                if (isPreviouslyScanned) {
                    const template = scannedTemplates[previouslyScanneIndex];
                    const templateId = `template-${template.relativePath.split('/')[0]}`.replace(/[^a-zA-Z0-9-]/g, '-');
                    scrollAndHighlightTemplate(templateId);
                    highlightRescanButton(templateId);
                }
            });
        } catch (err) {
            searchResults.innerHTML = `<div>Error: ${err.message}</div>`;
        }
    }
    
    function scrollAndHighlightTemplate(templateId) {
        const templateElement = document.getElementById(templateId);
        if (templateElement) {
            // Make sure the template section is visible and expanded
            if (scannedTemplatesSection) {
                scannedTemplatesSection.style.display = 'block';
                
                // Make sure section content is visible (not collapsed)
                const sectionContent = scannedTemplatesSection.querySelector('.section-content');
                if (sectionContent && sectionContent.style.display === 'none') {
                    // Expand the section
                    sectionContent.style.display = 'block';
                    
                    // Update toggle button
                    const toggleBtn = scannedTemplatesSection.querySelector('.toggle-btn');
                    if (toggleBtn) {
                        toggleBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';
                    }
                    
                    // Update localStorage to reflect expanded state
                    localStorage.setItem('td_templates_collapsed', 'false');
                }
            }
            
            // Find which page the template is on and switch to that page
            const allTemplateCards = document.querySelectorAll('.template-card');
            const templateIndex = Array.from(allTemplateCards).findIndex(card => card.id === templateId);
            
            if (templateIndex !== -1) {
                const targetPage = Math.floor(templateIndex / templatesPerPage) + 1;
                if (targetPage !== currentPage) {
                    renderScannedTemplates(targetPage);
                }
            }
            
            // Scroll to the element with smooth behavior
            setTimeout(() => {
                // First scroll the section into view
                scannedTemplatesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                
                // Then after a short delay, scroll to the specific template
                setTimeout(() => {
                    templateElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    // Add highlight class for blinking border
                    templateElement.classList.add('highlight-template');
                    
                    // Remove highlight after animation completes
                    setTimeout(() => {
                        templateElement.classList.remove('highlight-template');
                    }, 4000);
                }, 600);
            }, 300); // Small delay to ensure DOM is ready
        }
    }
    
    function highlightRescanButton(templateId) {
        const templateElement = document.getElementById(templateId);
        if (templateElement) {
            const rescanButton = templateElement.querySelector('.rescan-btn');
            if (rescanButton) {
                // Add highlight class for blinking effect
                rescanButton.classList.add('highlight-button');
                
                // Remove highlight after animation completes
                setTimeout(() => {
                    rescanButton.classList.remove('highlight-button');
                }, 4000);
            }
        }
    }

    // --- Analysis Flow ---
    // Define the internal analyzeRepo function and store a reference to it
    internalAnalyzeRepo = async function(repoUrl, ruleSet = 'dod') {
        // First verify we have necessary modules initialized
        if (!appAnalyzer || !appDashboard) {
            debug('app', 'Required services not available, attempting to reinitialize');
            
            // Try to reinitialize all services
            const servicesAvailable = tryReinitializeServices();
            
            if (!servicesAvailable) {
                if (window.NotificationSystem) {
                    window.NotificationSystem.showError(
                        'Services Not Ready',
                        'Some required services are not available. Please wait a moment or refresh the page to try again.',
                        5000
                    );
                }
                debug('app', 'Required services still unavailable after reinitialization attempt');
                return;
            }
        }
        
        // Double-check analyzer
        if (!appAnalyzer) {
            debug('app', 'Template analyzer still not available after reinitialization');
            
            if (window.NotificationSystem) {
                window.NotificationSystem.showWarning(
                    'Initializing Analyzer',
                    'Template analyzer is initializing. Your request will be processed shortly.',
                    5000
                );
            }
            
            // Wait a moment and try again
            setTimeout(() => {
                if (window.TemplateAnalyzer) {
                    appAnalyzer = window.TemplateAnalyzer;
                    internalAnalyzeRepo(repoUrl, ruleSet);  // Retry the analysis
                } else {
                    if (window.NotificationSystem) {
                        window.NotificationSystem.showError(
                            'Analyzer Not Available',
                            'Could not initialize the analyzer. Please refresh the page and try again.',
                            5000
                        );
                    }
                }
            }, 1500);
            return;
        }

        // Show ruleset configuration modal
        if (ruleSet === 'show-modal') {
            debug('app', 'Showing ruleset configuration modal');
            showRuleSetModal(repoUrl);
            return;
        }

        // Check for custom ruleset configuration in local storage
        if (ruleSet === 'custom') {
            const customConfig = localStorage.getItem('td_custom_ruleset');
            if (customConfig) {
                try {
                    const parsedConfig = JSON.parse(customConfig);
                    // Set the custom config in the analyzer
                    if (appAnalyzer.ruleSetConfigs) {
                        appAnalyzer.ruleSetConfigs.custom = parsedConfig;
                    }
                } catch (e) {
                    debug('app', 'Failed to parse custom ruleset config', e);
                    if (window.NotificationSystem) {
                        window.NotificationSystem.showError(
                            'Custom Configuration Error',
                            'Failed to load custom configuration. Using default DoD ruleset instead.',
                            5000
                        );
                    }
                    // Fall back to DoD ruleset
                    ruleSet = 'dod';
                }
            } else {
                debug('app', 'No custom ruleset configuration found, using default DoD');
                if (window.NotificationSystem) {
                    window.NotificationSystem.showWarning(
                        'No Custom Configuration',
                        'No custom configuration found. Using default DoD ruleset instead.',
                        5000
                    );
                }
                // Fall back to DoD ruleset
                ruleSet = 'dod';
            }
        }
        
        // UI state
        document.getElementById('search-section').style.display = 'none';
        analysisSection.style.display = 'block';
        resultsContainer.style.display = 'none';
        loadingContainer.style.display = 'flex';
        errorSection.style.display = 'none';
        
        // Set repo info
        const repoName = repoUrl.split('github.com/')[1] || repoUrl;
        document.getElementById('repo-name').textContent = repoName;
        document.getElementById('repo-url').textContent = repoUrl;
        
        // Save to recent
        updateRecentSearches(repoUrl);
        
        // Notify user that analysis is starting
        if (window.NotificationSystem) {
            const ruleSetDisplayName = ruleSet === 'dod' ? 'DoD' : (ruleSet === 'partner' ? 'Partner' : 'Custom');
            window.NotificationSystem.showInfo(
                'Analysis Started',
                `Analyzing repository: ${repoName} with ${ruleSetDisplayName} ruleset`,
                3000
            );
        }
        
        try {
            debug('app', `Starting analysis of repo: ${repoUrl} with ruleset: ${ruleSet}`);
            const result = await appAnalyzer.analyzeTemplate(repoUrl, ruleSet);
            
            loadingContainer.style.display = 'none';
            resultsContainer.style.display = 'block';
            
            debug('app', 'Analysis complete, rendering dashboard');
            appDashboard.render(result, resultsContainer);
            
            // Submit analysis results to GitHub for PR creation
            if (window.submitAnalysisToGitHub && window.GitHubClient?.auth?.isAuthenticated()) {
                try {
                    // Get current username
                    const username = window.GitHubClient.auth.getUsername();
                    
                    if (username) {
                        debug('app', `Submitting analysis to GitHub with username: ${username}`);
                        
                        const submitResult = await window.submitAnalysisToGitHub(result, username);
                        
                        if (submitResult.success) {
                            debug('app', 'Analysis submitted successfully to GitHub');
                            if (window.NotificationSystem) {
                                window.NotificationSystem.showSuccess(
                                    'Analysis Submitted',
                                    'Your analysis has been submitted for integration into the repository',
                                    5000
                                );
                            }
                        } else {
                            debug('app', `Error submitting analysis: ${submitResult.error}`);
                            if (window.NotificationSystem) {
                                const errorMessage = submitResult.details ? 
                                    `${submitResult.error} ${submitResult.details}` : 
                                    submitResult.error;
                                
                                const helpLink = document.createElement('div');
                                helpLink.style.marginTop = '10px';
                                helpLink.innerHTML = `
                                    <a href="/docs/GITHUB_ACTION_SETUP.md" target="_blank" style="color: #0078d4; text-decoration: underline;">
                                        View GitHub Action setup guide
                                    </a>
                                `;
                                
                                window.NotificationSystem.showWarning(
                                    'Submission Issue',
                                    `Analysis completed but could not be submitted: ${errorMessage}`,
                                    10000,
                                    helpLink
                                );
                            }
                        }
                    }
                } catch (submitErr) {
                    debug('app', `Error in GitHub submission: ${submitErr.message}`, submitErr);
                    
                    // Show an error notification with help link
                    if (window.NotificationSystem) {
                        const helpLink = document.createElement('div');
                        helpLink.style.marginTop = '10px';
                        helpLink.innerHTML = `
                            <a href="/docs/GITHUB_ACTION_SETUP.md" target="_blank" style="color: #0078d4; text-decoration: underline;">
                                View GitHub Action setup guide
                            </a>
                        `;
                        
                        window.NotificationSystem.showWarning(
                            'Submission Error',
                            `Failed to submit analysis: ${submitErr.message}`,
                            10000,
                            helpLink
                        );
                    }
                }
            }
            
        } catch (err) {
            debug('app', `Error analyzing repo: ${err.message}`, err);
            loadingContainer.style.display = 'none';
            errorSection.style.display = 'block';
            errorMessage.textContent = err.message || 'An unknown error occurred during analysis';
        }
    }

    // Function to show ruleset configuration modal
    function showRuleSetModal(repoUrl) {
        // Use the showRulesetModal function from ruleset-modal.js
        if (window.showRulesetModal) {
            window.showRulesetModal(repoUrl);
        } else {
            console.error("showRulesetModal function not found. Is ruleset-modal.js loaded?");
            // Fallback to direct analysis if modal doesn't work
            internalAnalyzeRepo(repoUrl, 'dod');
        }
    }

    // --- Event Listeners ---
    if (searchButton) searchButton.addEventListener('click', searchRepos);
    if (searchInput) searchInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') searchRepos();
    });
    if (backButton) backButton.addEventListener('click', () => {
        // Go back to search section and clear results
        analysisSection.style.display = 'none';
        document.getElementById('search-section').style.display = 'block';
        resultsContainer.innerHTML = '';
        
        // Make sure the scanned templates section is visible and up to date
        if (window.templatesData && window.templatesData.length > 0) {
            loadScannedTemplates(); // This will render the templates
            
            // Make sure the scanned templates section is visible
            if (scannedTemplatesSection) {
                scannedTemplatesSection.style.display = 'block';
            }
        }
    });
    if (errorBackButton) errorBackButton.addEventListener('click', () => {
        // Go back from error view to search section
        errorSection.style.display = 'none';
        analysisSection.style.display = 'none';
        document.getElementById('search-section').style.display = 'block';
        
        // Make sure the scanned templates section is visible and up to date
        if (window.templatesData && window.templatesData.length > 0) {
            loadScannedTemplates(); // This will render the templates
            
            // Make sure the scanned templates section is visible
            if (scannedTemplatesSection) {
                scannedTemplatesSection.style.display = 'block';
            }
        }
    });

    // --- Auth Error Handling ---
    function showAuthError(errorMessage) {
        const welcomeSection = document.getElementById('welcome-section');
        if (welcomeSection) {
            // Create an error message element
            const errorDiv = document.createElement('div');
            errorDiv.className = 'auth-error';
            errorDiv.innerHTML = `
                <div class="alert alert-danger">
                    <strong>Authentication Error:</strong> ${errorMessage}
                    <button class="close-btn">&times;</button>
                </div>
            `;
            
            // Add close button functionality
            errorDiv.querySelector('.close-btn').addEventListener('click', () => {
                errorDiv.style.display = 'none';
            });
            
            // Add it to the welcome section
            welcomeSection.prepend(errorDiv);
        }
    }
    
    // --- Initial Render ---
    createRecentSearchesSection();
    renderRecentSearches();
    
    // Try loading scanned templates
    if (!loadScannedTemplates()) {
        // If templates are not immediately available, wait for the event
        document.addEventListener('template-data-loaded', function() {
            debug('app', 'Template data loaded event received');
            loadScannedTemplates();
        });
    }
    
    debug('app', 'Application initialized');
});

// Function to attempt to reinitialize all required services
function tryReinitializeServices() {
    debug('app', 'Attempting to reinitialize services');
    
    // Update all service references
    appAuth = window.GitHubAuth;
    appGithub = window.GitHubClient;
    appAnalyzer = window.TemplateAnalyzer;
    appDashboard = window.DashboardRenderer;
    
    // Check if analyzer exists now
    if (!appAnalyzer && window.checkAnalyzerReady) {
        debug('app', 'Calling checkAnalyzerReady to initialize analyzer');
        window.checkAnalyzerReady();
        appAnalyzer = window.TemplateAnalyzer;
    }
    
    // Log updated status
    debug('app', 'Services after reinitialization attempt', {
        auth: !!appAuth,
        github: !!appGithub,
        analyzer: !!appAnalyzer,
        dashboard: !!appDashboard
    });
    
    // Return true if all essential services are available
    return !!appAnalyzer && !!appGithub && !!appDashboard;
}

// Listen for the analyzer initialization event
document.addEventListener('template-analyzer-ready', () => {
    debug('app', 'Template analyzer ready event received');
    
    // Update the analyzer reference
    appAnalyzer = window.TemplateAnalyzer;
    
    if (appAnalyzer) {
        debug('app', 'Template analyzer successfully initialized');
        if (window.NotificationSystem) {
            window.NotificationSystem.showSuccess(
                'Analyzer Ready',
                'Template analyzer is now initialized and ready to use',
                3000
            );
        }
    } else {
        debug('app', 'Template analyzer still not available after ready event');
    }
});
