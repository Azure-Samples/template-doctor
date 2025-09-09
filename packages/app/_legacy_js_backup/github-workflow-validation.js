/**
 * Front-end component to validate templates using the GitHub workflow via SWA API
 * This file should be included in the frontend
 */

/**
 * Initialize the template validation component in the UI
 * @param {string} containerId - ID of the container element
 * @param {string} templateUrl - Full URL to the template repository (https://github.com/owner/repo)
 * @param {Function} onStatusChange - Optional callback for status updates
 */
function initGithubWorkflowValidation(containerId, templateUrl, onStatusChange) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container element with ID "${containerId}" not found`);
    return;
  }

  // Get the API base URL from global config
  const apiBase =
    window.TemplateDoctorConfig && window.TemplateDoctorConfig.apiBase
      ? window.TemplateDoctorConfig.apiBase
      : window.location.origin;

  // Construct API endpoints based on environment
  // For Azure Static Web Apps, the API path should be '/api/validation-template'
  // For local development with Functions emulator, we need to use port 7071
  const isLocalhost =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // Override apiBase for local development to use Functions port 7071
  const localApiBase = isLocalhost ? 'http://localhost:7071' : apiBase;
  const apiPathPrefix = 'api'; // Using 'api' for both to simplify

  // Normalize the apiBase to ensure correct path joining
  const apiBaseNormalized = localApiBase.endsWith('/') ? localApiBase : localApiBase + '/';

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
        <div class="validation-spinner-container">
          <i class="fas fa-spinner fa-spin validation-spinner"></i>
          <div class="status-message">GitHub workflow has been triggered. This may take a few minutes to complete.</div>
          <label class="job-logs-toggle" style="margin-top: 10px; font-size: 14px; color: #24292e;">
            <input type="checkbox" id="includeJobLogsChk" /> Show per-job logs links
          </label>
          <button id="githubCancelValidationBtn" class="btn btn-danger" style="margin-top: 15px; display: none;">Cancel Validation</button>
        </div>
        <div id="validationWorkflowLink" class="workflow-link" style="display: none;"></div>
        <div id="validationLogs" class="validation-logs" style="display: none;"></div>
        <div id="validationJobLogs" class="validation-job-logs" style="display: none;"></div>
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
      padding: 20px;
      border: 1px solid #ddd;
      border-radius: 6px;
      background-color: #f9f9f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    }
    .validation-controls {
      margin: 15px 0;
    }
    .btn {
      padding: 8px 16px;
      border-radius: 6px;
      border: 1px solid transparent;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease-in-out;
    }
    .btn-primary {
      background-color: #0366d6;
      color: white;
    }
    .btn-primary:hover {
      background-color: #0255b3;
    }
    .btn-primary:disabled {
      background-color: #7aacde;
      cursor: not-allowed;
    }
    .validation-results {
      margin-top: 20px;
      padding: 16px;
      border: 1px solid #e1e4e8;
      border-radius: 6px;
      background-color: white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .status-message {
      margin: 10px 0;
      font-style: italic;
      color: #586069;
    }
    .validation-spinner-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px 0;
    }
    .validation-spinner {
      font-size: 32px;
      color: #0366d6;
      margin-bottom: 20px;
    }
    .workflow-link {
      margin: 15px 0;
      padding: 12px;
      background-color: #f6f8fa;
      border-radius: 6px;
      border: 1px solid #e1e4e8;
      text-align: center;
    }
    .workflow-link a {
      display: inline-flex;
      align-items: center;
      text-decoration: none;
      color: #0366d6;
      font-weight: 500;
      transition: color 0.2s ease;
    }
    .workflow-link a:hover {
      color: #035fc7;
      text-decoration: underline;
    }
    .workflow-link a i {
      margin-right: 8px;
    }
    .validation-logs {
      background-color: #282c34;
      color: #abb2bf;
      font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
      padding: 16px;
      border-radius: 6px;
      max-height: 200px;
      overflow-y: auto;
      margin-top: 15px;
      white-space: pre-wrap;
      font-size: 13px;
      line-height: 1.5;
    }
    .validation-summary {
      margin-bottom: 20px;
      border-radius: 6px;
      overflow: hidden;
    }
    .validation-details {
      margin-top: 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      line-height: 1.5;
      color: #24292e;
      max-height: 500px;
      overflow-y: auto;
      border-radius: 6px;
    }
    .btn-danger {
      background-color: #d73a49;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 8px 16px;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }
    .btn-danger:hover {
      background-color: #cb2431;
    }
    .btn-danger:disabled {
      background-color: #f1aeb5;
      cursor: not-allowed;
    }
    .validation-job-logs {
      margin-top: 12px;
      background: #f6f8fa;
      border: 1px solid #e1e4e8;
      border-radius: 6px;
      padding: 12px;
      color: #24292e;
      width: 100%;
    }
    .validation-job-logs h5 {
      margin: 0 0 8px 0;
      font-size: 14px;
    }
    .validation-job-logs ul { margin: 0; padding-left: 18px; }
    .validation-job-logs li { margin: 4px 0; }
    
    /* Custom styling for details/summary elements */
    details {
      margin: 10px 0;
    }
    details summary {
      cursor: pointer;
      font-weight: 500;
      padding: 8px 12px;
      background-color: #f6f8fa;
      border-radius: 4px;
      border: 1px solid #e1e4e8;
    }
    details summary:hover {
      background-color: #f0f3f6;
    }
    details[open] summary {
      margin-bottom: 10px;
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
    }
  `;
  document.head.appendChild(style);

  // Add event listener to the run validation button
  const runValidationBtn = document.getElementById('runGithubValidationBtn');
  runValidationBtn.addEventListener('click', () => {
    runGithubWorkflowValidation(templateUrl, apiBase, onStatusChange);
  });
}

/**
 * Run validation using the GitHub workflow
 * @param {string} templateUrl - Full URL to the template repository
 * @param {string} apiBase - Base URL for API calls
 * @param {Function} onStatusChange - Optional callback for status updates
 */
async function runGithubWorkflowValidation(templateUrl, apiBase, onStatusChange) {
  // Construct API endpoints based on environment
  // For Azure Static Web Apps, the API path should be '/api/validation-template'
  // For local development with Functions emulator, we need to use port 7071
  const isLocalhost =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // Override apiBase for local development to use Functions port 7071
  const localApiBase = isLocalhost ? 'http://localhost:7071' : apiBase;
  const apiPathPrefix = 'api'; // Using 'api' for both to simplify

  // Normalize the apiBase to ensure correct path joining
  const apiBaseNormalized = localApiBase.endsWith('/') ? localApiBase : localApiBase + '/';

  // Generate a unique call ID for this request to help with troubleshooting
  const callId = `req-${Math.random().toString(36).substring(2, 10)}`;

  // Debug log the URL construction
  console.log(`[${callId}] API Base:`, apiBase);
  console.log(`[${callId}] Local API Base:`, localApiBase);
  console.log(`[${callId}] API Base Normalized:`, apiBaseNormalized);
  console.log(`[${callId}] API Path Prefix:`, apiPathPrefix);
  console.log(
    `[${callId}] Full API URL:`,
    `${apiBaseNormalized}${apiPathPrefix}/validation-template`,
  );

  const resultsElem = document.getElementById('githubValidationResults');
  const loadingElem = document.getElementById('githubValidationLoading');
  const outputElem = document.getElementById('githubValidationOutput');
  const workflowLinkElem = document.getElementById('validationWorkflowLink');
  const logsElem = document.getElementById('validationLogs');
  const runValidationBtn = document.getElementById('runGithubValidationBtn');
  const cancelValidationBtn = document.getElementById('githubCancelValidationBtn');
  const jobLogsElem = document.getElementById('validationJobLogs');

  // Variable to store full error data for later use
  let fullErrorData = null;

  // Reset and show loading state
  resultsElem.style.display = 'block';
  loadingElem.style.display = 'block';
  outputElem.style.display = 'none';
  workflowLinkElem.style.display = 'none';
  logsElem.style.display = 'none';
  logsElem.innerHTML = ''; // Clear any previous logs
  runValidationBtn.disabled = true;
  runValidationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...';

  if (onStatusChange) {
    onStatusChange({
      status: 'starting',
      message: 'Initiating validation workflow',
    });
  }

  try {
    // Call the validation-template API to trigger the GitHub workflow
    console.log(`[${callId}] Validating template URL: ${templateUrl}`);

    // Add initial log entry
    logsElem.style.display = 'block';
    logsElem.innerHTML = `[${new Date().toISOString()}] Starting validation for ${templateUrl}\n`;
    logsElem.innerHTML += `[${new Date().toISOString()}] Client request ID: ${callId}\n`;
    logsElem.scrollTop = logsElem.scrollHeight;

    // Create a properly formatted URL for the API
    const apiUrl = new URL(`${apiPathPrefix}/validation-template`, apiBaseNormalized);
    console.log(`[${callId}] Final API URL: ${apiUrl.toString()}`);
    logsElem.innerHTML += `[${new Date().toISOString()}] Sending request to: ${apiUrl.toString()}\n`;

    // Set up a timeout to handle network issues
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('API request timed out after 30 seconds')), 30000);
    });

    // Create the fetch request
    const fetchPromise = fetch(apiUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-ID': callId, // Add a client ID header for tracing
      },
      body: JSON.stringify({
        // Send both parameter formats to support both environments
        templateUrl: templateUrl,
        targetRepoUrl: templateUrl,
      }),
    });

    // Race the fetch against the timeout
    const response = await Promise.race([fetchPromise, timeoutPromise]);

    // Store the response clone for error handling
    const responseClone = response.clone();

    if (!response.ok) {
      // Show initial error in logs
      logsElem.innerHTML += `[${new Date().toISOString()}] API error response: ${response.status} ${response.statusText}\n`;

      // Try to get error details from the response body
      let errorDetails = '';
      let errorData = null;
      try {
        errorData = await responseClone.json();
        fullErrorData = errorData; // Store the full error response

        console.log(`[${callId}] Full API error response:`, errorData);

        if (errorData) {
          // Format detailed error message
          if (errorData.error) {
            errorDetails = errorData.error;

            // Add additional error details if available
            if (errorData.details) {
              errorDetails += `: ${errorData.details}`;
            }

            // Add request ID for tracking in logs
            if (errorData.requestId) {
              errorDetails += ` (Request ID: ${errorData.requestId})`;
              logsElem.innerHTML += `[${new Date().toISOString()}] Server request ID: ${errorData.requestId}\n`;
            }

            // Add timestamp if available
            if (errorData.timestamp) {
              logsElem.innerHTML += `[${new Date().toISOString()}] Server timestamp: ${errorData.timestamp}\n`;
            }
          }

          // Log diagnostic information if available
          if (errorData.diagnosticInfo) {
            console.log(`[${callId}] Error diagnostic info:`, errorData.diagnosticInfo);

            // Log a more user-friendly summary of diagnostics
            logsElem.innerHTML += `[${new Date().toISOString()}] Diagnostic summary:\n`;

            // Check GitHub connectivity info
            if (errorData.diagnosticInfo.github) {
              if (errorData.diagnosticInfo.github.connected === false) {
                logsElem.innerHTML += `  • GitHub API connectivity: Failed (${errorData.diagnosticInfo.github.error || 'Unknown error'})\n`;
              } else if (errorData.diagnosticInfo.github.connected === true) {
                logsElem.innerHTML += `  • GitHub API connectivity: Success (connected as: ${errorData.diagnosticInfo.github.username || 'Unknown user'})\n`;

                if (errorData.diagnosticInfo.github.scopes) {
                  logsElem.innerHTML += `  • Token scopes: ${errorData.diagnosticInfo.github.scopes}\n`;

                  // Check if workflow scope is missing
                  if (!errorData.diagnosticInfo.github.scopes.includes('workflow')) {
                    logsElem.innerHTML += `  • MISSING WORKFLOW SCOPE: Your token does not have the required 'workflow' scope\n`;
                  }
                }

                if (errorData.diagnosticInfo.github.rateLimit) {
                  const limit = errorData.diagnosticInfo.github.rateLimit;
                  logsElem.innerHTML += `  • Rate limit: ${limit.remaining}/${limit.limit} remaining\n`;
                }
              }
            }

            // Log token info if available
            if (
              errorData.diagnosticInfo.envVars &&
              errorData.diagnosticInfo.envVars.hasWorkflowToken !== undefined
            ) {
              logsElem.innerHTML += `  • Token provided: ${errorData.diagnosticInfo.envVars.hasWorkflowToken ? 'Yes' : 'No'}\n`;

              if (
                errorData.diagnosticInfo.envVars.hasWorkflowToken &&
                errorData.diagnosticInfo.envVars.tokenLength
              ) {
                logsElem.innerHTML += `  • Token length: ${errorData.diagnosticInfo.envVars.tokenLength} characters\n`;
              }

              if (errorData.diagnosticInfo.tokenWarning) {
                logsElem.innerHTML += `  • Token warning: ${errorData.diagnosticInfo.tokenWarning}\n`;
              }
            }

            // Log storage info if available
            if (errorData.diagnosticInfo.storage) {
              logsElem.innerHTML += `  • Storage status: ${errorData.diagnosticInfo.storage.success ? 'Success' : 'Failed'}\n`;

              if (errorData.diagnosticInfo.storage.error) {
                logsElem.innerHTML += `  • Storage error: ${errorData.diagnosticInfo.storage.error}\n`;
              }

              if (errorData.diagnosticInfo.storage.fallback) {
                logsElem.innerHTML += `  • Using fallback storage: Yes (data will be lost on server restart)\n`;
              }
            }

            // Log repo info if available
            if (errorData.diagnosticInfo.repoInfo) {
              const repoInfo = errorData.diagnosticInfo.repoInfo;
              logsElem.innerHTML += `  • Target repository: ${repoInfo.owner}/${repoInfo.repo}\n`;
              logsElem.innerHTML += `  • Workflow file: ${repoInfo.workflowFile}\n`;
            }
          }

          // Add troubleshooting tips if available
          if (errorData.diagnosticInfo && errorData.diagnosticInfo.troubleshooting) {
            logsElem.innerHTML += `\n[${new Date().toISOString()}] Troubleshooting tip: ${errorData.diagnosticInfo.troubleshooting}\n`;
          }
        }
      } catch (e) {
        console.error(`[${callId}] Error parsing error response:`, e);

        // If response is not JSON, try to get the text
        try {
          errorDetails = await response.text();
          logsElem.innerHTML += `[${new Date().toISOString()}] Raw error response: ${errorDetails}\n`;
        } catch (textError) {
          console.error(`[${callId}] Error getting response text:`, textError);
          errorDetails = response.statusText;
          logsElem.innerHTML += `[${new Date().toISOString()}] Could not read error details. Status: ${response.statusText}\n`;
        }
      }

      // Add specific troubleshooting hints based on status code
      let troubleshootingHints = '';

      if (response.status === 400) {
        troubleshootingHints = 'This is a client error. Please check the template URL format.';
      } else if (response.status === 401) {
        troubleshootingHints = 'Authentication failed. The token may have expired or be invalid.';
      } else if (response.status === 403) {
        troubleshootingHints = 'Permission denied. The token may not have sufficient permissions.';
      } else if (response.status === 404) {
        troubleshootingHints = 'Resource not found. The API endpoint might be incorrect.';
      } else if (response.status === 429) {
        troubleshootingHints = 'Rate limit exceeded. Please try again later.';
      } else if (response.status === 502) {
        troubleshootingHints =
          'GitHub API communication issue. The server could not communicate with GitHub.';
      } else if (response.status === 503) {
        troubleshootingHints = 'Service temporarily unavailable. Please try again later.';
      } else if (response.status === 504) {
        troubleshootingHints =
          'Gateway timeout. The server did not receive a timely response from GitHub.';
      } else if (response.status === 500) {
        troubleshootingHints =
          'Internal server error. This could be due to several issues:\n' +
          '1. GitHub token might be invalid or missing required permissions\n' +
          '2. The server might be experiencing issues connecting to GitHub\n' +
          '3. There might be an issue with the runs.json storage on GitHub\n' +
          '4. The server might be experiencing internal errors\n\n' +
          'Please check server logs for more details.';

        // Add specific details for 500 errors
        logsElem.innerHTML += `\n[${new Date().toISOString()}] ======= POTENTIAL 500 ERROR CAUSES =======\n`;
        logsElem.innerHTML += `1. GitHub token invalid/expired - Try generating a new token with workflow:write scope\n`;
        logsElem.innerHTML += `2. Missing runs.json in the GitHub repo - Create an empty runs.json file in the repo\n`;
        logsElem.innerHTML += `3. Permission issues with the repo - Check if the token has write access\n`;
        logsElem.innerHTML += `4. GitHub API rate limiting - Check if you've exceeded the API limit\n`;
        logsElem.innerHTML += `5. Network connectivity issues - Check your connection to GitHub\n`;
      }

      if (troubleshootingHints) {
        logsElem.innerHTML += `\n[${new Date().toISOString()}] Troubleshooting hints:\n${troubleshootingHints}\n`;
      }

      // Always scroll logs to bottom
      logsElem.scrollTop = logsElem.scrollHeight;

      throw new Error(`API error: ${response.status} - ${errorDetails || response.statusText}`);
    }

    // Log the raw response for debugging
    console.log(`[${callId}] Validate Template API response status:`, response.status);

    const data = await response.json();
    console.log(`[${callId}] Validate Template API response data:`, data);

    const runId = data.runId;
    console.log(`[${callId}] Validation run ID: ${runId}`);
    // Persist any GitHub run information returned by the API for faster correlation
    try {
      const info = {
        githubRunId: data.githubRunId || null,
        githubRunUrl: data.githubRunUrl || null,
      };
      localStorage.setItem(`validation_${runId}`, JSON.stringify(info));
      localStorage.setItem('lastValidationRunInfo', JSON.stringify({ runId, ...info }));
    } catch (e) {
      console.warn('Failed to persist GitHub run info to localStorage', e);
    }

    // Extract repo name for the notification
    let repoName = '';
    try {
      const url = new URL(templateUrl);
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts.length >= 2) {
        repoName = `${pathParts[0]}/${pathParts[1]}`;
      }
    } catch (error) {
      repoName = templateUrl;
    }

    // Show workflow link
    const actionUrl = data.githubRunUrl
      ? data.githubRunUrl
      : data.githubRunId
        ? `https://github.com/Template-Doctor/template-doctor/actions/runs/${data.githubRunId}`
        : `https://github.com/Template-Doctor/template-doctor/actions`;
    workflowLinkElem.style.display = 'block';
    workflowLinkElem.innerHTML = `
      <a href="${actionUrl}" target="_blank">
        <i class="fab fa-github"></i> ${data.githubRunUrl || data.githubRunId ? 'View running workflow on GitHub' : `Validation workflow started for ${repoName}`}
      </a>
    `;

    // Show initial log entry
    logsElem.style.display = 'block';
    logsElem.innerHTML = `
[${new Date().toISOString()}] Validation workflow triggered for ${templateUrl}
[${new Date().toISOString()}] Run ID: ${runId}
[${new Date().toISOString()}] Request ID: ${data.requestId || 'Not provided'}
[${new Date().toISOString()}] GitHub User: ${data.githubUser || 'Not provided'}
[${new Date().toISOString()}] Waiting for workflow execution...
`;

    // Show and set up cancel button
    cancelValidationBtn.style.display = 'block';
    cancelValidationBtn.disabled = false;
    cancelValidationBtn.textContent = 'Cancel Validation';

    // Add event listener to cancel button
    cancelValidationBtn.addEventListener('click', async () => {
      try {
        cancelValidationBtn.disabled = true;
        cancelValidationBtn.textContent = 'Cancelling...';

        const cancelUrl = new URL(`${apiPathPrefix}/validation-cancel`, apiBaseNormalized);
        const cancelResponse = await fetch(cancelUrl.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Client-ID': callId,
          },
          body: JSON.stringify({
            // Provide both local runId (for logging) and resolved GitHub correlation if available
            runId: runId,
            githubRunId: (function () {
              try {
                const stored = localStorage.getItem(`validation_${runId}`);
                if (stored) {
                  const parsed = JSON.parse(stored);
                  return parsed.githubRunId || null;
                }
              } catch (e) {
                /* ignore */
              }
              return null;
            })(),
            githubRunUrl: (function () {
              try {
                const stored = localStorage.getItem(`validation_${runId}`);
                if (stored) {
                  const parsed = JSON.parse(stored);
                  return parsed.githubRunUrl || null;
                }
              } catch (e) {
                /* ignore */
              }
              return null;
            })(),
          }),
        });

        if (!cancelResponse.ok) {
          let errorMessage = cancelResponse.statusText;
          let errorBody = null;
          try {
            errorBody = await cancelResponse.json();
            if (errorBody && errorBody.error) {
              errorMessage = errorBody.error;
            }
          } catch (e) {
            // Try as text if not JSON
            try {
              errorMessage = await cancelResponse.text();
            } catch {}
          }

          // If backend couldn't discover yet, try to resolve run id and retry once automatically
          const looksRecoverable =
            /could not discover run/i.test(String(errorMessage)) ||
            /Missing githubRunId/i.test(String(errorMessage));
          if (looksRecoverable) {
            const logTime = new Date().toISOString();
            logsElem.innerHTML += `[${logTime}] Cancel failed because run id was not yet resolved. Will try to resolve and retry...\n`;
            logsElem.scrollTop = logsElem.scrollHeight;
            if (window.NotificationSystem) {
              window.NotificationSystem.showInfo(
                'Retrying Cancellation',
                'Resolving workflow run and retrying cancel...',
                5000,
              );
            }

            try {
              // Call status endpoint to resolve githubRunId, without waiting for next poll cycle
              const quickStatusUrl = new URL(
                `${apiPathPrefix}/validation-status`,
                apiBaseNormalized,
              );
              quickStatusUrl.searchParams.append('runId', runId);
              const quickResp = await fetch(quickStatusUrl.toString(), {
                headers: { 'Content-Type': 'application/json' },
              });
              if (quickResp.ok) {
                const quickData = await quickResp.json();
                if (quickData && quickData.githubRunId) {
                  // Persist for future
                  try {
                    localStorage.setItem(
                      `validation_${runId}`,
                      JSON.stringify({
                        githubRunId: quickData.githubRunId,
                        githubRunUrl: quickData.runUrl || null,
                      }),
                    );
                  } catch {}
                  const logTime2 = new Date().toISOString();
                  logsElem.innerHTML += `[${logTime2}] Resolved GitHub run id: ${quickData.githubRunId}. Retrying cancel...\n`;
                  logsElem.scrollTop = logsElem.scrollHeight;

                  // Small delay to let GitHub accept cancel
                  await new Promise((r) => setTimeout(r, 2000));

                  const retryCancelUrl = new URL(
                    `${apiPathPrefix}/validation-cancel`,
                    apiBaseNormalized,
                  );
                  const retryResp = await fetch(retryCancelUrl.toString(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Client-ID': callId },
                    body: JSON.stringify({
                      runId,
                      githubRunId: quickData.githubRunId,
                      githubRunUrl: quickData.runUrl || null,
                    }),
                  });
                  if (retryResp.ok) {
                    const cancelData = await retryResp.json();
                    logsElem.innerHTML += `[${new Date().toISOString()}] Cancellation request sent. ${cancelData.message || ''}\n`;
                    logsElem.scrollTop = logsElem.scrollHeight;
                    if (window.NotificationSystem) {
                      window.NotificationSystem.showSuccess(
                        'Cancellation Requested',
                        'Resolved run id and sent cancel request.',
                        6000,
                      );
                    }

                    if (onStatusChange) {
                      onStatusChange({
                        status: 'cancelled',
                        runId,
                        message: 'Validation workflow cancelled',
                      });
                    }
                    // Show cancelled UI
                    outputElem.style.display = 'block';
                    loadingElem.style.display = 'none';
                    const summaryElem = document.getElementById('githubValidationSummary');
                    summaryElem.className = 'validation-summary';
                    summaryElem.innerHTML = `
          <strong>Cancelled:</strong> The validation workflow has been cancelled.
          <p>Run ID: ${runId}</p>
        `;
                    runValidationBtn.disabled = false;
                    runValidationBtn.innerHTML = 'Run Validation';
                    return; // Recovery succeeded; exit handler
                  }
                }
              } else {
                if (window.NotificationSystem) {
                  window.NotificationSystem.showWarning(
                    'Could not resolve run id yet',
                    'Please wait a few seconds and try cancellation again.',
                    6000,
                  );
                }
              }
            } catch (e) {
              // Ignore and fall through to throw below
            }
          }

          throw new Error(`Failed to cancel: ${cancelResponse.status} - ${errorMessage}`);
        }

        const cancelData = await cancelResponse.json();
        logsElem.innerHTML += `[${new Date().toISOString()}] Cancellation request sent. ${cancelData.message || ''}\n`;
        logsElem.scrollTop = logsElem.scrollHeight;

        if (onStatusChange) {
          onStatusChange({
            status: 'cancelled',
            runId: runId,
            message: 'Validation workflow cancelled',
          });
        }

        // Show cancelled status in UI
        outputElem.style.display = 'block';
        loadingElem.style.display = 'none';

        const summaryElem = document.getElementById('githubValidationSummary');
        summaryElem.className = 'validation-summary';
        summaryElem.innerHTML = `
          <strong>Cancelled:</strong> The validation workflow has been cancelled.
          <p>Run ID: ${runId}</p>
        `;

        // Reset validation button
        runValidationBtn.disabled = false;
        runValidationBtn.innerHTML = 'Run Validation';
      } catch (error) {
        console.error(`[${callId}] Error cancelling validation:`, error);

        // Show error in logs
        const errorTime = new Date().toISOString();
        logsElem.innerHTML += `[${errorTime}] Error cancelling validation: ${error.message}\n`;
        logsElem.scrollTop = logsElem.scrollHeight;

        // Show error message to user
        if (window.NotificationSystem) {
          window.NotificationSystem.showError(
            'Cancellation Failed',
            `Could not cancel the workflow: ${error.message}`,
            8000,
          );
        }

        // Optionally surface error near spinner if present
        const statusMessageElemRef = document.querySelector(
          '#githubValidationLoading .status-message',
        );
        if (statusMessageElemRef) {
          statusMessageElemRef.innerHTML += `
            <div style="color: #d73a49; margin-top: 10px; padding: 8px; background-color: #ffeef0; border-radius: 4px; border: 1px solid #f9d0d0;">
              <strong>Error cancelling:</strong> ${error.message}
            </div>
          `;
        }

        // Re-enable cancel button in case of error, with different text
        cancelValidationBtn.disabled = false;
        cancelValidationBtn.textContent = 'Retry Cancellation';
      }
    });

    // Notify the user
    if (window.NotificationSystem) {
      window.NotificationSystem.showInfo(
        'Validation Started',
        `Validation workflow started for ${repoName}`,
        5000,
      );
    }

    if (onStatusChange) {
      onStatusChange({
        status: 'triggered',
        runId: runId,
        message: `Validation workflow started for ${repoName}`,
      });
    }

    // Start polling for results
    await pollGithubWorkflowStatus(runId, templateUrl, apiBase, onStatusChange);
  } catch (error) {
    console.error(`[${callId}] Template validation error:`, error);

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

    // Determine if this is a network/timeout error or an API error
    const isTimeoutError = error.message.includes('timed out');
    const isNetworkError =
      error.message.includes('Network Error') || error.message.includes('Failed to fetch');
    const isGitHubError = error.message.includes('GitHub');

    // Format error title and message based on error type
    let errorTitle = 'Error';
    let errorMessage = 'There was a problem triggering the validation workflow.';

    if (isTimeoutError) {
      errorTitle = 'Request Timed Out';
      errorMessage =
        'The request to the server took too long to complete. The server might be overloaded or experiencing issues.';
    } else if (isNetworkError) {
      errorTitle = 'Network Error';
      errorMessage =
        'Could not connect to the server. Please check your internet connection or try again later.';
    } else if (isGitHubError) {
      errorTitle = 'GitHub API Error';
      errorMessage =
        'There was a problem communicating with GitHub. This might be due to token issues or rate limiting.';
    } else if (error.message.includes('500')) {
      errorTitle = 'Server Error';
      errorMessage =
        'The server encountered an internal error. This might be due to configuration issues or temporary problems.';
    }

    summaryElem.innerHTML = `
      <div class="error-container" style="border-radius: 6px; border: 1px solid #f9d0d0; background-color: #ffeef0; padding: 16px;">
        <div style="display: flex; align-items: flex-start; margin-bottom: 10px;">
          <i class="fas fa-exclamation-circle" style="color: #d73a49; font-size: 24px; margin-right: 12px;"></i>
          <div>
            <h4 style="margin: 0 0 8px 0; color: #d73a49;">${errorTitle}: ${error.message.replace(/^API error: /, '')}</h4>
            <p style="margin: 0; color: #6a737d;">${errorMessage}</p>
          </div>
        </div>
        
        ${
          fullErrorData
            ? `
        <div style="margin-top: 12px; background-color: #f6f8fa; border-radius: 4px; padding: 12px;">
          <h5 style="margin: 0 0 8px 0; font-size: 14px; color: #24292e;">Error Information:</h5>
          <ul style="margin: 0; padding-left: 24px;">
            <li style="margin-bottom: 6px;">Error Type: ${fullErrorData.type || 'Unknown'}</li>
            <li style="margin-bottom: 6px;">Time: ${fullErrorData.timestamp || new Date().toLocaleTimeString()}</li>
            ${fullErrorData.requestId ? `<li style="margin-bottom: 6px;">Request ID: ${fullErrorData.requestId}</li>` : ''}
            ${fullErrorData.errorCode ? `<li style="margin-bottom: 6px;">Error Code: ${fullErrorData.errorCode}</li>` : ''}
          </ul>
        </div>
        `
            : ''
        }
        
        <details style="margin-top: 12px;">
          <summary style="cursor: pointer; font-weight: 500; color: #24292e; margin-bottom: 8px;">Troubleshooting Steps</summary>
          <div style="background-color: #f6f8fa; border-radius: 4px; padding: 12px; margin-top: 8px;">
            <ol style="margin: 0; padding-left: 24px;">
              <li style="margin-bottom: 8px;">Check if the GitHub repository URL is correct and accessible</li>
              <li style="margin-bottom: 8px;">Verify the repository contains a valid template</li>
              <li style="margin-bottom: 8px;">Check if the GitHub token has the required permissions (workflow:write)</li>
              <li style="margin-bottom: 8px;">The GitHub token might have expired - try creating a new token</li>
              <li style="margin-bottom: 8px;">The server may be experiencing temporary issues - try again in a few minutes</li>
              <li style="margin-bottom: 8px;">Check if there are any GitHub service outages: <a href="https://www.githubstatus.com/" target="_blank">GitHub Status</a></li>
              <li style="margin-bottom: 8px;">If the problem persists, contact the Template Doctor team with the error details</li>
            </ol>
          </div>
        </details>
        
        ${
          logsElem.innerHTML
            ? `
        <details style="margin-top: 12px;">
          <summary style="cursor: pointer; font-weight: 500; color: #24292e; margin-bottom: 8px;">Logs</summary>
          <div style="background-color: #f6f8fa; border-radius: 4px; padding: 12px; margin-top: 8px; max-height: 200px; overflow-y: auto;">
            <pre style="white-space: pre-wrap; overflow-wrap: break-word; margin: 0; font-size: 12px;">${logsElem.innerHTML}</pre>
          </div>
        </details>
        `
            : ''
        }
        
        <details style="margin-top: 12px;">
          <summary style="cursor: pointer; font-weight: 500; color: #24292e; margin-bottom: 8px;">Technical Details</summary>
          <div style="background-color: #f6f8fa; border-radius: 4px; padding: 12px; margin-top: 8px;">
            <pre style="white-space: pre-wrap; overflow-wrap: break-word; margin: 0; font-size: 12px;">${errorDetails}</pre>
            ${errorJson ? `<h5 style="margin: 12px 0 4px 0; font-size: 13px;">Full error response:</h5><pre style="white-space: pre-wrap; overflow-wrap: break-word; margin: 0; font-size: 12px;">${errorJson}</pre>` : ''}
          </div>
        </details>
        <button id="retryValidationBtn" class="btn btn-primary" style="margin-top: 16px; padding: 8px 16px;">Retry Validation</button>
      </div>
    `;

    // Add retry button functionality
    document.getElementById('retryValidationBtn').addEventListener('click', () => {
      runGithubWorkflowValidation(templateUrl, apiBase, onStatusChange);
    });

    // Show notification if available
    if (window.NotificationSystem) {
      window.NotificationSystem.showError(
        'Validation Failed',
        `Could not start validation: ${error.message.replace(/^API error: /, '')}`,
        8000,
      );
    }

    if (onStatusChange) {
      onStatusChange({
        status: 'error',
        message: error.message,
        details: errorDetails,
      });
    }

    // Reset button
    runValidationBtn.disabled = false;
    runValidationBtn.innerHTML = 'Run Validation';
  }
}

/**
 * Poll for GitHub workflow validation status
 * @param {string} runId - The run ID returned from the validation-template API
 * @param {string} templateUrl - The template URL being validated
 * @param {string} apiBase - Base URL for API calls
 * @param {Function} onStatusChange - Optional callback for status updates
 */
async function pollGithubWorkflowStatus(runId, templateUrl, apiBase, onStatusChange) {
  // Construct API endpoints based on environment
  // For Azure Static Web Apps, the API path should be '/api/validation-template'
  // For local development, it might need different formatting
  const isLocalhost =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const apiPathPrefix = isLocalhost ? 'api' : 'api'; // Using 'api' for both to simplify

  // Normalize the apiBase to ensure correct path joining
  const apiBaseNormalized = apiBase.endsWith('/') ? apiBase : apiBase + '/';

  const loadingElem = document.getElementById('githubValidationLoading');
  const outputElem = document.getElementById('githubValidationOutput');
  const logsElem = document.getElementById('validationLogs');
  const runValidationBtn = document.getElementById('runGithubValidationBtn');
  const cancelValidationBtn = document.getElementById('githubCancelValidationBtn');
  const jobLogsElem = document.getElementById('validationJobLogs');
  const includeJobLogsChk = document.getElementById('includeJobLogsChk');

  let complete = false;
  let attempts = 0;
  const maxAttempts = 60; // Maximum polling attempts (30 minutes at 30-second intervals)
  const statusMessageElem = loadingElem.querySelector('.status-message');
  // Try to load any previously stored GitHub run info
  let knownGithubRunId = null;
  let actionRunUrl = `https://github.com/Template-Doctor/template-doctor/actions`;
  try {
    const stored = localStorage.getItem(`validation_${runId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.githubRunId) {
        knownGithubRunId = parsed.githubRunId;
        actionRunUrl =
          parsed.githubRunUrl ||
          `https://github.com/Template-Doctor/template-doctor/actions/runs/${knownGithubRunId}`;
      }
    }
  } catch (e) {
    console.warn('Failed to read stored GitHub run info', e);
  }

  while (!complete && attempts < maxAttempts) {
    try {
      // Wait before polling (except for the first attempt)
      if (attempts > 0) {
        await new Promise((resolve) => setTimeout(resolve, 30000)); // 30-second polling interval
      }

      // Update status message
      const minutes = Math.floor(attempts / 2);
      statusMessageElem.textContent = `GitHub workflow is running (${minutes} minute${minutes !== 1 ? 's' : ''} elapsed)...`;

      // Add log entry
      const logTime = new Date().toISOString();
      logsElem.innerHTML += `[${logTime}] Checking workflow status (${minutes} minute${minutes !== 1 ? 's' : ''} elapsed)\n`;
      logsElem.scrollTop = logsElem.scrollHeight; // Scroll to bottom

      if (onStatusChange) {
        onStatusChange({
          status: 'running',
          runId: runId,
          message: `GitHub workflow is running (${minutes} minute${minutes !== 1 ? 's' : ''} elapsed)`,
        });
      }

      // Call the validation-status API to check the current status
      const statusUrl = new URL(`${apiPathPrefix}/validation-status`, apiBaseNormalized);
      statusUrl.searchParams.append('runId', runId);
      if (knownGithubRunId) {
        statusUrl.searchParams.append('githubRunId', knownGithubRunId);
      }
      // ask backend to include ephemeral logs archive URL
      statusUrl.searchParams.append('includeLogsUrl', '1');
      // optionally include per-job logs when enabled in UI
      if (includeJobLogsChk && includeJobLogsChk.checked) {
        statusUrl.searchParams.append('includeJobLogs', '1');
      }
      console.log(`Status check URL: ${statusUrl.toString()}`);

      const statusResponse = await fetch(statusUrl.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!statusResponse.ok) {
        console.warn(`Status check failed: ${statusResponse.status} ${statusResponse.statusText}`);
        const logTime = new Date().toISOString();

        // Try to get detailed error message from response
        let errorMessage = statusResponse.statusText;
        let errorDetails = '';

        try {
          const errorData = await statusResponse.json();
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
            errorDetails = JSON.stringify(errorData, null, 2);
            console.error('Status check error details:', errorData);
          }
        } catch (e) {
          // If we can't parse JSON, try to get text
          try {
            errorDetails = await statusResponse.text();
          } catch (textError) {
            errorDetails = 'Could not read error details';
          }
        }

        // Log the error with details
        logsElem.innerHTML += `[${logTime}] Status check failed: ${statusResponse.status} - ${errorMessage}\n`;

        // If this is a persistent error after multiple attempts, show it more prominently
        if (attempts > 3) {
          // Update status message to show the error
          statusMessageElem.innerHTML = `
            <div style="color: #d73a49; margin-bottom: 10px;">
              Error checking workflow status: ${errorMessage}
            </div>
            <div>Retrying... (${attempts} attempts so far)</div>
          `;

          // If the error persists for a while, show a notification
          if (attempts === 5 && window.NotificationSystem) {
            window.NotificationSystem.showWarning(
              'Status Check Issues',
              'Having trouble checking the workflow status. Will continue retrying...',
              8000,
            );
          }
        }

        logsElem.scrollTop = logsElem.scrollHeight;
        attempts++;
        continue;
      }

      const statusData = await statusResponse.json();

      // If backend surfaced GitHub run correlation, persist and update link
      if (statusData.githubRunId) {
        knownGithubRunId = statusData.githubRunId;
        actionRunUrl =
          statusData.runUrl ||
          `https://github.com/Template-Doctor/template-doctor/actions/runs/${knownGithubRunId}`;
        try {
          const toStore = {
            githubRunId: knownGithubRunId,
            githubRunUrl: statusData.runUrl || null,
          };
          localStorage.setItem(`validation_${runId}`, JSON.stringify(toStore));
          localStorage.setItem('lastValidationRunInfo', JSON.stringify({ runId, ...toStore }));
        } catch (e) {
          console.warn('Failed to persist GitHub run info during polling', e);
        }
        // Also update the link section if visible
        const workflowLinkElem = document.getElementById('validationWorkflowLink');
        if (workflowLinkElem) {
          workflowLinkElem.style.display = 'block';
          workflowLinkElem.innerHTML = `
            <a href="${actionRunUrl}" target="_blank">
              <i class="fab fa-github"></i> View running workflow on GitHub
            </a>
          `;
        }
      }

      // If logs url is available, render a quick link once
      if (statusData.logsArchiveUrl) {
        const logsLinkContainer = document.getElementById('validationWorkflowLink');
        if (logsLinkContainer && !logsLinkContainer.dataset.hasLogsLink) {
          logsLinkContainer.dataset.hasLogsLink = '1';
          logsLinkContainer.style.display = 'block';
          const currentHtml = logsLinkContainer.innerHTML || '';
          const sep = currentHtml ? ' &nbsp;|&nbsp; ' : '';
          logsLinkContainer.innerHTML = `${currentHtml}${sep}<a href="${statusData.logsArchiveUrl}" target="_blank"><i class="fas fa-file-archive"></i> Download logs</a>`;
        }
      }

      // Render per-job logs list if available
      if (statusData.jobLogs && Array.isArray(statusData.jobLogs)) {
        const items = statusData.jobLogs
          .map((j) => {
            const badge = j.conclusion ? j.conclusion : j.status || 'unknown';
            const link = j.logsUrl ? ` - <a href="${j.logsUrl}" target="_blank">logs</a>` : '';
            return `<li><strong>${j.name}</strong> <em>(${badge})</em>${link}</li>`;
          })
          .join('');
        jobLogsElem.style.display = 'block';
        jobLogsElem.innerHTML = `<h5>Job logs</h5><ul>${items}</ul>`;
      } else if (jobLogsElem) {
        jobLogsElem.style.display = 'none';
        jobLogsElem.innerHTML = '';
      }

      // Add log entry with status data
      const logTimeStatus = new Date().toISOString();
      logsElem.innerHTML += `[${logTimeStatus}] Received status: ${statusData.status || 'unknown'}\n`;
      logsElem.scrollTop = logsElem.scrollHeight;

      // Check if the validation is complete
      if (statusData.status === 'completed') {
        complete = true;

        // Show results
        loadingElem.style.display = 'none';
        outputElem.style.display = 'block';

        // Hide cancel button
        cancelValidationBtn.style.display = 'none';

        const summaryElem = document.getElementById('githubValidationSummary');
        const detailsElem = document.getElementById('githubValidationDetails');

        // Add final log entry
        const logTimeComplete = new Date().toISOString();
        logsElem.innerHTML += `[${logTimeComplete}] Validation completed with result: ${statusData.conclusion || 'unknown'}\n`;
        logsElem.scrollTop = logsElem.scrollHeight;

        // Display results based on the conclusion
        if (statusData.conclusion === 'success') {
          summaryElem.className = 'validation-summary success';
          summaryElem.innerHTML = `
            <div class="success-container" style="border-radius: 6px; border: 1px solid #34d058; background-color: #f0fff4; padding: 16px;">
              <div style="display: flex; align-items: flex-start; margin-bottom: 10px;">
                <i class="fas fa-check-circle" style="color: #28a745; font-size: 24px; margin-right: 12px;"></i>
                <div>
                  <h4 style="margin: 0 0 8px 0; color: #28a745;">Success! The template passed validation checks.</h4>
                  <p style="margin: 0; color: #6a737d;">All validation checks have passed successfully.</p>
                </div>
              </div>
              <div style="margin-top: 16px;">
                <a href="${actionRunUrl}" target="_blank" style="display: inline-flex; align-items: center; background-color: #f1f8ff; color: #0366d6; padding: 8px 16px; border-radius: 4px; text-decoration: none; font-weight: 500; border: 1px solid #c8e1ff;">
                  <i class="fab fa-github" style="margin-right: 8px;"></i> View workflow run on GitHub
                </a>
              </div>
            </div>
          `;

          // Show success notification
          if (window.NotificationSystem) {
            window.NotificationSystem.showSuccess(
              'Validation Succeeded',
              'The template passed all validation checks!',
              5000,
            );
          }

          if (onStatusChange) {
            onStatusChange({
              status: 'completed',
              runId: runId,
              success: true,
              message: 'Template validation completed successfully',
            });
          }
        } else {
          summaryElem.className = 'validation-summary failure';
          summaryElem.innerHTML = `
            <div class="failure-container" style="border-radius: 6px; border: 1px solid #f9d0d0; background-color: #ffeef0; padding: 16px;">
              <div style="display: flex; align-items: flex-start; margin-bottom: 10px;">
                <i class="fas fa-times-circle" style="color: #d73a49; font-size: 24px; margin-right: 12px;"></i>
                <div>
                  <h4 style="margin: 0 0 8px 0; color: #d73a49;">Validation Failed</h4>
                  <p style="margin: 0; color: #6a737d;">The template has issues that need to be addressed.</p>
                </div>
              </div>
              <div style="margin-top: 16px;">
                <a href="${actionRunUrl}" target="_blank" style="display: inline-flex; align-items: center; background-color: #f1f8ff; color: #0366d6; padding: 8px 16px; border-radius: 4px; text-decoration: none; font-weight: 500; border: 1px solid #c8e1ff;">
                  <i class="fab fa-github" style="margin-right: 8px;"></i> View workflow run on GitHub
                </a>
              </div>
            </div>
          `;

          // Show failure notification
          if (window.NotificationSystem) {
            window.NotificationSystem.showError(
              'Validation Failed',
              'The template has issues that need to be addressed. Check the GitHub workflow for details.',
              7000,
            );
          }

          // Format details if available
          if (statusData.results && statusData.results.details) {
            let detailsContent = `<div class="validation-details-container">
              <h3 style="margin-top: 20px; margin-bottom: 15px; border-bottom: 1px solid #eaecef; padding-bottom: 8px;">Validation Details</h3>`;

            // Group details by status
            const failedChecks = statusData.results.details.filter((d) => d.status === 'fail');
            const warningChecks = statusData.results.details.filter((d) => d.status === 'warn');
            const passedChecks = statusData.results.details.filter((d) => d.status === 'pass');

            // First show fails
            if (failedChecks.length > 0) {
              detailsContent += `
                <div class="failed-checks" style="margin-bottom: 20px;">
                  <h4 style="color: #d73a49; margin-bottom: 10px;">❌ Failed Checks (${failedChecks.length})</h4>
                  <div class="checks-container" style="background-color: #ffeef0; border-radius: 6px; padding: 16px; border: 1px solid #f9d0d0;">`;

              failedChecks.forEach((detail) => {
                detailsContent += `
                  <div class="check-item" style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #f1bebe;">
                    <div style="font-weight: 600; margin-bottom: 6px;">${detail.category}</div>
                    <div style="margin-bottom: 8px; color: #24292e;">${detail.message}</div>`;

                if (detail.issues && detail.issues.length > 0) {
                  detailsContent += `<ul style="margin-top: 8px; margin-bottom: 0; padding-left: 20px;">`;
                  detail.issues.forEach((issue) => {
                    detailsContent += `<li style="margin-bottom: 5px;">${issue}</li>`;
                  });
                  detailsContent += `</ul>`;
                }

                detailsContent += `</div>`;
              });

              detailsContent += `</div></div>`;
            }

            // Then show warnings
            if (warningChecks.length > 0) {
              detailsContent += `
                <div class="warning-checks" style="margin-bottom: 20px;">
                  <h4 style="color: #b08800; margin-bottom: 10px;">⚠️ Warnings (${warningChecks.length})</h4>
                  <div class="checks-container" style="background-color: #fffbdd; border-radius: 6px; padding: 16px; border: 1px solid #f1e05a;">`;

              warningChecks.forEach((detail) => {
                detailsContent += `
                  <div class="check-item" style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #e9df86;">
                    <div style="font-weight: 600; margin-bottom: 6px;">${detail.category}</div>
                    <div style="margin-bottom: 8px; color: #24292e;">${detail.message}</div>`;

                if (detail.issues && detail.issues.length > 0) {
                  detailsContent += `<ul style="margin-top: 8px; margin-bottom: 0; padding-left: 20px;">`;
                  detail.issues.forEach((issue) => {
                    detailsContent += `<li style="margin-bottom: 5px;">${issue}</li>`;
                  });
                  detailsContent += `</ul>`;
                }

                detailsContent += `</div>`;
              });

              detailsContent += `</div></div>`;
            }

            // Finally show passed
            if (passedChecks.length > 0) {
              detailsContent += `
                <div class="passed-checks" style="margin-bottom: 20px;">
                  <h4 style="color: #28a745; margin-bottom: 10px;">✅ Passed Checks (${passedChecks.length})</h4>
                  <div class="checks-container" style="background-color: #f0fff4; border-radius: 6px; padding: 16px; border: 1px solid #34d058;">`;

              passedChecks.forEach((detail) => {
                detailsContent += `
                  <div class="check-item" style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #ace2bc;">
                    <div style="font-weight: 600; margin-bottom: 6px;">${detail.category}</div>
                    <div style="margin-bottom: 8px; color: #24292e;">${detail.message}</div>
                  </div>`;
              });

              detailsContent += `</div></div>`;
            }

            detailsContent += `</div>`;
            detailsElem.innerHTML = detailsContent;
          } else {
            detailsElem.innerHTML = `
              <div style="background-color: #f6f8fa; border-radius: 6px; padding: 16px; color: #6a737d; text-align: center; margin-top: 20px;">
                <i class="fas fa-info-circle" style="font-size: 24px; margin-bottom: 10px;"></i>
                <p style="margin: 0;">No detailed results available. Please check the GitHub Actions workflow for more information.</p>
              </div>
            `;
          }

          if (onStatusChange) {
            onStatusChange({
              status: 'completed',
              runId: runId,
              success: false,
              message: 'Template validation failed with issues',
              details: detailsElem.innerHTML,
            });
          }
        }
      }

      attempts++;
    } catch (error) {
      console.error('Error polling validation status:', error);
      const logTimeError = new Date().toISOString();
      logsElem.innerHTML += `[${logTimeError}] Error polling status: ${error.message}\n`;
      logsElem.scrollTop = logsElem.scrollHeight;
      attempts++;
    }
  }

  // If we've reached the maximum attempts without completion
  if (!complete) {
    loadingElem.style.display = 'none';
    outputElem.style.display = 'block';

    // Hide cancel button
    cancelValidationBtn.style.display = 'none';

    const summaryElem = document.getElementById('githubValidationSummary');
    summaryElem.className = 'validation-summary failure';
    summaryElem.innerHTML = `
      <div class="timeout-container" style="border-radius: 6px; border: 1px solid #f1e05a; background-color: #fffbdd; padding: 16px;">
        <div style="display: flex; align-items: flex-start; margin-bottom: 10px;">
          <i class="fas fa-clock" style="color: #b08800; font-size: 24px; margin-right: 12px;"></i>
          <div>
            <h4 style="margin: 0 0 8px 0; color: #b08800;">Timeout: Validation Taking Longer Than Expected</h4>
            <p style="margin: 0 0 12px 0; color: #6a737d;">The GitHub workflow may still be running in the background.</p>
          </div>
        </div>
        <div style="background-color: #f6f8fa; border-radius: 4px; padding: 12px; margin: 8px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Run ID:</strong> ${runId}</p>
          <p style="margin: 0;">You can check the status directly on GitHub:</p>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px;">
          <a href="https://github.com/Template-Doctor/template-doctor/actions" target="_blank" 
             style="display: inline-flex; align-items: center; background-color: #f1f8ff; color: #0366d6; 
                    padding: 8px 16px; border-radius: 4px; text-decoration: none; font-weight: 500; 
                    border: 1px solid #c8e1ff;">
            <i class="fab fa-github" style="margin-right: 8px;"></i> View on GitHub Actions
          </a>
          <button id="continuePollingBtn" class="btn btn-primary" style="margin: 0;">
            Continue Checking Status
          </button>
        </div>
      </div>
    `;

    // Show notification
    if (window.NotificationSystem) {
      window.NotificationSystem.showWarning(
        'Validation Taking Too Long',
        'The workflow is still running. You can check its status on GitHub or continue checking.',
        10000,
      );
    }

    // Add button to continue polling
    document.getElementById('continuePollingBtn').addEventListener('click', () => {
      // Reset the UI to show loading state
      loadingElem.style.display = 'block';
      outputElem.style.display = 'none';
      cancelValidationBtn.style.display = 'block';

      // Continue polling with a fresh counter but the same runId
      pollGithubWorkflowStatus(runId, templateUrl, apiBase, onStatusChange);
    });

    if (onStatusChange) {
      onStatusChange({
        status: 'timeout',
        runId: runId,
        message: 'Validation timed out waiting for completion',
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
};
