// Dashboard Renderer - Handles rendering of compliance reports
// Uses IIFE pattern to avoid global namespace pollution

console.log('Loading dashboard-renderer.js - initializing renderer');

// Check if CSS files are loaded properly
document.addEventListener('DOMContentLoaded', function() {
    const allStylesheets = document.styleSheets;
    console.log(`Found ${allStylesheets.length} stylesheets:`);
    for (let i = 0; i < allStylesheets.length; i++) {
        try {
            console.log(`  - ${allStylesheets[i].href}`);
        } catch (e) {
            console.log(`  - Unable to access stylesheet #${i}`);
        }
    }
    
    // Check specifically for dashboard.css
    let dashboardCssFound = false;
    for (let i = 0; i < allStylesheets.length; i++) {
        try {
            if (allStylesheets[i].href && allStylesheets[i].href.includes('dashboard.css')) {
                dashboardCssFound = true;
                console.log('dashboard.css found and loaded!');
                break;
            }
        } catch (e) {}
    }
    
    if (!dashboardCssFound) {
        console.warn('dashboard.css not found in loaded stylesheets!');
    }
});

// Only create if not already defined
(function() {
    // If DashboardRenderer already exists, don't redefine it
    if (window.DashboardRenderer !== undefined) {
        console.log('DashboardRenderer already exists, skipping initialization');
        return;
    }

    // Create a renderer function
    function DashboardRendererClass() {
        // Debug utility
        this.debug = function(message, data) {
            if (typeof window.debug === 'function') {
                window.debug('dashboard-renderer', message, data);
            } else {
                console.log(`[DashboardRenderer] ${message}`, data !== undefined ? data : '');
            }
        };
        
        this.debug('Dashboard renderer initialized');

        /**
         * Renders the analysis results dashboard
         * @param {Object} result - The analysis result data
         * @param {HTMLElement} container - The container element to render into
         */
        this.render = function(result, container) {
            this.debug('Rendering dashboard', result);
            
            if (!result || !container) {
                console.error('Missing result data or container element');
                container.innerHTML = `
                    <div style="padding: 20px; background: #f8d7da; border-radius: 5px; margin: 20px 0; color: #721c24;">
                        <h3>Error: Cannot render dashboard</h3>
                        <p>Missing required data or container element</p>
                        <pre style="background: #f5f5f5; padding: 10px; border-radius: 3px;">${JSON.stringify({
                            resultExists: !!result,
                            containerExists: !!container,
                            resultType: result ? typeof result : 'undefined',
                            containerType: container ? typeof container : 'undefined'
                        }, null, 2)}</pre>
                    </div>
                `;
                return;
            }

            try {
                // Clear the container
                container.innerHTML = '';
                
                // First, add the action buttons at the top with explicit inline styles
                const actionHtml = `
                    <div id="action-section" class="action-footer action-header" style="background: white !important; border-radius: 5px !important; padding: 16px !important; margin-bottom: 20px !important; box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important; display: flex !important; flex-direction: column !important; justify-content: center !important; align-items: center !important; width: 100% !important;">
                        <div style="width: 100% !important; text-align: center !important; margin-bottom: 15px !important;">
                            <h3 style="margin: 0 !important; padding: 0 !important; font-size: 1.2rem !important; color: #333 !important;">Template Doctor Actions</h3>
                        </div>
                        <div style="display: flex !important; flex-wrap: wrap !important; justify-content: center !important; gap: 15px !important; width: 100% !important;">
                            <a href="#" id="fixButton" class="btn" 
                               style="opacity: 1 !important; visibility: visible !important; padding: 12px 24px !important; background-color: #0078d4 !important; color: white !important; border: none !important; border-radius: 4px !important; font-size: 1rem !important; font-weight: 500 !important; cursor: pointer !important; display: inline-flex !important; align-items: center !important; gap: 8px !important; min-width: 180px !important; justify-content: center !important; text-decoration: none !important; pointer-events: auto !important;">
                                <i class="fas fa-code"></i> Fix with AI Agent
                            </a>
                            <button id="create-github-issue-btn" class="btn"
                                    style="opacity: 1 !important; visibility: visible !important; padding: 12px 24px !important; background-color: #2b3137 !important; color: white !important; border: none !important; border-radius: 4px !important; font-size: 1rem !important; font-weight: 500 !important; cursor: pointer !important; display: inline-flex !important; align-items: center !important; gap: 8px !important; min-width: 180px !important; justify-content: center !important; pointer-events: auto !important;">
                                <i class="fab fa-github"></i> Create GitHub Issue
                            </button>
                            <button id="testProvisionButton" class="btn"
                                    style="opacity: 1 !important; visibility: visible !important; padding: 12px 24px !important; background-color: #0078d4 !important; color: white !important; border: none !important; border-radius: 4px !important; font-size: 1rem !important; font-weight: 500 !important; cursor: pointer !important; display: inline-flex !important; align-items: center !important; gap: 8px !important; min-width: 180px !important; justify-content: center !important; pointer-events: auto !important;">
                                <i class="fas fa-rocket"></i> Test AZD Provision
                            </button>
                        </div>
                    </div>
                `;
                
                // Add the action section to the container
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = actionHtml;
                const actionSection = tempDiv.firstElementChild;
                container.appendChild(actionSection);
                
                // Now add the debug section after the action buttons
                const debugSection = document.createElement('div');
                debugSection.className = 'debug-section';
                debugSection.style.cssText = 'margin-bottom: 30px; padding: 15px; background: #f8f9fa; border-radius: 5px; border: 1px solid #ddd;';
                debugSection.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h3 style="margin: 0;">Template Analysis Report</h3>
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <span style="color: #6c757d; font-size: 0.9em; font-style: italic;">Developer Tools</span>
                            <button id="toggle-raw-data" class="btn" style="padding: 5px 10px; font-size: 0.9em;">
                                <i class="fas fa-code"></i> Raw Data
                            </button>
                        </div>
                    </div>
                    <div id="raw-data-content" style="display: none; margin-top: 15px;">
                        <div style="background: #2d2d2d; color: #eee; padding: 10px; border-radius: 5px; font-size: 0.9em; margin-bottom: 10px;">
                            <i class="fas fa-info-circle"></i> This is the raw report data used to generate the dashboard.
                        </div>
                        <pre style="background: #2d2d2d; color: #eee; padding: 15px; border-radius: 5px; max-height: 400px; overflow: auto; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 13px;">${JSON.stringify(result, null, 2)}</pre>
                    </div>
                `;
                container.appendChild(debugSection);
                
                // Add toggle functionality
                setTimeout(() => {
                    const toggleBtn = document.getElementById('toggle-raw-data');
                    const rawContent = document.getElementById('raw-data-content');
                    if (toggleBtn && rawContent) {
                        toggleBtn.addEventListener('click', function() {
                            if (rawContent.style.display === 'none') {
                                rawContent.style.display = 'block';
                                toggleBtn.innerHTML = '<i class="fas fa-times"></i> Hide Raw Data';
                                toggleBtn.style.backgroundColor = '#dc3545';
                                toggleBtn.style.color = 'white';
                            } else {
                                rawContent.style.display = 'none';
                                toggleBtn.innerHTML = '<i class="fas fa-code"></i> Raw Data';
                                toggleBtn.style.backgroundColor = '';
                                toggleBtn.style.color = '';
                            }
                        });
                    }
                }, 100);
                
                // Adapt result data to the format needed for rendering
                const adaptedData = this.adaptResultData(result);
                window.reportData = adaptedData; // Store for GitHub issue creation
                
                // Create overview section
                this.renderOverview(adaptedData, container);
                
                // Create issues section
                this.renderIssuesPanel(adaptedData, container);
                
                // Create passed checks section
                this.renderPassedPanel(adaptedData, container);
                
                // Create action buttons footer
                this.renderActionFooter(adaptedData, container);
                
                // Add event listeners for expandable sections
                this.addEventListeners(container);
            } catch (error) {
                console.error('Error rendering dashboard:', error);
                container.innerHTML = `
                    <div style="padding: 20px; background: #f8d7da; border-radius: 5px; margin: 20px 0; color: #721c24;">
                        <h3>Dashboard Rendering Error</h3>
                        <p>${error.message}</p>
                        <pre style="background: #f5f5f5; padding: 10px; border-radius: 3px;">${error.stack}</pre>
                        <h4 style="margin-top: 20px;">Raw Data</h4>
                        <pre style="background: #f5f5f5; padding: 10px; border-radius: 3px; max-height: 300px; overflow: auto;">${JSON.stringify(result, null, 2)}</pre>
                    </div>
                `;
            }
        };

        /**
         * Adapts the result data from the API format to the format expected by the rendering functions
         * @param {Object} result - The original result data
         * @returns {Object} - The adapted data
         */
        this.adaptResultData = function(result) {
            console.log("Adapting data format:", result);
            
            // Separate issues and compliant items
            const issues = [];
            const compliant = [];
            
            // Handle the new data format where issues are directly in result.compliance.issues
            if (result.compliance && Array.isArray(result.compliance.issues)) {
                // Direct issues array format (newer format)
                result.compliance.issues.forEach(issue => {
                    issues.push({
                        id: issue.id || `issue-${issues.length}`,
                        category: issue.id ? issue.id.split('-')[0] : 'general',
                        message: issue.message || 'Unknown issue',
                        error: issue.error || issue.message || 'No details available',
                        details: {},
                    });
                });
                
                // If there are compliant items in the result
                if (result.compliance.compliant && Array.isArray(result.compliance.compliant)) {
                    result.compliance.compliant.forEach(item => {
                        compliant.push({
                            id: item.id || `passed-${compliant.length}`,
                            category: item.id ? item.id.split('-')[0] : 'general',
                            message: item.message || 'Passed check',
                            error: '',
                            details: {},
                        });
                    });
                }
            }
            // Handle the older format with categories and checks
            else if (result.categories && Array.isArray(result.categories)) {
                result.categories.forEach(category => {
                    if (category.checks && Array.isArray(category.checks)) {
                        category.checks.forEach(check => {
                            // Convert each check to the expected format
                            const item = {
                                id: `${category.id}-${check.id}`,
                                category: category.id,
                                message: check.name,
                                error: check.details || check.description,
                                details: {},
                            };
                            
                            if (check.status === 'passed') {
                                compliant.push(item);
                            } else {
                                issues.push(item);
                            }
                        });
                    }
                });
            }
            
            // Calculate compliance percentage
            const totalChecks = issues.length + compliant.length;
            const percentageCompliant = totalChecks > 0 
                ? Math.round((compliant.length / totalChecks) * 100) 
                : 0;
                
            // Add meta item with compliance details
            compliant.push({
                category: 'meta',
                message: 'Compliance Summary',
                details: {
                    percentageCompliant: percentageCompliant,
                    totalChecks: totalChecks,
                    passedChecks: compliant.length,
                    issuesCount: issues.length
                }
            });
            
            // Create the adapted result data object
            return {
                repoUrl: result.repoUrl || window.location.href,
                compliance: {
                    issues: issues,
                    compliant: compliant,
                    summary: `${percentageCompliant}% compliant`
                },
                totalIssues: issues.length,
                totalPassed: compliant.length
            };
        };
        
        /**
         * Renders the overview section with compliance scores
         * @param {Object} data - The adapted result data
         * @param {HTMLElement} container - The container element to render into
         */
        this.renderOverview = function(data, container) {
            const overviewSection = document.createElement('section');
            overviewSection.className = 'overview';
            
            const compliancePercentage = data.compliance.compliant.find(item => item.category === 'meta')?.details?.percentageCompliant || 0;
            
            overviewSection.innerHTML = `
                <h2>Compliance Overview</h2>
                <p class="overview-text">
                    This dashboard provides an overview for your Azure template compliance status with the 'Azure Developer CLI Template Framework' <a href="https://github.com/Azure-Samples/azd-template-artifacts/blob/main/docs/development-guidelines/definition-of-done.md" title="Definition of Done">Definition of Done</a>. Browse the list below to
                    fix specific issues or use the AI agent to automatically fix all compliance issues in VS Code.
                </p>
                <p>For more information about compliance and collections, go here <a href="https://github.com/Azure-Samples/azd-template-artifacts">Azure Developer CLI Template Framework Docs</a></p>
                <div class="compliance-gauge">
                    <div class="gauge-fill" id="complianceGauge" style="width: ${compliancePercentage}%; background-position: ${compliancePercentage}% 0;"></div>
                    <div class="gauge-label" id="compliancePercentage">${compliancePercentage}%</div>
                </div>
                
                <div class="overview-tiles">
                    <div class="tile tile-issues">
                        <div class="tile-icon">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <div class="tile-value" id="issuesCount">${data.totalIssues}</div>
                        <div class="tile-title">Issues Found</div>
                    </div>
                    
                    <div class="tile tile-passed">
                        <div class="tile-icon">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <div class="tile-value" id="passedCount">${data.totalPassed - 1}</div>
                        <div class="tile-title">Passed Checks</div>
                    </div>
                    
                    <div class="tile tile-trend">
                        <div class="tile-header">
                            <div class="tile-icon">
                                <i class="fas fa-chart-line"></i>
                            </div>
                            <div class="tile-title">Compliance Trend</div>
                        </div>
                        <div id="trendChart" class="trend-chart">
                            <div class="no-data-message">Not enough historical data available yet.</div>
                        </div>
                    </div>
                </div>
            `;
            
            container.appendChild(overviewSection);
        };
        
        /**
         * Renders the issues panel with all failed checks
         * @param {Object} data - The adapted result data
         * @param {HTMLElement} container - The container element to render into
         */
        this.renderIssuesPanel = function(data, container) {
            const issuesPanel = document.createElement('section');
            issuesPanel.className = 'panel';
            issuesPanel.id = 'issuesPanel';
            
            // Auto-expand the issues panel if there are issues
            if (data.compliance.issues.length > 0) {
                issuesPanel.classList.add('panel-open');
            }
            
            issuesPanel.innerHTML = `
                <div class="panel-header">
                    <div class="panel-title">
                        <i class="fas fa-exclamation-circle"></i>
                        <span>Issues</span>
                    </div>
                    <i class="fas fa-chevron-down panel-toggle"></i>
                </div>
                <div class="panel-body">
                    <div class="panel-content">
                        <ul class="item-list" id="issuesList">
                            ${this.renderIssueItems(data.compliance.issues)}
                        </ul>
                    </div>
                </div>
            `;
            
            container.appendChild(issuesPanel);
        };
        
        /**
         * Renders the passed checks panel
         * @param {Object} data - The adapted result data
         * @param {HTMLElement} container - The container element to render into
         */
        this.renderPassedPanel = function(data, container) {
            const passedPanel = document.createElement('section');
            passedPanel.className = 'panel';
            passedPanel.id = 'passedPanel';
            
            // Auto-expand the passed panel if there are no issues
            if (data.compliance.issues.length === 0) {
                passedPanel.classList.add('panel-open');
            }
            
            // Filter out the meta item
            const passedItems = data.compliance.compliant.filter(item => item.category !== 'meta');
            
            passedPanel.innerHTML = `
                <div class="panel-header">
                    <div class="panel-title">
                        <i class="fas fa-check-circle"></i>
                        <span>Passed Checks</span>
                    </div>
                    <i class="fas fa-chevron-down panel-toggle"></i>
                </div>
                <div class="panel-body">
                    <div class="panel-content">
                        <ul class="item-list" id="passedList">
                            ${this.renderPassedItems(passedItems)}
                        </ul>
                    </div>
                </div>
            `;
            
            container.appendChild(passedPanel);
        };
        
        /**
         * Renders HTML for issue items
         * @param {Array} issues - Array of issue objects
         * @returns {string} HTML for issue items
         */
        this.renderIssueItems = function(issues) {
            if (!issues || issues.length === 0) {
                return '<li class="item"><div class="item-message">No issues found. Great job!</div></li>';
            }
            
            return issues.map(issue => {
                // Determine the category display name
                let category;
                if (issue.id.includes('missing-file')) {
                    category = 'Missing File';
                } else if (issue.id.includes('missing-folder')) {
                    category = 'Missing Folder';
                } else if (issue.id.includes('missing-workflow')) {
                    category = 'Missing Workflow';
                } else if (issue.id.includes('missing-doc')) {
                    category = 'Missing Documentation';
                } else if (issue.id.includes('readme')) {
                    category = 'README Issue';
                } else if (issue.id.includes('bicep')) {
                    category = 'Bicep Issue';
                } else if (issue.id.includes('azure-yaml')) {
                    category = 'Azure YAML Issue';
                } else {
                    category = 'General Issue';
                }
                
                // Generate a fix hint based on the issue type
                let fixHint;
                if (issue.id.includes('missing-file') || issue.id.includes('missing-folder')) {
                    fixHint = `Create the missing ${issue.id.includes('file') ? 'file' : 'folder'} in your repository.`;
                } else if (issue.id.includes('missing-workflow')) {
                    fixHint = "Add the required workflow file to your .github/workflows directory.";
                } else if (issue.id.includes('readme')) {
                    fixHint = "Update your README.md with the required headings and content.";
                } else if (issue.id.includes('bicep')) {
                    fixHint = "Add the missing resources to your Bicep files.";
                } else if (issue.id.includes('azure-yaml')) {
                    fixHint = "Update your azure.yaml file to include required sections.";
                } else {
                    fixHint = "Review the issue details and make appropriate changes.";
                }
                
                return `
                    <li class="item issue-item">
                        <div class="item-header">
                            <div class="item-title">${issue.message}</div>
                            <div class="item-category">${category}</div>
                        </div>
                        <div class="item-message">${issue.error || issue.message}</div>
                        <div class="item-details">
                            <strong>How to fix:</strong> ${fixHint}
                        </div>
                        <div class="item-actions">
                            <a href="#" 
                               class="item-link"
                               onclick="return openEditorWithFile(event, '${issue.id}')">
                                <i class="fas fa-external-link-alt"></i> Fix in editor
                            </a>
                            <a href="#"
                               class="item-link"
                               style="margin-left: 15px;"
                               onclick="return createSingleIssue(event, '${issue.id}')">
                                <i class="fab fa-github"></i> Create issue
                            </a>
                        </div>
                    </li>
                `;
            }).join('');
        };
        
        /**
         * Renders HTML for passed items
         * @param {Array} passedItems - Array of passed item objects
         * @returns {string} HTML for passed items
         */
        this.renderPassedItems = function(passedItems) {
            if (!passedItems || passedItems.length === 0) {
                return '<li class="item"><div class="item-message">No passed checks yet.</div></li>';
            }
            
            return passedItems.map(item => {
                // Format category for display
                const categoryDisplay = item.category
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/^./, str => str.toUpperCase());
                
                let detailsHtml = '';
                if (item.details && Object.keys(item.details).length > 0) {
                    detailsHtml = '<div class="item-details">';
                    
                    for (const [key, value] of Object.entries(item.details)) {
                        // Skip displaying arrays if they're too long
                        if (Array.isArray(value) && value.length > 3) {
                            detailsHtml += `<div><strong>${key}:</strong> ${value.length} items</div>`;
                        } else if (typeof value === 'object' && value !== null) {
                            detailsHtml += `<div><strong>${key}:</strong> ${JSON.stringify(value)}</div>`;
                        } else {
                            detailsHtml += `<div><strong>${key}:</strong> ${value}</div>`;
                        }
                    }
                    
                    detailsHtml += '</div>';
                }
                
                return `
                    <li class="item passed-item">
                        <div class="item-header">
                            <div class="item-title">${item.message}</div>
                            <div class="item-category">${categoryDisplay}</div>
                        </div>
                        ${detailsHtml}
                    </li>
                `;
            }).join('');
        };
        
        /**
         * Renders the action footer with buttons
         * @param {Object} data - The adapted result data
         * @param {HTMLElement} container - The container element to render into
         */
        this.renderActionFooter = function(data, container) {
            console.log('renderActionFooter called');
            this.debug('Setting up action buttons from renderActionFooter');
            
            // We don't need to create another action footer at the bottom
            // since we've already added one at the top
            
            // Instead, we'll just set up the button handlers for the
            // action footer we created at the top
            
            // Generate a prompt for the agent based on issues
            const agentPrompt = this.generateAgentPrompt(data);
            
            // Set up action buttons
            this.setupActionButtons(data);
            
            // Let's check if our action header is visible
            const actionHeader = document.querySelector('.action-header');
            if (actionHeader) {
                console.log('Action header is in the DOM');
                console.log('Action header styles:', window.getComputedStyle(actionHeader));
            } else {
                console.warn('Action header not found in the DOM!');
            }
        };
        
        /**
         * Generate an intelligent prompt for the agent
         * @param {Object} data - The adapted result data
         * @returns {string} - The generated prompt
         */
        this.generateAgentPrompt = function(data) {
            const issues = data.compliance.issues;
            const compliancePercentage = data.compliance.compliant.find(item => item.category === 'meta')?.details?.percentageCompliant || 0;
            
            // Create a concise bulleted list format for the agent
            let prompt = `Fix Azure Template Compliance Issues (${compliancePercentage}%)\n\n`;
            
            // Keep a flat list of all issues for cleaner bullet points
            if (issues.length === 0) {
                prompt += "• No issues found! The template is fully compliant.";
                return prompt;
            }
            
            // Add header for issues
            prompt += `Issues that need fixing:\n\n`;
            
            // Add all issues as bullet points
            issues.forEach(issue => {
                let issueText = issue.message;
                // Extract file/folder names when available
                if (issue.id.includes('missing-file')) {
                    const fileName = issue.message.match(/Missing required file: (.+)/)?.[1] || issue.message;
                    prompt += `• Create file: ${fileName}\n`;
                } else if (issue.id.includes('missing-folder')) {
                    const folderName = issue.message.match(/Missing required folder: (.+)/)?.[1] || issue.message;
                    prompt += `• Create folder: ${folderName}\n`;
                } else if (issue.id.includes('missing-workflow')) {
                    prompt += `• ${issue.message}\n`;
                } else if (issue.id.includes('readme')) {
                    prompt += `• ${issue.message}\n`;
                } else if (issue.id.includes('bicep')) {
                    prompt += `• ${issue.message}\n`;
                } else if (issue.id.includes('azure-yaml')) {
                    prompt += `• ${issue.message}\n`;
                } else {
                    prompt += `• ${issue.message}\n`;
                }
            });
            
            // Add reference to standards
            prompt += `\nPlease fix these issues following Azure template best practices.`;
            
            return prompt;
        };
        
        /**
         * Setup event listeners for action buttons
         * @param {Object} data - The adapted result data
         */
        this.setupActionButtons = function(data) {
            this.debug('Setting up action buttons');
            
            setTimeout(() => {
                try {
                    this.debug('Setting up action buttons with delay');
                    
                    // Fix with AI Agent button
                    const fixButton = document.getElementById('fixButton');
                    if (fixButton) {
                        this.debug('Found fixButton - setting up');
                        
                        // Remove any existing event listeners by cloning and replacing
                        const newFixButton = fixButton.cloneNode(true);
                        if (fixButton.parentNode) {
                            fixButton.parentNode.replaceChild(newFixButton, fixButton);
                        }
                        
                        // Ensure the button is visible and clickable
                        newFixButton.style.opacity = '1 !important';
                        newFixButton.style.visibility = 'visible !important';
                        newFixButton.style.pointerEvents = 'auto !important';
                        newFixButton.style.cursor = 'pointer !important';
                        newFixButton.style.display = 'inline-flex !important';
                        
                        // Update the fix button URL with the Azure template URL format
                        const templateUrl = encodeURIComponent(data.repoUrl);
                        newFixButton.href = `https://insiders.vscode.dev/azure?azdTemplateUrl=${templateUrl}`;
                        this.debug(`Set fix button URL to: ${newFixButton.href}`);
                        
                        // Add a direct click handler
                        newFixButton.addEventListener('click', function(e) {
                            e.preventDefault();
                            console.log("Fix button clicked");
                            window.open(`https://insiders.vscode.dev/azure?azdTemplateUrl=${templateUrl}`, '_blank');
                        });
                    } else {
                        this.debug('fixButton not found! Will try to create one');
                        
                        // Try to find the action section to add a button
                        const actionSection = document.querySelector('.action-header') || document.getElementById('action-section');
                        if (actionSection && actionSection.querySelector('div:last-child')) {
                            const buttonContainer = document.createElement('div');
                            buttonContainer.innerHTML = `
                                <a href="#" id="fixButton-dynamic" class="btn" 
                                   style="opacity: 1 !important; visibility: visible !important; padding: 12px 24px !important; background-color: #0078d4 !important; color: white !important; border: none !important; border-radius: 4px !important; font-size: 1rem !important; font-weight: 500 !important; cursor: pointer !important; display: inline-flex !important; align-items: center !important; gap: 8px !important; min-width: 180px !important; justify-content: center !important; text-decoration: none !important; pointer-events: auto !important;">
                                    <i class="fas fa-code"></i> Fix with AI Agent
                                </a>
                            `;
                            
                            const dynamicFixButton = buttonContainer.firstElementChild;
                            actionSection.querySelector('div:last-child').appendChild(dynamicFixButton);
                            
                            // Set up the button
                            const templateUrl = encodeURIComponent(data.repoUrl);
                            dynamicFixButton.href = `https://insiders.vscode.dev/azure?azdTemplateUrl=${templateUrl}`;
                            
                            dynamicFixButton.addEventListener('click', function(e) {
                                e.preventDefault();
                                console.log("Dynamic fix button clicked");
                                window.open(`https://insiders.vscode.dev/azure?azdTemplateUrl=${templateUrl}`, '_blank');
                            });
                            
                            this.debug('Created dynamic fix button');
                        }
                    }
                    
                    // Create GitHub Issue button
                    const createIssueButton = document.getElementById('create-github-issue-btn');
                    if (createIssueButton) {
                        this.debug('Found createIssueButton - setting up');
                        
                        // Remove any existing event listeners by cloning and replacing
                        const newCreateIssueButton = createIssueButton.cloneNode(true);
                        if (createIssueButton.parentNode) {
                            createIssueButton.parentNode.replaceChild(newCreateIssueButton, createIssueButton);
                        }
                        
                        // Ensure the button is visible and clickable
                        newCreateIssueButton.style.opacity = '1 !important';
                        newCreateIssueButton.style.visibility = 'visible !important';
                        newCreateIssueButton.style.pointerEvents = 'auto !important';
                        newCreateIssueButton.style.cursor = 'pointer !important';
                        newCreateIssueButton.style.display = 'inline-flex !important';
                        
                        // Add direct click handler
                        newCreateIssueButton.addEventListener('click', function() {
                            console.log("Create GitHub Issue button clicked");
                            if (typeof window.createGitHubIssue === 'function') {
                                window.createGitHubIssue();
                            } else {
                                alert("GitHub issue creation is not available in this view");
                            }
                        });
                    }
                    
                    // Test AZD Provision button
                    const testProvisionButton = document.getElementById('testProvisionButton');
                    if (testProvisionButton) {
                        this.debug('Found testProvisionButton - setting up');
                        
                        // Remove any existing event listeners by cloning and replacing
                        const newTestProvisionButton = testProvisionButton.cloneNode(true);
                        if (testProvisionButton.parentNode) {
                            testProvisionButton.parentNode.replaceChild(newTestProvisionButton, testProvisionButton);
                        }
                        
                        // Ensure the button is visible and clickable
                        newTestProvisionButton.style.opacity = '1 !important';
                        newTestProvisionButton.style.visibility = 'visible !important';
                        newTestProvisionButton.style.pointerEvents = 'auto !important';
                        newTestProvisionButton.style.cursor = 'pointer !important';
                        newTestProvisionButton.style.display = 'inline-flex !important';
                        
                        // Add direct click handler
                        newTestProvisionButton.addEventListener('click', function() {
                            console.log("Test AZD Provision button clicked");
                            if (typeof window.testAzdProvision === 'function') {
                                window.testAzdProvision();
                            } else {
                                alert("AZD provision testing is not available in this view");
                            }
                        });
                    }
                    
                    // Log all interactive elements after setup
                    const allButtons = document.querySelectorAll('button, a.btn');
                    this.debug(`After setup: Found ${allButtons.length} total interactive elements`);
                    allButtons.forEach((btn, idx) => {
                        this.debug(`Button #${idx}: id=${btn.id}, visible=${btn.style.visibility}, clickable=${btn.style.pointerEvents}`);
                    });
                    
                } catch (e) {
                    console.error('Error setting up action buttons:', e);
                }
            }, 200); // Small delay to ensure DOM is ready
        };
        
        /**
         * Adds event listeners to expandable sections
         * @param {HTMLElement} container - The container element
         */
        this.addEventListeners = function(container) {
            // Setup panel toggle functionality
            container.querySelectorAll('.panel-header').forEach(header => {
                header.addEventListener('click', () => {
                    const panel = header.parentElement;
                    panel.classList.toggle('panel-open');
                });
            });
            
            // Define global handler functions for issue item actions
            window.openEditorWithFile = function(event, issueId) {
                event.preventDefault();
                
                const issue = window.reportData.compliance.issues.find(i => i.id === issueId);
                if (!issue) return true;
                
                // Determine the file path based on issue type
                let filePath = '';
                
                if (issueId.includes('missing-file')) {
                    filePath = issueId.replace('missing-file-', '');
                } else if (issueId.includes('missing-workflow')) {
                    const workflowName = issueId.replace('missing-workflow-', '');
                    filePath = `.github/workflows/${workflowName}.yml`;
                } else if (issueId.includes('readme')) {
                    filePath = "README.md";
                } else if (issueId.includes('bicep') && issueId.includes('main')) {
                    filePath = "infra/main.bicep";
                } else if (issueId.includes('azure-yaml')) {
                    filePath = "azure.yaml";
                }
                
                const templateUrl = encodeURIComponent(window.reportData.repoUrl);
                let url = `https://insiders.vscode.dev/azure?azdTemplateUrl=${templateUrl}`;
                
                // Add file path if available
                if (filePath) {
                    url += `&path=${encodeURIComponent(filePath)}`;
                }
                
                window.open(url, '_blank');
                return false;
            };
            
            window.createSingleIssue = function(event, issueId) {
                event.preventDefault();
                alert(`GitHub issue creation for individual issues is not available in this view. Please use the 'Create GitHub Issue' button to create issues for all compliance problems.`);
                return false;
            };
        }
    }
    
    // Register the renderer in the global scope
    window.DashboardRenderer = new DashboardRendererClass();
})();
