// This script is a fallback to ensure action buttons are visible
// It will directly insert the act            provisionButtonContainer.appendChild(provisionBtn);
            actionHeader.appendChild(provisionButtonContainer);
            
            // Insert the action header if it wasn't in the DOM already
            if (!existingActionHeader) {
                resultsContainer.insertBefore(actionHeader, resultsContainer.firstChild);
            }
            
            // Set up event handlers for the buttons
            const fixButtonFallback = document.getElementById('fixButton-fallback');
            if (fixButtonFallback) {
                console.log('Setting up fallback fix button');
                
                fixButtonFallback.addEventListener('click', function(e) {
                    e.preventDefault();
                    console.log('Fix button clicked (fallback)');
                    
                    // Get repo URL from DOM or use default
                    let repoUrl = '';
                    const repoUrlElement = document.getElementById('repo-url');
                    if (repoUrlElement) {
                        repoUrl = repoUrlElement.textContent || '';
                    }
                    
                    const templateUrl = encodeURIComponent(repoUrl);
                    window.open(`https://insiders.vscode.dev/azure?azdTemplateUrl=${templateUrl}`, '_blank');
                });
            }
            
            const createIssueButtonFallback = document.getElementById('create-github-issue-btn-fallback');
            if (createIssueButtonFallback) {
                console.log('Setting up fallback GitHub issue button');
                
                createIssueButtonFallback.addEventListener('click', function() {
                    console.log('Create GitHub Issue button clicked (fallback)');
                    if (typeof window.createGitHubIssue === 'function') {
                        window.createGitHubIssue();
                    } else {
                        alert("GitHub issue creation is not available in this view");
                    }
                });
            }
            
            const testProvisionButtonFallback = document.getElementById('testProvisionButton-fallback');
            if (testProvisionButtonFallback) {
                console.log('Setting up fallback test provision button');
                
                testProvisionButtonFallback.addEventListener('click', function() {
                    console.log('Test AZD Provision button clicked (fallback)');
                    if (typeof window.testAzdProvision === 'function') {
                        window.testAzdProvision();
                    } else {
                        alert("AZD provision testing is not available in this view");
                    }
                });
            }
            
            console.log('Fallback action buttons added and set up successfully');
        } else {
            console.log('No need for fallback action buttons');
        }n buttons if they're not found

document.addEventListener('DOMContentLoaded', function() {
    // Wait for everything else to load and render
    setTimeout(function() {
        console.log('Checking for action buttons...');
        
        // Check if the buttons exist at all
        const existingButtons = document.querySelectorAll('#fixButton, #create-github-issue-btn, #testProvisionButton');
        
        if (existingButtons.length > 0) {
            console.log(`Found ${existingButtons.length} action buttons - ensuring they're visible and clickable`);
            
            // Make sure all existing buttons are visible and clickable
            existingButtons.forEach(button => {
                console.log(`Fixing visibility for button: ${button.id}`);
                button.style.opacity = '1 !important';
                button.style.visibility = 'visible !important';
                button.style.pointerEvents = 'auto !important';
                button.style.cursor = 'pointer !important';
                button.style.display = 'inline-flex !important';
                
                // Add a click event for debugging
                button.addEventListener('click', function() {
                    console.log(`Button clicked: ${button.id}`);
                });
            });
            
            return; // Buttons exist, just made them visible
        }
        
        // Check if results container exists and action header doesn't
        const resultsContainer = document.getElementById('results-container');
        const existingActionHeader = document.querySelector('.action-header');
        
        if (resultsContainer && (!existingActionHeader || existingActionHeader.children.length <= 1) && resultsContainer.innerHTML.trim() !== '') {
            console.log('Results container found but no proper action header, adding buttons now');
            
            // Create or use existing action header
            let actionHeader;
            if (!existingActionHeader) {
                actionHeader = document.createElement('div');
                actionHeader.className = 'action-footer action-header';
                actionHeader.style.cssText = 'background: white; border-radius: 5px; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: flex; justify-content: center; flex-wrap: wrap; gap: 20px;';
                
                // Add title
                const headerTitle = document.createElement('div');
                headerTitle.style.cssText = 'width: 100%; text-align: center; margin-bottom: 10px;';
                headerTitle.innerHTML = '<h3 style="margin: 0; padding: 0; font-size: 1.1rem; color: #333;">Actions (Fallback)</h3>';
                actionHeader.appendChild(headerTitle);
            } else {
                actionHeader = existingActionHeader;
                // Clear any existing content except title
                if (actionHeader.querySelector('h3')) {
                    const title = actionHeader.querySelector('h3').parentElement;
                    actionHeader.innerHTML = '';
                    actionHeader.appendChild(title);
                } else {
                    actionHeader.innerHTML = '<div style="width:100%; text-align:center; margin-bottom:10px;"><h3 style="margin:0; padding:0; font-size:1.1rem; color:#333;">Actions (Fallback)</h3></div>';
                }
            }
            
            // Fix with AI Agent button
            const fixButtonContainer = document.createElement('div');
            fixButtonContainer.style.cssText = 'position: relative; display: inline-block;';
            
            const fixBtn = document.createElement('a');
            fixBtn.id = 'fixButton-fallback';
            fixBtn.href = '#';
            fixBtn.className = 'btn';
            fixBtn.style.cssText = 'opacity: 1 !important; visibility: visible !important; padding: 12px 24px; background-color: #0078d4; color: white; border: none; border-radius: 4px; font-size: 1rem; font-weight: 500; cursor: pointer !important; display: inline-flex !important; align-items: center; gap: 8px; min-width: 180px; justify-content: center; text-decoration: none;';
            fixBtn.innerHTML = '<i class="fas fa-code"></i> Fix with AI Agent';
            
            fixButtonContainer.appendChild(fixBtn);
            actionHeader.appendChild(fixButtonContainer);
            
            // GitHub Issue button
            const githubButtonContainer = document.createElement('div');
            githubButtonContainer.style.cssText = 'position: relative; display: inline-block;';
            
            const githubBtn = document.createElement('button');
            githubBtn.id = 'create-github-issue-btn-fallback';
            githubBtn.className = 'btn';
            githubBtn.style.cssText = 'opacity: 1 !important; visibility: visible !important; padding: 12px 24px; background-color: #2b3137; color: white; border: none; border-radius: 4px; font-size: 1rem; font-weight: 500; cursor: pointer !important; display: inline-flex !important; align-items: center; gap: 8px; min-width: 180px; justify-content: center;';
            githubBtn.innerHTML = '<i class="fab fa-github"></i> Create GitHub Issue';
            
            githubButtonContainer.appendChild(githubBtn);
            actionHeader.appendChild(githubButtonContainer);
            
            // Test AZD button
            const provisionButtonContainer = document.createElement('div');
            provisionButtonContainer.style.cssText = 'position: relative; display: inline-block;';
            
            const provisionBtn = document.createElement('button');
            provisionBtn.id = 'testProvisionButton-fallback';
            provisionBtn.className = 'btn';
            provisionBtn.style.cssText = 'opacity: 1 !important; visibility: visible !important; padding: 12px 24px; background-color: #0078d4; color: white; border: none; border-radius: 4px; font-size: 1rem; font-weight: 500; cursor: pointer !important; display: inline-flex !important; align-items: center; gap: 8px; min-width: 180px; justify-content: center;';
            provisionBtn.innerHTML = '<i class="fas fa-rocket"></i> Test AZD Provision';
            
            provisionButtonContainer.appendChild(provisionBtn);
            actionHeader.appendChild(provisionButtonContainer);
            
            // Insert at beginning of results container
            resultsContainer.insertBefore(actionHeader, resultsContainer.firstChild);
            
            // Setup button click handlers
            const fixButton = document.getElementById('fixButton-fallback');
            if (fixButton) {
                fixButton.addEventListener('click', function(e) {
                    e.preventDefault();
                    console.log('Fix button clicked (fallback)');
                    
                    // Get repo URL from DOM or use default
                    let repoUrl = '';
                    const repoUrlElement = document.getElementById('repo-url');
                    if (repoUrlElement) {
                        repoUrl = repoUrlElement.textContent || '';
                    }
                    
                    const templateUrl = encodeURIComponent(repoUrl);
                    window.open(`https://insiders.vscode.dev/azure?azdTemplateUrl=${templateUrl}`, '_blank');
                });
            }
            
            const createIssueButton = document.getElementById('create-github-issue-btn-fallback');
            if (createIssueButton) {
                createIssueButton.addEventListener('click', function() {
                    console.log('Create GitHub Issue button clicked (fallback)');
                    if (typeof window.createGitHubIssue === 'function') {
                        window.createGitHubIssue();
                    } else {
                        alert("GitHub issue creation is not available in this view");
                    }
                });
            }
            
            const testProvisionButton = document.getElementById('testProvisionButton-fallback');
            if (testProvisionButton) {
                testProvisionButton.addEventListener('click', function() {
                    console.log('Test AZD Provision button clicked (fallback)');
                    if (typeof window.testAzdProvision === 'function') {
                        window.testAzdProvision();
                    } else {
                        alert("AZD provision testing is not available in this view");
                    }
                });
            }
            
            // Set up tooltips
            document.querySelectorAll('.tooltip').forEach(tooltip => {
                const tooltipTextElement = tooltip.querySelector('.tooltiptext');
                if (tooltipTextElement) {
                    tooltip.addEventListener('mouseenter', function() {
                        tooltipTextElement.style.visibility = 'visible';
                        tooltipTextElement.style.opacity = '1';
                    });
                    
                    tooltip.addEventListener('mouseleave', function() {
                        tooltipTextElement.style.visibility = 'hidden';
                        tooltipTextElement.style.opacity = '0';
                    });
                }
            });
            
            console.log('Action buttons added successfully (fallback)');
        } else if (existingActionHeader) {
            console.log('Action header already exists, no need for fallback');
        } else if (!resultsContainer) {
            console.log('Results container not found, cannot add action buttons yet');
        } else {
            console.log('Results container is empty, waiting for content');
        }
    }, 2000); // Wait 2 seconds after DOM is loaded
});
