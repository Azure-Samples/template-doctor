// This script runs after the page is fully loaded to ensure action buttons are visible
// It uses direct DOM manipulation with a timeout to add buttons if they're missing

window.addEventListener('load', function () {
  // Wait a bit longer after page load to ensure all scripts have run
  setTimeout(function () {
    console.log('Running final check for action buttons...');

    // Check if results container exists and is populated
    const resultsContainer = document.getElementById('results-container');
    if (!resultsContainer || resultsContainer.innerHTML.trim() === '') {
      console.log('Results container not found or empty, cannot add direct buttons');
      return;
    }

    // Check if the buttons exist and are visible
    const existingButtons = document.querySelectorAll(
      '#fixButton, #create-github-issue-btn, #testProvisionButton, #fixButton-fallback, #create-github-issue-btn-fallback, #testProvisionButton-fallback, #fixButton-direct, #create-github-issue-btn-direct, #testProvisionButton-direct',
    );

    // If we have visible buttons, no need to add more
    let visibleButtonsExist = false;
    existingButtons.forEach((button) => {
      const style = window.getComputedStyle(button);
      if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
        visibleButtonsExist = true;
        console.log(`Found visible button: ${button.id}`);
      }
    });

    if (visibleButtonsExist) {
      console.log('Visible buttons already exist, no need for direct buttons');
      return;
    }

    console.log('No visible buttons found, adding direct buttons');

    // Create direct action buttons container with inline styles
    const directButtonsContainer = document.createElement('div');
    directButtonsContainer.id = 'direct-action-buttons';
    directButtonsContainer.setAttribute(
      'style',
      'background: white !important; border-radius: 5px !important; padding: 16px !important; margin-bottom: 20px !important; box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important; display: flex !important; flex-direction: column !important; justify-content: center !important; align-items: center !important; width: 100% !important;',
    );

    // Create header
    const header = document.createElement('div');
    header.setAttribute(
      'style',
      'width: 100% !important; text-align: center !important; margin-bottom: 15px !important;',
    );
    header.innerHTML =
      '<h3 style="margin: 0 !important; padding: 0 !important; font-size: 1.2rem !important; color: #333 !important;">Template Doctor Actions (Direct)</h3>';
    directButtonsContainer.appendChild(header);

    // Create buttons container
    const buttonsWrapper = document.createElement('div');
    buttonsWrapper.setAttribute(
      'style',
      'display: flex !important; flex-wrap: wrap !important; justify-content: center !important; gap: 15px !important; width: 100% !important;',
    );

    // Add Fix button
    const fixButton = document.createElement('a');
    fixButton.id = 'fixButton-direct';
    fixButton.href = '#';
    fixButton.className = 'btn';
    fixButton.setAttribute(
      'style',
      'opacity: 1 !important; visibility: visible !important; padding: 12px 24px !important; background-color: #0078d4 !important; color: white !important; border: none !important; border-radius: 4px !important; font-size: 1rem !important; font-weight: 500 !important; cursor: pointer !important; display: inline-flex !important; align-items: center !important; gap: 8px !important; min-width: 180px !important; justify-content: center !important; text-decoration: none !important; pointer-events: auto !important;',
    );
    fixButton.innerHTML = '<i class="fas fa-code"></i> Fix with AI Agent';
    buttonsWrapper.appendChild(fixButton);

    // Add GitHub issue button
    const githubButton = document.createElement('button');
    githubButton.id = 'create-github-issue-btn-direct';
    githubButton.className = 'btn';
    githubButton.setAttribute(
      'style',
      'opacity: 1 !important; visibility: visible !important; padding: 12px 24px !important; background-color: #2b3137 !important; color: white !important; border: none !important; border-radius: 4px !important; font-size: 1rem !important; font-weight: 500 !important; cursor: pointer !important; display: inline-flex !important; align-items: center !important; gap: 8px !important; min-width: 180px !important; justify-content: center !important; pointer-events: auto !important;',
    );
    githubButton.innerHTML = '<i class="fab fa-github"></i> Create GitHub Issue';
    buttonsWrapper.appendChild(githubButton);

    // Add test provision button only if AZD deployment tool is enabled
    if ((window.AppConfig?.deploymentTool || 'none') === 'azd') {
      const provisionButton = document.createElement('button');
      provisionButton.id = 'testProvisionButton-direct';
      provisionButton.className = 'btn';
      provisionButton.setAttribute(
        'style',
        'opacity: 1 !important; visibility: visible !important; padding: 12px 24px !important; background-color: #0078d4 !important; color: white !important; border: none !important; border-radius: 4px !important; font-size: 1rem !important; font-weight: 500 !important; cursor: pointer !important; display: inline-flex !important; align-items: center !important; gap: 8px !important; min-width: 180px !important; justify-content: center !important; pointer-events: auto !important;',
      );
      provisionButton.innerHTML = '<i class="fas fa-rocket"></i> Test AZD Provision';
      buttonsWrapper.appendChild(provisionButton);
    }

    directButtonsContainer.appendChild(buttonsWrapper);

    // Insert at the top of results container
    resultsContainer.insertBefore(directButtonsContainer, resultsContainer.firstChild);

    console.log('Direct buttons added successfully');

    // Add event handlers
    document.getElementById('fixButton-direct').addEventListener('click', function (e) {
      e.preventDefault();
      console.log('Fix button clicked (direct)');

      // Get repo URL
      let repoUrl = '';
      const repoUrlElement = document.getElementById('repo-url');
      if (repoUrlElement) {
        repoUrl = repoUrlElement.textContent || '';
      } else if (window.reportData && window.reportData.repoUrl) {
        repoUrl = window.reportData.repoUrl;
      }

      const templateUrl = encodeURIComponent(repoUrl);
      window.open(`https://insiders.vscode.dev/azure?azdTemplateUrl=${templateUrl}`, '_blank');
    });

    document
      .getElementById('create-github-issue-btn-direct')
      .addEventListener('click', function () {
        console.log('Create GitHub Issue button clicked (direct)');
        if (typeof window.createGitHubIssue === 'function') {
          window.createGitHubIssue();
        } else {
          if (window.Notifications) {
            window.Notifications.error(
              'Error',
              'GitHub issue creation is not available in this view',
            );
          } else {
            alert('GitHub issue creation is not available in this view');
          }
        }
      });

    const azdBtn = document.getElementById('testProvisionButton-direct');
    if (azdBtn) {
      azdBtn.addEventListener('click', function () {
        console.log('Test AZD Provision button clicked (direct)');
        if (typeof window.testAzdProvision === 'function') {
          window.testAzdProvision();
        } else {
          alert('AZD provision testing is not available in this view');
        }
      });
    }
  }, 3000); // Wait 3 seconds after page load
});
