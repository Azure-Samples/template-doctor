// Dashboard Renderer for Template Doctor Frontend
// This file renders the compliance dashboard UI in the browser

class DashboardRenderer {
    constructor() {
        // No state needed yet
    }

    /**
     * Render the compliance dashboard into a container
     * @param {Object} analysisResult - The result from TemplateAnalyzer.analyzeTemplate
     * @param {HTMLElement} container - The DOM element to render into
     */
    render(analysisResult, container) {
        if (!analysisResult || !container) return;
        container.innerHTML = '';

        // Overview section
        const overview = document.createElement('section');
        overview.className = 'overview';
        overview.innerHTML = `
            <h2>Compliance Overview</h2>
            <div class="compliance-gauge">
                <div class="gauge-fill" id="complianceGauge"></div>
                <div class="gauge-label" id="compliancePercentage"></div>
            </div>
            <div class="overview-tiles">
                <div class="tile tile-issues">
                    <div class="tile-icon"><i class="fas fa-exclamation-triangle"></i></div>
                    <div class="tile-value" id="issuesCount">0</div>
                    <div class="tile-title">Issues Found</div>
                </div>
                <div class="tile tile-passed">
                    <div class="tile-icon"><i class="fas fa-check-circle"></i></div>
                    <div class="tile-value" id="passedCount">0</div>
                    <div class="tile-title">Passed Checks</div>
                </div>
            </div>
        `;
        container.appendChild(overview);

        // Panels for issues and passed checks
        const issuesPanel = this.createPanel('Issues', 'fa-exclamation-circle', 'issuesList', analysisResult.compliance.issues, 'issue-item');
        const passedPanel = this.createPanel('Passed Checks', 'fa-check-circle', 'passedList', analysisResult.compliance.compliant.filter(i => i.category !== 'meta'), 'passed-item');
        container.appendChild(issuesPanel);
        container.appendChild(passedPanel);

        // Render compliance gauge and counts
        this.renderGaugeAndCounts(analysisResult);

        // After rendering, wire up the create issue button
        this.wireCreateIssueButton(analysisResult, analysisResult.repoUrl);
    }

    /**
     * Create a collapsible panel for issues or passed checks
     */
    createPanel(title, icon, listId, items, itemClass) {
        const panel = document.createElement('section');
        panel.className = 'panel panel-open';
        panel.innerHTML = `
            <div class="panel-header">
                <div class="panel-title"><i class="fas ${icon}"></i><span>${title}</span></div>
                <i class="fas fa-chevron-down panel-toggle"></i>
            </div>
            <div class="panel-body">
                <div class="panel-content">
                    <ul class="item-list" id="${listId}"></ul>
                </div>
            </div>
        `;
        // Populate list
        const list = panel.querySelector(`#${listId}`);
        if (items.length === 0) {
            list.innerHTML = `<li class="item"><div class="item-message">No ${title.toLowerCase()}.</div></li>`;
        } else {
            items.forEach(item => {
                const li = document.createElement('li');
                li.className = `item ${itemClass}`;
                li.innerHTML = `
                    <div class="item-header">
                        <div class="item-title">${item.message}</div>
                        <div class="item-category">${item.category || ''}</div>
                    </div>
                    <div class="item-message">${item.error || ''}</div>
                `;
                list.appendChild(li);
            });
        }
        // Panel toggle
        panel.querySelector('.panel-header').addEventListener('click', () => {
            panel.classList.toggle('panel-open');
        });
        return panel;
    }

    /**
     * Render the compliance gauge and counts
     */
    renderGaugeAndCounts(analysisResult) {
        const meta = analysisResult.compliance.compliant.find(i => i.category === 'meta');
        const percent = meta?.details?.percentageCompliant || 0;
        const gauge = document.getElementById('complianceGauge');
        const label = document.getElementById('compliancePercentage');
        if (gauge) gauge.style.width = percent + '%';
        if (label) label.textContent = percent + '%';
        const issuesCount = document.getElementById('issuesCount');
        const passedCount = document.getElementById('passedCount');
        if (issuesCount) issuesCount.textContent = analysisResult.compliance.issues.length;
        if (passedCount) passedCount.textContent = analysisResult.compliance.compliant.filter(i => i.category !== 'meta').length;
    }

    /**
     * Find or create the main Template Doctor issue, then create sub-issues for each compliance issue
     * @param {Object} analysisResult
     * @param {string} repoUrl
     * @param {HTMLElement} btn
     */
    async createMainAndSubIssues(analysisResult, repoUrl, btn) {
        const github = window.GitHubClient;
        // Parse owner/repo
        const match = repoUrl.match(/github.com\/([^/]+)\/([^/]+)/);
        if (!match) throw new Error('Invalid repo URL');
        const owner = match[1];
        const repo = match[2];
        // Prepare title/body/labels as backend does
        const today = new Date();
        const formattedDate = `[${today.toISOString().split('T')[0]}]`;
        const title = `Template Doctor Analysis: ${analysisResult.compliance.summary} ${formattedDate}`;
        let body = `# Template Doctor Analysis\n\nAnalyzed on: ${new Date(analysisResult.timestamp).toLocaleString()}\n\n`;
        body += `## Summary\n\n- Repository: [${analysisResult.repoUrl}](${analysisResult.repoUrl})\n- Rule Set: ${analysisResult.ruleSet}\n- Compliance: ${analysisResult.compliance.compliant.find((item) => item.category === 'meta')?.details?.percentageCompliant || 0}%\n- Issues Found: ${analysisResult.compliance.issues.length}\n- Passed Checks: ${analysisResult.compliance.compliant.filter((item) => item.category !== 'meta').length}\n\n`;
        if (analysisResult.compliance.issues.length > 0) {
            body += `## Issues to Fix\n\n`;
            analysisResult.compliance.issues.forEach((issue, index) => {
                body += `### ${index + 1}. ${issue.message}\n\n`;
                if (issue.error) {
                    body += `**Error Details:**\n\`\`\`\n${issue.error}\n\`\`\`\n\n`;
                }
                if (issue.id) {
                    body += `**Issue ID:** \`${issue.id}\`\n\n`;
                }
                body += `**How to Fix:**\nReview the issue details and make the necessary changes.\n\n`;
            });
        }
        body += `\n\n<!-- Issue Tracker ID: template-doctor-${Date.now()} -->`;
        const labels = ["template-doctor-full-scan"];
        // Check for existing main issue (open or closed)
        const existing = await github.findIssuesByTitle(owner, repo, title, labels[0]);
        let mainIssue;
        if (existing.length > 0) {
            mainIssue = existing[0];
        } else {
            mainIssue = await github.createIssueGraphQL(owner, repo, title, body, labels);
        }
        // For each compliance issue, create a sub-issue if not already present
        for (let i = 0; i < analysisResult.compliance.issues.length; i++) {
            const issue = analysisResult.compliance.issues[i];
            const subTitle = `TD-${i + 1}: ${issue.message.length > 60 ? issue.message.substring(0, 57) + '...' : issue.message}`;
            // Check for existing sub-issue
            const subExisting = await github.findIssuesByTitle(owner, repo, subTitle, "template-doctor-issue");
            if (subExisting.length > 0) continue;
            // Sub-issue body
            let subBody = `## Template Doctor Compliance Issue\n\n### Issue Details:\n\n- **ID**: ${issue.id}\n- **Message**: ${issue.message}\n`;
            if (issue.error) subBody += `- **Error**: ${issue.error}\n`;
            subBody += `\n### How to Fix:\nReview the issue details and make the necessary changes.\n`;
            subBody += `\nLinked to main issue: #${mainIssue.number}`;
            await github.createIssueGraphQL(owner, repo, subTitle, subBody, ["template-doctor-issue"]);
        }
        return mainIssue;
    }

    /**
     * Wire up the Create GitHub Issue button to use GraphQL API
     * @param {Object} analysisResult - The result from TemplateAnalyzer.analyzeTemplate
     * @param {string} repoUrl - The repository URL
     */
    wireCreateIssueButton(analysisResult, repoUrl) {
        const btn = document.getElementById('create-github-issue-btn');
        if (!btn) return;
        btn.onclick = async () => {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Issues...';
            try {
                const mainIssue = await this.createMainAndSubIssues(analysisResult, repoUrl, btn);
                btn.innerHTML = '<i class="fab fa-github"></i> Issues Created!';
                btn.disabled = false;
                window.open(mainIssue.url, '_blank');
            } catch (err) {
                btn.innerHTML = '<i class="fab fa-github"></i> Create GitHub Issue';
                btn.disabled = false;
                alert('Error creating issues: ' + (err.message || err));
            }
        };
    }
}

window.DashboardRenderer = new DashboardRenderer();

// Dashboard Renderer for Template Doctor
// This handles the rendering of analysis results into the UI

class DashboardRenderer {
    constructor() {
        this.resultsContainer = document.getElementById('results-container');
    }

    /**
     * Render an analysis result into the UI
     * @param {Object} result - The analysis result
     */
    renderDashboard(result) {
        if (!this.resultsContainer) {
            console.error("Results container not found");
            return;
        }

        // Clear previous content
        this.resultsContainer.innerHTML = '';
        
        // Extract key data
        const complianceData = result.compliance.compliant.find(item => item.category === 'meta')?.details || {};
        const percentageCompliant = complianceData.percentageCompliant || 0;
        const issuesCount = result.compliance.issues.length;
        const passedCount = result.compliance.compliant.filter(item => item.category !== 'meta').length;
        
        // Create overview section
        const overview = document.createElement('section');
        overview.className = 'overview';
        
        overview.innerHTML = `
            <h2>Compliance Overview</h2>
            <p class="overview-text">
                This dashboard provides an overview of your Azure template compliance status with the 'Azure Developer CLI Template Framework' 
                <a href="https://github.com/Azure-Samples/azd-template-artifacts/blob/main/docs/development-guidelines/definition-of-done.md" target="_blank" title="Definition of Done">
                    Definition of Done
                </a>. 
                Browse the list below to fix specific issues.
            </p>
            
            <div class="compliance-gauge">
                <div class="gauge-fill" id="complianceGauge" style="width: ${percentageCompliant}%; background-position: ${percentageCompliant}% 0;"></div>
                <div class="gauge-label" id="compliancePercentage">${percentageCompliant}%</div>
            </div>
            
            <div class="overview-tiles">
                <div class="tile tile-issues">
                    <div class="tile-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div class="tile-value">${issuesCount}</div>
                    <div class="tile-title">Issues Found</div>
                </div>
                
                <div class="tile tile-passed">
                    <div class="tile-icon">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <div class="tile-value">${passedCount}</div>
                    <div class="tile-title">Passed Checks</div>
                </div>
            </div>
        `;
        
        this.resultsContainer.appendChild(overview);
        
        // Create issues panel
        const issuesPanel = this.createPanel('issuesPanel', 'Issues', 'exclamation-circle');
        
        // Create issues list
        const issuesList = document.createElement('ul');
        issuesList.className = 'item-list';
        issuesList.id = 'issuesList';
        
        if (result.compliance.issues.length === 0) {
            issuesList.innerHTML = '<li class="item"><div class="item-message">No issues found. Great job!</div></li>';
        } else {
            result.compliance.issues.forEach(issue => {
                const li = document.createElement('li');
                li.className = 'item issue-item';
                
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
                
                li.innerHTML = `
                    <div class="item-header">
                        <div class="item-title">${issue.message}</div>
                        <div class="item-category">${category}</div>
                    </div>
                    <div class="item-message">${issue.error || issue.message}</div>
                    <div class="item-details">
                        <strong>How to fix:</strong> ${fixHint}
                    </div>
                    <div class="item-actions">
                        <a href="https://github.com/${result.repoUrl.match(/github\.com\/([^/]+\/[^/.]+)/)[1]}" target="_blank" class="item-link">
                            <i class="fas fa-external-link-alt"></i> View in GitHub
                        </a>
                        <a href="#" 
                           class="item-link"
                           style="margin-left: 15px;"
                           onclick="return window.DashboardRenderer.createIssue('${result.repoUrl}', '${issue.id}', '${issue.message.replace(/'/g, "\\'")}')">
                            <i class="fab fa-github"></i> Create issue
                        </a>
                    </div>
                `;
                
                issuesList.appendChild(li);
            });
        }
        
        const issuesContent = document.createElement('div');
        issuesContent.className = 'panel-content';
        issuesContent.appendChild(issuesList);
        issuesPanel.querySelector('.panel-body').appendChild(issuesContent);
        
        // Create passed checks panel
        const passedPanel = this.createPanel('passedPanel', 'Passed Checks', 'check-circle');
        
        // Create passed checks list
        const passedList = document.createElement('ul');
        passedList.className = 'item-list';
        passedList.id = 'passedList';
        
        // Filter out the meta item
        const passedItems = result.compliance.compliant.filter(item => item.category !== 'meta');
        
        if (passedItems.length === 0) {
            passedList.innerHTML = '<li class="item"><div class="item-message">No passed checks yet.</div></li>';
        } else {
            passedItems.forEach(item => {
                const li = document.createElement('li');
                li.className = 'item passed-item';
                
                // Format category for display
                const categoryDisplay = item.category
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/^./, str => str.toUpperCase());
                
                let detailsHtml = '';
                if (item.details) {
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
                
                li.innerHTML = `
                    <div class="item-header">
                        <div class="item-title">${item.message}</div>
                        <div class="item-category">${categoryDisplay}</div>
                    </div>
                    ${detailsHtml}
                `;
                
                passedList.appendChild(li);
            });
        }
        
        const passedContent = document.createElement('div');
        passedContent.className = 'panel-content';
        passedContent.appendChild(passedList);
        passedPanel.querySelector('.panel-body').appendChild(passedContent);
        
        // Add the panels to the results container
        this.resultsContainer.appendChild(issuesPanel);
        this.resultsContainer.appendChild(passedPanel);
        
        // Add action buttons
        const actionFooter = document.createElement('div');
        actionFooter.className = 'action-footer';
        
        actionFooter.innerHTML = `
            <div class="tooltip">
                <a href="https://github.com/${result.repoUrl.match(/github\.com\/([^/]+\/[^/.]+)/)[1]}" target="_blank" class="btn">
                    <i class="fas fa-code"></i>
                    View on GitHub
                </a>
                <span class="tooltiptext">Opens the repository on GitHub.</span>
            </div>
            
            <div class="tooltip">
                <button id="create-github-issue-btn" class="btn" style="background-color: #2b3137;" onclick="window.DashboardRenderer.createMainIssue('${result.repoUrl}')">
                    <i class="fab fa-github"></i>
                    Create GitHub Issue
                </button>
                <span class="tooltiptext">Creates an issue in your repository with compliance details.</span>
            </div>
            
            <div class="tooltip">
                <button id="download-report-btn" class="btn" style="background-color: #0078d4;" onclick="window.DashboardRenderer.downloadReport()">
                    <i class="fas fa-download"></i>
                    Download Report
                </button>
                <span class="tooltiptext">Download this report as a JSON file.</span>
            </div>
        `;
        
        this.resultsContainer.appendChild(actionFooter);
        
        // Setup panel toggle functionality
        document.querySelectorAll('.panel-header').forEach(header => {
            header.addEventListener('click', () => {
                const panel = header.parentElement;
                panel.classList.toggle('panel-open');
            });
        });
        
        // Auto-expand the issues panel if there are issues
        if (result.compliance.issues.length > 0) {
            document.getElementById('issuesPanel').classList.add('panel-open');
        } else {
            document.getElementById('passedPanel').classList.add('panel-open');
        }
        
        // Show the results container
        this.resultsContainer.style.display = 'block';
        
        // Save the current result for later use
        this.currentResult = result;
    }
    
    /**
     * Create a panel element
     * @param {string} id - Panel ID
     * @param {string} title - Panel title
     * @param {string} icon - FontAwesome icon name
     * @returns {HTMLElement} - The created panel element
     */
    createPanel(id, title, icon) {
        const panel = document.createElement('section');
        panel.className = 'panel';
        panel.id = id;
        
        panel.innerHTML = `
            <div class="panel-header">
                <div class="panel-title">
                    <i class="fas fa-${icon}"></i>
                    <span>${title}</span>
                </div>
                <i class="fas fa-chevron-down panel-toggle"></i>
            </div>
            <div class="panel-body"></div>
        `;
        
        this.resultsContainer.appendChild(panel);
        return panel;
    }
    
    /**
     * Create an issue for a specific compliance issue
     * @param {string} repoUrl - Repository URL
     * @param {string} issueId - Issue ID
     * @param {string} issueMessage - Issue message
     * @returns {boolean} - Always returns false to prevent default link behavior
     */
    createIssue(repoUrl, issueId, issueMessage) {
        // Extract owner and repo from URL
        const repoMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)(\.git)?/);
        if (!repoMatch) {
            alert('Invalid GitHub URL');
            return false;
        }
        
        const owner = repoMatch[1];
        const repo = repoMatch[2];
        
        // Find the issue details from the current result
        const issue = this.currentResult.compliance.issues.find(i => i.id === issueId);
        if (!issue) {
            alert('Issue not found');
            return false;
        }
        
        // Create a title for the issue
        const today = new Date();
        const formattedDate = `[${today.toISOString().split('T')[0]}]`;
        let issueTitle;
        
        if (issue.id.includes('missing-file')) {
            const fileName = issue.message.match(/Missing required file: (.+)/)?.[1] || "file";
            issueTitle = `Missing required file: ${fileName} ${formattedDate}`;
        } else if (issue.id.includes('missing-folder')) {
            const folderName = issue.message.match(/Missing required folder: (.+)/)?.[1] || "folder";
            issueTitle = `Missing required folder: ${folderName} ${formattedDate}`;
        } else if (issue.id.includes('missing-workflow')) {
            const workflowName = issue.id.replace('missing-workflow-', '');
            issueTitle = `Missing workflow: ${workflowName} ${formattedDate}`;
        } else {
            // Use the message as title, but keep it reasonably short
            issueTitle = issue.message.length > 60 ? 
                `${issue.message.substring(0, 57)}... ${formattedDate}` : 
                `${issue.message} ${formattedDate}`;
        }
        
        // Create a comprehensive issue body
        let issueBody = "# Template Doctor Compliance Issue\n\n";
        issueBody += `Repository: [${repoUrl}](${repoUrl})\n\n`;
        
        // Add clear issue details
        issueBody += `## Issue Details\n\n`;
        issueBody += `- **Issue ID**: \`${issue.id}\`\n`;
        issueBody += `- **Category**: ${issue.id.split('-')[0] || 'Compliance'}\n`;
        issueBody += `- **Severity**: ${issue.id.includes('critical') ? 'Critical' : 'Standard'}\n`;
        issueBody += `- **Message**: ${issue.message}\n`;
        issueBody += `- **Created**: ${today.toLocaleString()}\n\n`;
        
        // Add error details in a code block for better readability
        if (issue.error) {
            issueBody += `## Error Details\n\n\`\`\`\n${issue.error}\n\`\`\`\n\n`;
        }
        
        // Create detailed step-by-step instructions based on issue type
        issueBody += `## How to Fix\n\n`;
        
        if (issue.id.includes('missing-file')) {
            const fileName = issue.message.match(/Missing required file: (.+)/)?.[1] || "file";
            issueBody += `### Steps to Create \`${fileName}\`\n\n`;
            issueBody += `1. Create a new file named \`${fileName}\` in your repository\n`;
            issueBody += `2. Add the following content structure based on requirements:\n\n`;
            
            // Add template content based on file type
            if (fileName.includes('.md')) {
                issueBody += "```markdown\n# Title\n\n## Description\n\nAdd the required content here.\n```\n\n";
            } else if (fileName.includes('.yaml') || fileName.includes('.yml')) {
                issueBody += "```yaml\n# Required structure\nname: example\nversion: 1.0.0\n\n# Add additional required fields\n```\n\n";
            } else if (fileName.includes('.json')) {
                issueBody += "```json\n{\n  \"name\": \"example\",\n  \"version\": \"1.0.0\"\n  // Add required fields\n}\n```\n\n";
            } else if (fileName.includes('.bicep')) {
                issueBody += "```bicep\n// Add your Bicep resources here\nparam location string = resourceGroup().location\n\n// Define resources\n```\n\n";
            }
            
            issueBody += `3. Commit the file to your repository\n`;
            issueBody += `4. Run Template Doctor again to verify the issue is resolved\n\n`;
        } 
        else if (issue.id.includes('missing-folder')) {
            const folderName = issue.message.match(/Missing required folder: (.+)/)?.[1] || "folder";
            issueBody += `### Steps to Create \`${folderName}\` Directory\n\n`;
            issueBody += `1. Create the directory structure for \`${folderName}\` in your repository\n`;
            issueBody += `2. Add appropriate files within this directory (such as README.md or required configuration files)\n`;
            issueBody += `3. Commit the changes to your repository\n`;
            issueBody += `4. Run Template Doctor again to verify the issue is resolved\n\n`;
        }
        else if (issue.id.includes('missing-workflow')) {
            const workflowName = issue.id.replace('missing-workflow-', '');
            issueBody += `### Steps to Add GitHub Workflow \`${workflowName}\`\n\n`;
            issueBody += `1. Create the directory structure \`.github/workflows/\` if it doesn't exist\n`;
            issueBody += `2. Add a new workflow file named \`${workflowName}.yml\` with appropriate triggers and actions\n`;
            issueBody += `3. Example workflow structure:\n\n`;
            issueBody += "```yaml\nname: " + workflowName + "\n\non:\n  push:\n    branches: [ main ]\n  pull_request:\n    branches: [ main ]\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v3\n      # Add required steps here\n```\n\n";
            issueBody += `4. Commit the file to your repository\n`;
            issueBody += `5. Run Template Doctor again to verify the issue is resolved\n\n`;
        }
        else if (issue.id.includes('readme')) {
            issueBody += `### Steps to Fix README Issues\n\n`;
            issueBody += `1. Open the README.md file in your repository\n`;
            issueBody += `2. Ensure it includes the following required sections:\n`;
            issueBody += `   - Project title and description\n`;
            issueBody += `   - Prerequisites and dependencies\n`;
            issueBody += `   - Setup and installation instructions\n`;
            issueBody += `   - Usage examples\n`;
            issueBody += `   - Deployment information\n`;
            issueBody += `3. Add any missing sections or information\n`;
            issueBody += `4. Commit the changes to your repository\n\n`;
        }
        else if (issue.id.includes('bicep')) {
            issueBody += `### Steps to Fix Bicep File Issues\n\n`;
            issueBody += `1. Review your Bicep files for missing required resources or parameters\n`;
            issueBody += `2. Add any missing resources according to the Azure Architecture requirements\n`;
            issueBody += `3. Ensure parameter naming follows the recommended patterns\n`;
            issueBody += `4. Validate the Bicep files using the Azure CLI: \`az bicep build --file main.bicep\`\n`;
            issueBody += `5. Commit the changes to your repository\n\n`;
        }
        else if (issue.id.includes('azure-yaml')) {
            issueBody += `### Steps to Fix azure.yaml Issues\n\n`;
            issueBody += `1. Open or create the \`azure.yaml\` file in the root of your repository\n`;
            issueBody += `2. Ensure it includes the following required sections:\n`;
            issueBody += "```yaml\n# Required azure.yaml structure\nname: YourProjectName\nversion: 1.0.0\n\ninfra:\n  provider: bicep\n  path: infra\n\npipelines:\n  - source: azd-pipelines\n    triggers:\n      - main\n```\n\n";
            issueBody += `3. Add any missing sections or fields\n`;
            issueBody += `4. Commit the changes to your repository\n\n`;
        }
        else {
            issueBody += `### General Steps to Fix This Issue\n\n`;
            issueBody += `1. Review the issue details carefully\n`;
            issueBody += `2. Make the necessary changes to address the compliance issue\n`;
            issueBody += `3. Test your changes locally to ensure they resolve the issue\n`;
            issueBody += `4. Commit the changes to your repository\n`;
            issueBody += `5. Run Template Doctor again to verify the issue is resolved\n\n`;
        }
        
        // Add additional resources
        issueBody += `## Additional Resources\n\n`;
        issueBody += `- [Azure Developer CLI Documentation](https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/)\n`;
        issueBody += `- [GitHub Actions Workflows](https://docs.github.com/en/actions/using-workflows)\n`;
        issueBody += `- [Bicep Documentation](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/)\n\n`;
        
        issueBody += `---\n*This issue was created by Template Doctor, an automated compliance checking tool.*`;
        
        // Create the issue using GitHub API
        try {
            // Indicate loading state
            const findLinkElement = element => {
                if (element.classList.contains('item-link')) return element;
                return element.closest('.item-link');
            };
            
            const clickedElement = event.target;
            const linkElement = findLinkElement(clickedElement);
            const originalText = linkElement.innerHTML;
            linkElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Issue...';
            
            // Create the issue
            window.GitHubClient.createIssue(
                owner, 
                repo, 
                issueTitle, 
                issueBody, 
                ["template-doctor-issue"]
            )
            .then(response => {
                // Show success message
                linkElement.innerHTML = '<i class="fas fa-check"></i> Issue Created';
                
                // Reset after 3 seconds
                setTimeout(() => {
                    linkElement.innerHTML = originalText;
                }, 3000);
                
                // Open the issue in a new tab
                window.open(response.html_url, '_blank');
            })
            .catch(error => {
                // Show error message
                console.error('Error creating issue:', error);
                linkElement.innerHTML = '<i class="fas fa-times"></i> Failed';
                
                // Reset after 3 seconds
                setTimeout(() => {
                    linkElement.innerHTML = originalText;
                }, 3000);
                
                // Show error alert
                alert(`Error creating issue: ${error.message || 'Unknown error'}`);
            });
        } catch (error) {
            console.error('Error creating issue:', error);
            alert(`Error creating issue: ${error.message || 'Unknown error'}`);
        }
        
        return false;
    }
    
    /**
     * Create a main issue with all compliance issues
     * @param {string} repoUrl - Repository URL
     */
    createMainIssue(repoUrl) {
        // Extract owner and repo from URL
        const repoMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)(\.git)?/);
        if (!repoMatch) {
            alert('Invalid GitHub URL');
            return;
        }
        
        const owner = repoMatch[1];
        const repo = repoMatch[2];
        
        // Show loading state
        const createIssueButton = document.getElementById('create-github-issue-btn');
        const originalText = createIssueButton.innerHTML;
        createIssueButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Issue...';
        createIssueButton.disabled = true;
        
        // Add today's date in square brackets for the issue title
        const today = new Date();
        const formattedDate = `[${today.toISOString().split('T')[0]}]`;
        
        // Create summary of issues for the GitHub issue body
        let issueBody = "# Template Doctor Analysis\n\n";
        issueBody += `Template: ${repoUrl}\n\n`;
        issueBody += `Analyzed on: ${new Date().toLocaleString()}\n\n`;
        issueBody += `## Summary\n\n`;
        issueBody += `- Compliance: ${this.currentResult.compliance.compliant.find(item => item.category === 'meta')?.details?.percentageCompliant || 0}%\n`;
        issueBody += `- Issues Found: ${this.currentResult.compliance.issues.length}\n`;
        issueBody += `- Passed Checks: ${this.currentResult.compliance.compliant.filter(item => item.category !== 'meta').length}\n\n`;
        
        if (this.currentResult.compliance.issues.length > 0) {
            issueBody += `## Issues to Fix\n\n`;
            this.currentResult.compliance.issues.forEach((issue, index) => {
                issueBody += `${index + 1}. **${issue.message}**\n`;
                if (issue.error) {
                    issueBody += `   - ${issue.error}\n`;
                }
                issueBody += `\n`;
            });
        }
        
        // Add unique ID to help identify this issue for updates
        const uniqueId = `template-doctor-${Date.now()}`;
        issueBody += `\n---\n*This issue was created by Template Doctor, an automated compliance checking tool.*`;
        issueBody += `\n\n<!-- Issue Tracker ID: ${uniqueId} -->`;
        
        // Create the issue
        window.GitHubClient.createIssue(
            owner,
            repo,
            `Template Doctor Analysis: ${this.currentResult.compliance.summary} ${formattedDate}`,
            issueBody,
            ["template-doctor-full-scan"]
        )
        .then(response => {
            // Show success message
            createIssueButton.innerHTML = '<i class="fas fa-check"></i> Issue Created';
            
            // Reset after 3 seconds
            setTimeout(() => {
                createIssueButton.innerHTML = originalText;
                createIssueButton.disabled = false;
            }, 3000);
            
            // Open the issue in a new tab
            window.open(response.html_url, '_blank');
        })
        .catch(error => {
            // Show error message
            console.error('Error creating issue:', error);
            createIssueButton.innerHTML = '<i class="fas fa-times"></i> Failed';
            
            // Reset after 3 seconds
            setTimeout(() => {
                createIssueButton.innerHTML = originalText;
                createIssueButton.disabled = false;
            }, 3000);
            
            // Show error alert
            alert(`Error creating issue: ${error.message || 'Unknown error'}`);
        });
    }
    
    /**
     * Download the current analysis report as a JSON file
     */
    downloadReport() {
        if (!this.currentResult) {
            alert('No analysis results available');
            return;
        }
        
        // Create a JSON string from the current result
        const jsonString = JSON.stringify(this.currentResult, null, 2);
        
        // Create a blob from the JSON string
        const blob = new Blob([jsonString], { type: 'application/json' });
        
        // Create a link element to download the blob
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `template-doctor-report-${Date.now()}.json`;
        
        // Append the link to the body, click it, and remove it
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Create and export the dashboard renderer instance
const dashboardRenderer = new DashboardRenderer();
window.DashboardRenderer = dashboardRenderer;
