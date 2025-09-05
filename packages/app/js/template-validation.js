// Template Validation UI Component
// Add this to your JavaScript files in the frontend

/**
 * Initialize the Template Validation UI
 * @param {string} containerId - ID of the container element to append the UI to
 * @param {string} templateName - Template name in owner/repo format
 * @param {string} apiBase - Base URL for API calls
 */
function initTemplateValidation(containerId, templateName, apiBase) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container element with ID "${containerId}" not found`);
    return;
  }

  // Use the frontend's configured API base
  const baseUrl =
    window.TemplateDoctorConfig && window.TemplateDoctorConfig.apiBase
      ? window.TemplateDoctorConfig.apiBase
      : apiBase || window.location.origin;

  // Create the UI elements
  const validationSection = document.createElement('div');
  validationSection.className = 'template-validation-section';
  validationSection.innerHTML = `
    <h3>Template Validation</h3>
    <p>Run template validation using the Microsoft Template Validation Action to check for best practices and common issues.</p>
    <div class="validation-controls">
      <button id="runValidationBtn" class="btn btn-primary">Run Validation</button>
    </div>
    <div id="validationResults" class="validation-results" style="display: none;">
      <div id="validationLoading">
        <p><i class="fas fa-spinner fa-spin"></i> Validation in progress...</p>
        <div id="validationProgress" class="progress-bar">
          <div class="progress-bar-inner" style="width: 0%"></div>
        </div>
      </div>
      <div id="validationOutput" style="display: none;">
        <h4>Validation Results</h4>
        <div id="validationSummary" class="validation-summary"></div>
        <div id="validationIssues" class="validation-issues"></div>
      </div>
    </div>
  `;

  container.appendChild(validationSection);

  // Style the validation section
  const style = document.createElement('style');
  style.textContent = `
    .template-validation-section {
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
    .validation-issues ul {
      padding-left: 20px;
    }
    .validation-issues li {
      margin-bottom: 8px;
    }
  `;
  document.head.appendChild(style);

  // Add event listener to the run validation button
  const runValidationBtn = document.getElementById('runValidationBtn');
  runValidationBtn.addEventListener('click', () => {
    runTemplateValidation(templateName, baseUrl);
  });
}

/**
 * Run template validation
 * @param {string} templateName - Template name in owner/repo format
 * @param {string} apiBase - Base URL for API calls
 */
async function runTemplateValidation(templateName, apiBase) {
  const validationResults = document.getElementById('validationResults');
  const validationLoading = document.getElementById('validationLoading');
  const validationOutput = document.getElementById('validationOutput');
  const validationProgress = document
    .getElementById('validationProgress')
    .querySelector('.progress-bar-inner');
  const runValidationBtn = document.getElementById('runValidationBtn');

  // Reset and show loading state
  validationResults.style.display = 'block';
  validationLoading.style.display = 'block';
  validationOutput.style.display = 'none';
  validationProgress.style.width = '10%';
  runValidationBtn.disabled = true;
  runValidationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...';

  try {
    // Call the template validation API
  const validationUrl = window.ApiRoutes ? window.ApiRoutes.build('validation-template') : `${apiBase}/api/validation-template`;
  const response = await fetch(validationUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        templateName: templateName,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const correlationId = data.runId;

    // If API already returned GitHub run info, store it so polling can use it right away
    if (data.githubRunId) {
      try {
        localStorage.setItem(
          `validation_${correlationId}`,
          JSON.stringify({
            githubRunId: data.githubRunId,
            githubRunUrl:
              data.githubRunUrl ||
              `https://github.com/Template-Doctor/template-doctor/actions/runs/${data.githubRunId}`,
            timestamp: new Date().toISOString(),
          }),
        );
        localStorage.setItem(
          'lastValidationRunInfo',
          JSON.stringify({
            githubRunId: data.githubRunId,
            githubRunUrl:
              data.githubRunUrl ||
              `https://github.com/Template-Doctor/template-doctor/actions/runs/${data.githubRunId}`,
            correlationId,
            timestamp: new Date().toISOString(),
          }),
        );
      } catch (e) {
        console.error('Error pre-storing GitHub run info:', e);
      }
    }

    // Simulate progress (we don't have real progress feedback)
    validationProgress.style.width = '20%';

    // Poll for status
    await pollValidationStatus(apiBase, correlationId);
  } catch (error) {
    console.error('Template validation error:', error);

    // Show error
    validationLoading.style.display = 'none';
    validationOutput.style.display = 'block';

    const validationSummary = document.getElementById('validationSummary');
    validationSummary.className = 'validation-summary failure';
    validationSummary.innerHTML = `<strong>Error:</strong> ${error.message}`;

    // Reset button
    runValidationBtn.disabled = false;
    runValidationBtn.innerHTML = 'Run Validation';
  }
}

/**
 * Poll for validation status
 * @param {string} apiBase - Base URL for API calls
 * @param {string} correlationId - Correlation ID from the initial validation request
 */
async function pollValidationStatus(apiBase, correlationId) {
  const validationLoading = document.getElementById('validationLoading');
  const validationOutput = document.getElementById('validationOutput');
  const validationProgress = document
    .getElementById('validationProgress')
    .querySelector('.progress-bar-inner');
  const runValidationBtn = document.getElementById('runValidationBtn');

  let progress = 20;
  let complete = false;
  let attempts = 0;
  const maxAttempts = 30; // Maximum number of polling attempts (5 minutes at 10-second intervals)

  // Load stored GitHub run ID from localStorage (if available)
  let githubRunInfo = null;
  try {
    const storedInfo = localStorage.getItem(`validation_${correlationId}`);
    if (storedInfo) {
      githubRunInfo = JSON.parse(storedInfo);
      console.log(`Loaded stored GitHub run info for ${correlationId}:`, githubRunInfo);
    }
  } catch (e) {
    console.error('Error loading GitHub run info from localStorage:', e);
  }

  // For persistent storage across browser sessions
  const storeGitHubRunInfo = (info) => {
    if (!info || !info.githubRunId) return;

    try {
      // Store specific to this correlation ID
      localStorage.setItem(
        `validation_${correlationId}`,
        JSON.stringify({
          ...info,
          timestamp: new Date().toISOString(),
        }),
      );

      // Also store as the most recent validation info
      localStorage.setItem(
        'lastValidationRunInfo',
        JSON.stringify({
          ...info,
          correlationId,
          timestamp: new Date().toISOString(),
        }),
      );

      console.log(`Stored GitHub run info for ${correlationId}:`, info);
    } catch (e) {
      console.error('Error storing GitHub run info in localStorage:', e);
    }
  };

  while (!complete && attempts < maxAttempts) {
    try {
      // Wait before polling (except for the first attempt)
      if (attempts > 0) {
        await new Promise((resolve) => setTimeout(resolve, 10000)); // 10-second polling interval
      }

      // Update progress animation
      progress = Math.min(progress + 5, 90);
      validationProgress.style.width = `${progress}%`;

      // Construct the polling URL with GitHub run ID if available
      let statusUrl = window.ApiRoutes
        ? window.ApiRoutes.build('validation-status', { query: { runId: correlationId } })
        : `${apiBase}/api/validation-status?runId=${correlationId}`;

      // Add query parameters for GitHub run ID if available
      if (githubRunInfo && githubRunInfo.githubRunId) {
        statusUrl += `&githubRunId=${githubRunInfo.githubRunId}`;
        if (githubRunInfo.githubRunUrl) {
          statusUrl += `&githubRunUrl=${encodeURIComponent(githubRunInfo.githubRunUrl)}`;
        }
      }

      console.log(`Polling validation status: ${statusUrl}`);

      // Poll for status
      const response = await fetch(statusUrl);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const statusData = await response.json();

      // Store GitHub run ID if provided in the response
      if (statusData.githubRunId) {
        githubRunInfo = {
          githubRunId: statusData.githubRunId,
          githubRunUrl: statusData.runUrl,
        };

        // Store for future use
        storeGitHubRunInfo(githubRunInfo);
      }

      // Check if validation is complete
      if (statusData.status === 'completed') {
        complete = true;
        validationProgress.style.width = '100%';

        // Show results
        validationLoading.style.display = 'none';
        validationOutput.style.display = 'block';

        const validationSummary = document.getElementById('validationSummary');
        const validationIssues = document.getElementById('validationIssues');

        if (statusData.conclusion === 'success') {
          validationSummary.className = 'validation-summary success';
          validationSummary.innerHTML =
            '<strong>Success!</strong> The template passed all validation checks.';

          // Show passed checks if available
          if (statusData.results && statusData.results.details) {
            const passedChecks = statusData.results.details.filter((d) => d.status === 'pass');
            if (passedChecks.length > 0) {
              validationIssues.innerHTML = `
                <h5>Passed Checks:</h5>
                <ul>
                  ${passedChecks.map((check) => `<li><strong>${check.category}:</strong> ${check.message}</li>`).join('')}
                </ul>
              `;
            }
          }
        } else {
          validationSummary.className = 'validation-summary failure';
          validationSummary.innerHTML =
            '<strong>Validation Failed</strong> The template has issues that need to be addressed.';

          // Show all checks, both passed and failed
          if (statusData.results && statusData.results.details) {
            let failedChecksHtml = '';
            let warningChecksHtml = '';
            let passedChecksHtml = '';

            const failedChecks = statusData.results.details.filter((d) => d.status === 'fail');
            const warningChecks = statusData.results.details.filter((d) => d.status === 'warn');
            const passedChecks = statusData.results.details.filter((d) => d.status === 'pass');

            if (failedChecks.length > 0) {
              failedChecksHtml = `
                <h5>Issues Found:</h5>
                <ul>
                  ${failedChecks
                    .map((check) => {
                      let issuesHtml = '';
                      if (check.issues && check.issues.length) {
                        issuesHtml = `<ul>${check.issues.map((issue) => `<li>${issue}</li>`).join('')}</ul>`;
                      }
                      return `<li><strong>❌ ${check.category}:</strong> ${check.message}${issuesHtml}</li>`;
                    })
                    .join('')}
                </ul>
              `;
            }

            if (warningChecks.length > 0) {
              warningChecksHtml = `
                <h5>Warnings:</h5>
                <ul>
                  ${warningChecks.map((check) => `<li><strong>⚠️ ${check.category}:</strong> ${check.message}</li>`).join('')}
                </ul>
              `;
            }

            if (passedChecks.length > 0) {
              passedChecksHtml = `
                <h5>Passed Checks:</h5>
                <ul>
                  ${passedChecks.map((check) => `<li><strong>✅ ${check.category}:</strong> ${check.message}</li>`).join('')}
                </ul>
              `;
            }

            validationIssues.innerHTML = failedChecksHtml + warningChecksHtml + passedChecksHtml;
          }
        }

        // Add link to GitHub Actions run
        if (statusData.runUrl) {
          validationSummary.innerHTML += `<p><a href="${statusData.runUrl}" target="_blank">View detailed results on GitHub</a></p>`;
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
    validationLoading.style.display = 'none';
    validationOutput.style.display = 'block';

    const validationSummary = document.getElementById('validationSummary');
    validationSummary.className = 'validation-summary failure';
    validationSummary.innerHTML = `
      <strong>Timeout:</strong> The validation is taking longer than expected. 
      <p>You can check the status later using correlation ID: ${correlationId}</p>
    `;

    // Add link to GitHub Actions run if available
    if (githubRunInfo && githubRunInfo.githubRunUrl) {
      validationSummary.innerHTML += `<p><a href="${githubRunInfo.githubRunUrl}" target="_blank">View GitHub workflow run</a></p>`;
    }
  }

  // Reset button
  runValidationBtn.disabled = false;
  runValidationBtn.innerHTML = 'Run Validation';
}

// Expose globally
window.TemplateValidation = {
  init: initTemplateValidation,
  run: runTemplateValidation,
};
