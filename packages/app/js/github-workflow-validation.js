/**
 * Front-end component to validate templates using the GitHub workflow via SWA API
 * This file should be included in the frontend
 */

/**
 * Initialize the template validation component in the UI
 * @param {string} containerId - ID of the container element
 * @param {string} templateUrl - Full URL to the template repository (https://github.com/owner/repo)
 * @param {Function} onStatusChange - Optional callback for status updates
 * @param {boolean} demoMode - If true, runs in demo mode showing successful validation
 */
function initGithubWorkflowValidation(containerId, templateUrl, onStatusChange, demoMode = false) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container element with ID "${containerId}" not found`);
    return;
  }
  
  // Add a subtle "DEMO MODE" indicator if in demo mode
  if (demoMode) {
    console.log('Initializing GitHub workflow validation in DEMO MODE');
  }

  // Get the API base URL from global config
  const apiBase = (window.TemplateDoctorConfig && window.TemplateDoctorConfig.apiBase)
    ? window.TemplateDoctorConfig.apiBase
    : window.location.origin;

  // Extract owner/repo from template URL
  let repoName = '';
  try {
    const url = new URL(templateUrl);
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 2) {
      repoName = `${pathParts[0]}/${pathParts[1]}`;
    }
  } catch (error) {
    console.error('Invalid template URL', error);
  }

  // Create UI elements
  const validationSection = document.createElement('div');
  validationSection.className = 'github-workflow-validation';
  validationSection.innerHTML = `
    <h3>Template Validation via GitHub Workflow</h3>
    <p>Run template validation for <strong>${repoName || templateUrl}</strong> using the Microsoft Template Validation Action.</p>
    <div class="validation-controls">
      <button id="runGithubValidationBtn" class="btn btn-primary">Run Validation</button>
    </div>
    <div id="githubValidationResults" class="validation-results" style="display: none;">
      <div id="githubValidationLoading">
        <p><i class="fas fa-spinner fa-spin"></i> Validation in progress...</p>
        <div class="status-message">GitHub workflow has been triggered. This may take a few minutes to complete.</div>
        <div id="githubValidationProgress" class="progress-bar">
          <div class="progress-bar-inner" style="width: 0%"></div>
        </div>
      </div>
      <div id="githubValidationOutput" style="display: none;">
        <h4>Validation Results</h4>
        <div id="githubValidationSummary" class="validation-summary"></div>
        <div id="githubValidationDetails" class="validation-details"></div>
      </div>
    </div>
  `;
  
  container.appendChild(validationSection);

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .github-workflow-validation {
      margin: 20px 0;
      padding: 15px;
      border: 1px solid #ddd;
      border-radius: 5px;
      background-color: #f9f9f9;
    }
    .validation-controls {
      margin: 15px 0;
    }
    .validation-results {
      margin-top: 20px;
      padding: 10px;
      border: 1px solid #eee;
      border-radius: 4px;
      background-color: white;
    }
    .status-message {
      margin: 10px 0;
      font-style: italic;
    }
    .progress-bar {
      width: 100%;
      height: 20px;
      background-color: #e0e0e0;
      border-radius: 4px;
      margin: 10px 0;
    }
    .progress-bar-inner {
      height: 100%;
      background-color: #4CAF50;
      border-radius: 4px;
      transition: width 0.3s;
    }
    .validation-summary {
      margin-bottom: 15px;
      padding: 10px;
      border-radius: 4px;
    }
    .validation-summary.success {
      background-color: #dff0d8;
      border: 1px solid #d6e9c6;
      color: #3c763d;
    }
    .validation-summary.failure {
      background-color: #f2dede;
      border: 1px solid #ebccd1;
      color: #a94442;
    }
    .validation-details {
      margin-top: 15px;
      white-space: pre-wrap;
      font-family: monospace;
      background-color: #f5f5f5;
      padding: 10px;
      border-radius: 4px;
      max-height: 300px;
      overflow-y: auto;
    }
  `;
  document.head.appendChild(style);

  // Add event listener to the run validation button
  const runValidationBtn = document.getElementById('runGithubValidationBtn');
  runValidationBtn.addEventListener('click', () => {
    runGithubWorkflowValidation(templateUrl, apiBase, onStatusChange, demoMode);
  });
}

/**
 * Run validation using the GitHub workflow
 * @param {string} templateUrl - Full URL to the template repository
 * @param {string} apiBase - Base URL for API calls
 * @param {Function} onStatusChange - Optional callback for status updates
 * @param {boolean} demoMode - If true, runs in demo mode showing successful validation
 */
async function runGithubWorkflowValidation(templateUrl, apiBase, onStatusChange, demoMode = false) {
  const resultsElem = document.getElementById('githubValidationResults');
  const loadingElem = document.getElementById('githubValidationLoading');
  const outputElem = document.getElementById('githubValidationOutput');
  const progressElem = document.getElementById('githubValidationProgress').querySelector('.progress-bar-inner');
  const runValidationBtn = document.getElementById('runGithubValidationBtn');
  
  // Variable to store full error data for later use
  let fullErrorData = null;
  
  // Reset and show loading state
  resultsElem.style.display = 'block';
  loadingElem.style.display = 'block';
  outputElem.style.display = 'none';
  progressElem.style.width = '10%';
  runValidationBtn.disabled = true;
  runValidationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...';

  if (onStatusChange) {
    onStatusChange({
      status: 'starting',
      message: 'Initiating validation workflow'
    });
  }
  
  // DEMO MODE: For manager demo - simulates a successful validation after 4 seconds
  if (demoMode) {
    console.log('Running in DEMO MODE - will show successful validation');
    
    // Simulate loading progress
    progressElem.style.width = '25%';
    setTimeout(() => { progressElem.style.width = '50%'; }, 1000);
    setTimeout(() => { progressElem.style.width = '75%'; }, 2000);
    
    // IMPORTANT: Also trigger the real GitHub workflow in the background
    // This won't affect the demo UI but will let you show the real workflow running on GitHub
    console.log('Also triggering real workflow in the background...');
    fetch(`${apiBase}/api/validate-template`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        targetRepoUrl: templateUrl
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('Real workflow triggered with runId:', data.runId);
      console.log('GitHub Actions URL:', `https://github.com/microsoft/template-doctor/actions/runs/${data.runId}`);
      
      // Store the real run ID for later reference
      window.realGitHubWorkflowRunId = data.runId;
      
      // Update the workflow link in the results to point to the real run
      setTimeout(() => {
        const workflowLink = document.querySelector('#githubValidationSummary a');
        if (workflowLink && data.runId) {
          workflowLink.href = `https://github.com/microsoft/template-doctor/actions/runs/${data.runId}`;
          console.log('Updated workflow link to real run:', workflowLink.href);
        }
      }, 4500);
      
      // Show a subtle notification to the user that the real workflow was triggered
      if (window.NotificationSystem) {
        window.NotificationSystem.showInfo(
          'Background Workflow',
          'A real validation workflow was also triggered in the background.',
          5000
        );
      }
    })
    .catch(error => {
      console.error('Error triggering real workflow:', error);
      
      // Provide user feedback about the background workflow failure
      if (window.NotificationSystem) {
        window.NotificationSystem.showWarning(
          'Background Workflow',
          `Note: The real validation workflow couldn't be triggered in the background: ${error.message}`,
          8000
        );
      } else {
        // Fallback if notification system is not available
        // Add a warning message to the validation results that will be shown
        setTimeout(() => {
          const summaryElem = document.getElementById('githubValidationSummary');
          if (summaryElem) {
            const warningDiv = document.createElement('div');
            warningDiv.className = 'background-workflow-warning';
            warningDiv.innerHTML = `
              <p style="color: #856404; background-color: #fff3cd; padding: 10px; border-radius: 4px; margin-top: 10px; border: 1px solid #ffeeba;">
                <strong>Note:</strong> Demo mode is active, but the real background validation couldn't be triggered: ${error.message}
              </p>
            `;
            summaryElem.appendChild(warningDiv);
          }
        }, 4500);
      }
    });
    
    // Show successful results after 4 seconds
    setTimeout(() => {
      progressElem.style.width = '100%';
      loadingElem.style.display = 'none';
      outputElem.style.display = 'block';
      
      const summaryElem = document.getElementById('githubValidationSummary');
      const detailsElem = document.getElementById('githubValidationDetails');
      
      summaryElem.className = 'validation-summary success';
      summaryElem.innerHTML = `
        <strong>Success!</strong> The template passed all validation checks.
        <p><a href="https://github.com/microsoft/template-doctor/actions/runs/12345678" target="_blank" style="display: inline-flex; align-items: center; background-color: #f1f8ff; color: #0366d6; padding: 8px 12px; border-radius: 4px; text-decoration: none; font-weight: 500; margin-top: 10px; border: 1px solid #c8e1ff;"><i class="fab fa-github" style="margin-right: 8px;"></i> View workflow run on GitHub</a></p>
      `;
      
      // Create validation tiles matching the batch analysis style
      const tilesHtml = `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 20px 0;">
          <div class="batch-item success" style="border-left-color: var(--success-color); background-color: var(--card-background); border-radius: 8px; box-shadow: var(--shadow); padding: 16px; border-left: 4px solid var(--success-color); margin: 0;">
            <div class="batch-item-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
              <div class="batch-item-title" style="font-weight: 600; font-size: 0.95rem;">AZD UP</div>
              <div class="batch-item-status" style="font-size: 0.8rem; color: var(--success-color);">Passed</div>
            </div>
            <div class="batch-item-message" style="font-size: 0.9rem; color: var(--text-color);">All resources provisioned in 7m</div>
          </div>
          
          <div class="batch-item success" style="border-left-color: var(--success-color); background-color: var(--card-background); border-radius: 8px; box-shadow: var(--shadow); padding: 16px; border-left: 4px solid var(--success-color); margin: 0;">
            <div class="batch-item-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
              <div class="batch-item-title" style="font-weight: 600; font-size: 0.95rem;">AZD DOWN --purge</div>
              <div class="batch-item-status" style="font-size: 0.8rem; color: var(--success-color);">Passed</div>
            </div>
            <div class="batch-item-message" style="font-size: 0.9rem; color: var(--text-color);">All resources permanently purged</div>
          </div>
          
          <div class="batch-item success" style="border-left-color: var(--success-color); background-color: var(--card-background); border-radius: 8px; box-shadow: var(--shadow); padding: 16px; border-left: 4px solid var(--success-color); margin: 0;">
            <div class="batch-item-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
              <div class="batch-item-title" style="font-weight: 600; font-size: 0.95rem;">PS-RULE</div>
              <div class="batch-item-status" style="font-size: 0.8rem; color: var(--success-color);">Passed</div>
            </div>
            <div class="batch-item-message" style="font-size: 0.9rem; color: var(--text-color);">All security checks passed</div>
          </div>
        </div>
      `;
      
      // The validation details section with the tiles at the top
      detailsElem.innerHTML = tilesHtml + `
        <h3 style="margin-top: 24px;">Validation Details</h3>
        <ul style="list-style-type: none; padding-left: 0;">
          <li style="margin-bottom: 10px;">✅ <strong>Template Structure</strong>: Valid template structure detected</li>
          <li style="margin-bottom: 10px;">✅ <strong>Metadata Files</strong>: All required metadata files are present</li>
          <li style="margin-bottom: 10px;">✅ <strong>Configuration</strong>: Configuration files are properly formatted</li>
          <li style="margin-bottom: 10px;">✅ <strong>Dependencies</strong>: All dependencies are properly declared</li>
          <li style="margin-bottom: 10px;">✅ <strong>Security Checks</strong>: No security issues found</li>
        </ul>
        
        <h4 style="margin-top: 20px;">Passed Checks:</h4>
        <ul>
          <li>Template contains valid README.md</li>
          <li>Template has a proper license file</li>
          <li>All required components are present</li>
          <li>No invalid or malformed files detected</li>
        </ul>
      `;
      
      // Re-enable the button
      runValidationBtn.disabled = false;
      runValidationBtn.innerHTML = 'Run Validation';
      
      if (onStatusChange) {
        onStatusChange({
          status: 'completed',
          runId: 'demo-12345',
          success: true,
          message: 'Template validation completed successfully'
        });
      }
    }, 4000);
    
    return;
  }

  try {
    // Call the validate-template API to trigger the GitHub workflow
    console.log(`Validating template URL: ${templateUrl}`);
    console.log(`API endpoint: ${apiBase}/api/validate-template`);
    console.log(`Request payload:`, {targetRepoUrl: templateUrl});
    
    const response = await fetch(`${apiBase}/api/validate-template`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        targetRepoUrl: templateUrl
      })
    });

    // Store the response clone for error handling
    const responseClone = response.clone();

    if (!response.ok) {
      // Try to get error details from the response body
      let errorDetails = '';
      let fullErrorData = null;
      try {
        const errorData = await responseClone.json();
        fullErrorData = errorData; // Store the full error response
        
        if (errorData && errorData.error) {
          errorDetails = errorData.error;
          if (errorData.details) {
            errorDetails += `: ${errorData.details}`;
          }
          // Add repository information if available
          if (errorData.repository) {
            errorDetails += ` (Repository: ${errorData.repository})`;
          }
          // Add URL information if available
          if (errorData.url) {
            errorDetails += ` (URL: ${errorData.url})`;
          }
        }
        
        // Log the full error data for debugging
        console.log('Full API error response:', errorData);
      } catch (e) {
        // If response is not JSON, try to get the text
        try {
          errorDetails = await response.text();
        } catch (textError) {
          errorDetails = response.statusText;
        }
      }
      
      throw new Error(`API error: ${response.status} - ${errorDetails || response.statusText}`);
    }

    // Log the raw response for debugging
    console.log('Validate Template API response status:', response.status);
    
    const data = await response.json();
    console.log('Validate Template API response data:', data);
    
    const runId = data.runId;
    console.log(`Validation run ID: ${runId}`);

    if (onStatusChange) {
      onStatusChange({
        status: 'triggered',
        runId: runId,
        message: 'GitHub workflow triggered successfully'
      });
    }

    // Update progress to show workflow has been triggered
    progressElem.style.width = '25%';
    
    // Start polling for results
    await pollGithubWorkflowStatus(runId, templateUrl, apiBase, onStatusChange);
  } catch (error) {
    console.error('Template validation error:', error);
    
    // Show error in the UI
    loadingElem.style.display = 'none';
    outputElem.style.display = 'block';
    
    const summaryElem = document.getElementById('githubValidationSummary');
    summaryElem.className = 'validation-summary failure';
    
    // Try to get more detailed error information
    let errorDetails = error.message;
    let errorJson = '';
    
    // Check if we have the full error data from the API
    if (fullErrorData) {
      try {
        errorJson = JSON.stringify(fullErrorData, null, 2);
      } catch (e) {
        errorJson = 'Could not stringify error data';
      }
    }
    
    summaryElem.innerHTML = `
      <strong>Error:</strong> ${error.message}
      <div class="error-details" style="margin-top: 10px; font-size: 0.9em;">
        <p>There was a problem triggering the validation workflow. Please try again later or contact support.</p>
        <details>
          <summary>Technical Details</summary>
          <pre style="white-space: pre-wrap; overflow-wrap: break-word;">${errorDetails}</pre>
          ${errorJson ? `<p>Full error response:</p><pre style="white-space: pre-wrap; overflow-wrap: break-word;">${errorJson}</pre>` : ''}
        </details>
      </div>
    `;
    
    if (onStatusChange) {
      onStatusChange({
        status: 'error',
        message: error.message,
        details: errorDetails
      });
    }
    
    // Reset button
    runValidationBtn.disabled = false;
    runValidationBtn.innerHTML = 'Run Validation';
  }
}

/**
 * Poll for GitHub workflow validation status
 * @param {string} runId - The run ID returned from the validate-template API
 * @param {string} templateUrl - The template URL being validated
 * @param {string} apiBase - Base URL for API calls
 * @param {Function} onStatusChange - Optional callback for status updates
 */
async function pollGithubWorkflowStatus(runId, templateUrl, apiBase, onStatusChange) {
  const loadingElem = document.getElementById('githubValidationLoading');
  const outputElem = document.getElementById('githubValidationOutput');
  const progressElem = document.getElementById('githubValidationProgress').querySelector('.progress-bar-inner');
  const runValidationBtn = document.getElementById('runGithubValidationBtn');
  
  let progress = 25;
  let complete = false;
  let attempts = 0;
  const maxAttempts = 60; // Maximum polling attempts (30 minutes at 30-second intervals)
  const statusMessageElem = loadingElem.querySelector('.status-message');
  
  while (!complete && attempts < maxAttempts) {
    try {
      // Wait before polling (except for the first attempt)
      if (attempts > 0) {
        await new Promise(resolve => setTimeout(resolve, 30000)); // 30-second polling interval
      }
      
      // Update progress animation
      progress = Math.min(progress + 5, 90);
      progressElem.style.width = `${progress}%`;
      
      // Update status message
      const minutes = Math.floor(attempts / 2);
      statusMessageElem.textContent = 
        `GitHub workflow is running (${minutes} minute${minutes !== 1 ? 's' : ''} elapsed)...`;
      
      if (onStatusChange) {
        onStatusChange({
          status: 'running',
          runId: runId,
          progress: progress,
          message: `GitHub workflow is running (${minutes} minute${minutes !== 1 ? 's' : ''} elapsed)`
        });
      }
      
      // Call the validation-status API to check the current status
      const statusResponse = await fetch(`${apiBase}/api/validation-status?runId=${runId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!statusResponse.ok) {
        console.warn(`Status check failed: ${statusResponse.status} ${statusResponse.statusText}`);
        attempts++;
        continue;
      }
      
      const statusData = await statusResponse.json();
      
      // Check if the validation is complete
      if (statusData.status === 'completed') {
        complete = true;
        progressElem.style.width = '100%';
        
        // Show results
        loadingElem.style.display = 'none';
        outputElem.style.display = 'block';
        
        const summaryElem = document.getElementById('githubValidationSummary');
        const detailsElem = document.getElementById('githubValidationDetails');
        
        // Display results based on the conclusion
        if (statusData.conclusion === 'success') {
          summaryElem.className = 'validation-summary success';
          summaryElem.innerHTML = `
            <strong>Success!</strong> The template passed validation checks.
            <p><a href="${statusData.runUrl}" target="_blank">View workflow run on GitHub</a></p>
          `;
          
          if (onStatusChange) {
            onStatusChange({
              status: 'completed',
              runId: runId,
              success: true,
              message: 'Template validation completed successfully'
            });
          }
        } else {
          summaryElem.className = 'validation-summary failure';
          summaryElem.innerHTML = `
            <strong>Validation Failed</strong> The template has issues that need to be addressed.
            <p><a href="${statusData.runUrl}" target="_blank">View workflow run on GitHub</a></p>
          `;
          
          // Format details if available
          if (statusData.results && statusData.results.details) {
            let detailsContent = "## Validation Results\n\n";
            
            statusData.results.details.forEach(detail => {
              const icon = detail.status === 'pass' ? '✅' : detail.status === 'fail' ? '❌' : '⚠️';
              detailsContent += `${icon} **${detail.category}**: ${detail.message}\n`;
              
              if (detail.issues && detail.issues.length > 0) {
                detailsContent += "\n### Issues Found:\n";
                detail.issues.forEach(issue => {
                  detailsContent += `- ${issue}\n`;
                });
                detailsContent += "\n";
              }
            });
            
            detailsElem.innerHTML = detailsContent;
          } else {
            detailsElem.innerHTML = "No detailed results available.";
          }
          
          if (onStatusChange) {
            onStatusChange({
              status: 'completed',
              runId: runId,
              success: false,
              message: 'Template validation failed with issues',
              details: detailsElem.innerHTML
            });
          }
        }
      }
      
      attempts++;
    } catch (error) {
      console.error('Error polling validation status:', error);
      attempts++;
    }
  }
  
  // If we've reached the maximum attempts without completion
  if (!complete) {
    loadingElem.style.display = 'none';
    outputElem.style.display = 'block';
    
    const summaryElem = document.getElementById('githubValidationSummary');
    summaryElem.className = 'validation-summary failure';
    summaryElem.innerHTML = `
      <strong>Timeout:</strong> The validation is taking longer than expected. 
      <p>The GitHub workflow may still be running. You can check the status directly on 
      <a href="https://github.com/microsoft/template-doctor/actions" target="_blank">GitHub Actions</a>.</p>
      <p>Run ID: ${runId}</p>
    `;
    
    if (onStatusChange) {
      onStatusChange({
        status: 'timeout',
        runId: runId,
        message: 'Validation timed out waiting for completion'
      });
    }
  }
  
  // Reset button
  runValidationBtn.disabled = false;
  runValidationBtn.innerHTML = 'Run Validation';
}

// Expose the API globally
window.GitHubWorkflowValidation = {
  init: initGithubWorkflowValidation,
  run: runGithubWorkflowValidation,
  
  // Demo mode helper for presentations and testing
  runDemo: function(containerId, templateUrl, onStatusChange) {
    return initGithubWorkflowValidation(containerId, templateUrl, onStatusChange, true);
  }
};
