// Main Application Logic for Template Doctor Frontend
// Wires up authentication, search, analysis, and dashboard rendering

// Configuration for organizations that might require forking
const ORGANIZATIONS_CONFIG = {
  requireConfirmationForFork: true,
  organizationsToFork: ['Azure', 'Azure-Samples', 'Microsoft'],
  // Add more configurations here as needed
};

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
      console.log(
        'Issues:',
        Array.isArray(data.compliance.issues) ? data.compliance.issues.length : 'not an array',
      );
      console.log(
        'Compliant:',
        Array.isArray(data.compliance.compliant)
          ? data.compliance.compliant.length
          : 'not an array',
      );
    }
  }
  console.groupEnd();
}

/**
 * Checks if a repository belongs to any of the specified organizations
 * and offers to replace with the current user's fork
 * @param {string} repoUrl - Original repository URL
 * @returns {Promise<string>} - New repository URL (might be the same or a user fork)
 */
async function checkAndUpdateRepoUrl(repoUrl) {
  // If no URL or not a GitHub URL, return as is
  if (!repoUrl || !repoUrl.includes('github.com/')) {
    return repoUrl;
  }

  // Check if user is logged in
  if (!window.GitHubClient || !window.GitHubClient.auth.isAuthenticated()) {
    debug('app', 'User not logged in, cannot fork repositories');
    return repoUrl;
  }

  // Get current username
  const currentUsername = window.GitHubClient.auth.getUsername();
  if (!currentUsername) {
    debug('app', 'Cannot get current username');
    return repoUrl;
  }

  // Extract owner and repo from URL
  try {
    const urlParts = repoUrl.split('github.com/')[1].split('/');
    const owner = urlParts[0];
    const repo = urlParts[1];

    if (!owner || !repo) {
      throw new Error('Invalid repository URL format');
    }

    // Check if the owner is one of the organizations that might need forking
    const needsFork = ORGANIZATIONS_CONFIG.organizationsToFork.some(
      (org) => owner.toLowerCase() === org.toLowerCase(),
    );

    if (!needsFork) {
      debug('app', `Repository ${owner}/${repo} does not need forking`);
      return repoUrl;
    }

    // Construct potential fork URL
    const potentialForkUrl = `https://github.com/${currentUsername}/${repo}`;
    debug('app', `Original repo: ${repoUrl}, potential fork: ${potentialForkUrl}`);

    // Show confirmation dialog if configured
    if (ORGANIZATIONS_CONFIG.requireConfirmationForFork) {
      // Use notification system if available
      if (window.Notifications) {
        const result = await new Promise((resolve) => {
          window.Notifications.confirm(
            'Repository Fork',
            `This repository belongs to ${owner}. Would you like to check if you have a fork of this repository and use that instead?`,
            {
              confirmLabel: 'Check For Fork',
              cancelLabel: 'Use Original',
              onConfirm: () => resolve(true),
              onCancel: () => resolve(false),
            },
          );
        });

        if (!result) {
          return repoUrl; // User declined, use original URL
        }
      } else {
        // Fallback to native confirm
        if (
          !confirm(
            `This repository belongs to ${owner}. Would you like to check if you have a fork of this repository and use that instead?`,
          )
        ) {
          return repoUrl; // User declined, use original URL
        }
      }
    }

    // Check if the user already has a fork
    try {
      debug('app', `Checking if user ${currentUsername} has a fork of ${owner}/${repo}`);
      const response = await fetch(`https://api.github.com/repos/${currentUsername}/${repo}`, {
        headers: {
          Authorization: `token ${window.GitHubClient.auth.getToken()}`,
        },
      });

      if (response.ok) {
        // User has a fork, use it
        debug('app', `User has a fork of ${owner}/${repo}`);
        if (window.NotificationSystem) {
          window.NotificationSystem.showInfo(
            'Using Your Fork',
            `Using your fork of ${owner}/${repo} for analysis`,
            3000,
          );
        }
        return potentialForkUrl;
      } else if (response.status === 404) {
        // User doesn't have a fork, ask if they want to create one
        let shouldCreateFork = false;

        if (window.Notifications) {
          shouldCreateFork = await new Promise((resolve) => {
            window.Notifications.confirm(
              'Create Fork',
              `You don't have a fork of ${owner}/${repo}. Would you like to create one now?`,
              {
                confirmLabel: 'Create Fork',
                cancelLabel: 'Use Original',
                onConfirm: () => resolve(true),
                onCancel: () => resolve(false),
              },
            );
          });
        } else {
          // Fallback to native confirm if notification system is not available
          if (window.NotificationSystem) {
            await new Promise((resolve) => {
              window.NotificationSystem.showConfirmation(
                'Create Fork',
                `You don't have a fork of ${owner}/${repo}. Would you like to create one now?`,
                'Create Fork',
                'Use Original',
                (confirmed) => {
                  shouldCreateFork = confirmed;
                  resolve();
                },
              );
            });
          } else {
            shouldCreateFork = confirm(
              `You don't have a fork of ${owner}/${repo}. Would you like to create one now?`,
            );
          }
        }

        if (shouldCreateFork) {
          try {
            debug('app', `Creating fork of ${owner}/${repo}`);
            if (window.NotificationSystem) {
              window.NotificationSystem.showInfo(
                'Creating Fork',
                `Creating a fork of ${owner}/${repo}...`,
                3000,
              );
            }

            const forkResponse = await fetch(
              `https://api.github.com/repos/${owner}/${repo}/forks`,
              {
                method: 'POST',
                headers: {
                  Authorization: `token ${window.GitHubClient.auth.getToken()}`,
                },
              },
            );

            if (forkResponse.ok) {
              const forkData = await forkResponse.json();
              debug('app', `Fork created: ${forkData.html_url}`);
              if (window.NotificationSystem) {
                window.NotificationSystem.showSuccess(
                  'Fork Created',
                  `Successfully forked ${owner}/${repo}`,
                  3000,
                );
              }
              return forkData.html_url;
            } else {
              throw new Error(
                `Failed to create fork: ${forkResponse.status} ${forkResponse.statusText}`,
              );
            }
          } catch (forkError) {
            debug('app', `Error creating fork: ${forkError.message}`, forkError);
            if (window.NotificationSystem) {
              window.NotificationSystem.showError(
                'Fork Error',
                `Failed to create fork: ${forkError.message}`,
                5000,
              );
            }
            return repoUrl; // Use original URL as fallback
          }
        } else {
          return repoUrl; // User declined to fork, use original URL
        }
      } else {
        // Other error occurred
        throw new Error(`Error checking fork: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      debug('app', `Error checking/creating fork: ${error.message}`, error);
      return repoUrl; // Use original URL as fallback
    }
  } catch (parseError) {
    debug('app', `Error parsing repository URL: ${parseError.message}`, parseError);
    return repoUrl; // Use original URL as fallback
  }
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
  script.onload = function () {
    console.log(`DIRECT LOAD: Script loaded successfully!`);

    // Use a brief timeout to ensure the script has executed
    setTimeout(function () {
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
  script.onerror = function (e) {
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
    dashboard: !!appDashboard,
  });

  if (!appAnalyzer) {
    debug('app', 'Template analyzer not available, waiting for initialization');
  }
}

// Define a local reference to the internal analyzeRepo function that will be defined later
let internalAnalyzeRepo;

// Export analyzeRepo to window object so it can be used by other components
window.analyzeRepo = async function (repoUrl, ruleSet = 'dod') {
  // Override default with config if provided
  if (!ruleSet || ruleSet === 'dod') {
    const cfg = window.TemplateDoctorConfig || {};
    if (cfg.defaultRuleSet && typeof cfg.defaultRuleSet === 'string') {
      ruleSet = cfg.defaultRuleSet;
    }
  }
  // Call the internal analyzeRepo function with the same parameters
  if (typeof internalAnalyzeRepo === 'function') {
    return internalAnalyzeRepo(repoUrl, ruleSet);
  } else {
    console.error('Internal analyzeRepo function not available yet');
    return null;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // Initialize IndexedDB for batch scan progress
  try {
    initBatchScanDB()
      .then(() => debug('app', 'IndexedDB initialized successfully'))
      .catch((error) => debug('app', 'Error initializing IndexedDB', error));
  } catch (error) {
    debug('app', 'Error initializing IndexedDB', error);
  }

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
          10000,
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

  // Batch scan UI elements
  const scanModeToggle = document.getElementById('scan-mode-toggle');
  const singleModeLabel = document.getElementById('single-mode-label');
  const batchModeLabel = document.getElementById('batch-mode-label');
  const singleScanContainer = document.getElementById('single-scan-container');
  const batchUrlsContainer = document.getElementById('batch-urls-container');
  const batchUrlsTextarea = document.getElementById('batch-urls');
  const batchScanButton = document.getElementById('batch-scan-button');
  const batchResults = document.getElementById('batch-results');
  const batchItems = document.getElementById('batch-items');
  const batchProgressBar = document.getElementById('batch-progress-bar');
  const batchProgressText = document.getElementById('batch-progress-text');
  const batchCancelContainer = document.getElementById('batch-cancel-container');
  const batchCancelBtn = document.getElementById('batch-cancel-btn');

  // Create elements for scanned templates section
  const searchSection = document.getElementById('search-section');
  let scannedTemplatesSection;
  let templateGrid;

  // Batch scan state
  let batchUrls = [];
  let batchScanActive = false;
  let batchProcessedCount = 0;
  let batchCancelled = false;
  let batchScanDB = null; // IndexedDB reference

  // Initialize IndexedDB for batch scan progress
  function initBatchScanDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('BatchScanDB', 1);

      request.onerror = (event) => {
        debug('app', 'Error opening IndexedDB', event);
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = (event) => {
        debug('app', 'IndexedDB opened successfully');
        batchScanDB = event.target.result;
        resolve(batchScanDB);
      };

      request.onupgradeneeded = (event) => {
        debug('app', 'Creating IndexedDB store');
        const db = event.target.result;

        // Create object store for batch scan progress
        if (!db.objectStoreNames.contains('batchProgress')) {
          const store = db.createObjectStore('batchProgress', { keyPath: 'id' });
          store.createIndex('url', 'url', { unique: true });
          store.createIndex('status', 'status', { unique: false });
        }
      };
    });
  }

  // Save batch scan progress to IndexedDB
  function saveBatchProgress(id, url, status, result = null) {
    return new Promise((resolve, reject) => {
      if (!batchScanDB) {
        debug('app', 'IndexedDB not initialized');
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      try {
        const transaction = batchScanDB.transaction(['batchProgress'], 'readwrite');
        const store = transaction.objectStore('batchProgress');

        const progress = {
          id,
          url,
          status,
          timestamp: new Date().toISOString(),
        };

        // Only store essential result data if provided
        if (result) {
          progress.result = {
            repoUrl: result.repoUrl,
            ruleSet: result.ruleSet,
            timestamp: result.timestamp,
            compliance: result.compliance,
          };
        }

        const request = store.put(progress);

        request.onsuccess = () => {
          debug('app', `Saved batch progress for ${url} with status ${status}`);
          resolve();
        };

        request.onerror = (event) => {
          debug('app', `Error saving batch progress: ${event.target.error}`);
          reject(event.target.error);
        };
      } catch (error) {
        debug('app', `Error in saveBatchProgress: ${error.message}`, error);
        reject(error);
      }
    });
  }

  // Load batch scan progress from IndexedDB
  function loadBatchProgress() {
    return new Promise((resolve, reject) => {
      if (!batchScanDB) {
        debug('app', 'IndexedDB not initialized');
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      try {
        const transaction = batchScanDB.transaction(['batchProgress'], 'readonly');
        const store = transaction.objectStore('batchProgress');
        const request = store.getAll();

        request.onsuccess = () => {
          debug('app', `Loaded ${request.result.length} batch progress items`);
          resolve(request.result);
        };

        request.onerror = (event) => {
          debug('app', `Error loading batch progress: ${event.target.error}`);
          reject(event.target.error);
        };
      } catch (error) {
        debug('app', `Error in loadBatchProgress: ${error.message}`, error);
        reject(error);
      }
    });
  }

  // Clear batch scan progress from IndexedDB
  function clearBatchProgress() {
    return new Promise((resolve, reject) => {
      if (!batchScanDB) {
        debug('app', 'IndexedDB not initialized');
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      try {
        const transaction = batchScanDB.transaction(['batchProgress'], 'readwrite');
        const store = transaction.objectStore('batchProgress');
        const request = store.clear();

        request.onsuccess = () => {
          debug('app', 'Cleared batch progress');
          resolve();
        };

        request.onerror = (event) => {
          debug('app', `Error clearing batch progress: ${event.target.error}`);
          reject(event.target.error);
        };
      } catch (error) {
        debug('app', `Error in clearBatchProgress: ${error.message}`, error);
        reject(error);
      }
    });
  }

  // State
  let recentSearches = JSON.parse(localStorage.getItem('td_recent_searches') || '[]');
  let scannedTemplates = [];

  // --- Batch Scanning Functionality ---
  // Function to toggle between single and batch modes
  function toggleScanMode(isBatchMode) {
    if (isBatchMode) {
      singleModeLabel.classList.remove('active');
      batchModeLabel.classList.add('active');
      singleScanContainer.style.display = 'none';
      batchUrlsContainer.classList.add('active');
      searchResults.style.display = 'none';
      if (batchScanActive) {
        batchResults.classList.add('active');
      }
    } else {
      singleModeLabel.classList.add('active');
      batchModeLabel.classList.remove('active');
      singleScanContainer.style.display = 'flex';
      batchUrlsContainer.classList.remove('active');
      searchResults.style.display = 'block';
      batchResults.classList.remove('active');
    }
  }

  // Function to parse URLs from textarea
  function parseUrlsFromTextarea() {
    const text = batchUrlsTextarea.value.trim();
    if (!text) return [];

    // Split by newlines and commas
    let urls = text
      .split(/[\n,]+/)
      .map((url) => url.trim())
      .filter((url) => url);

    // Validate and normalize URLs
    urls = urls
      .map((url) => {
        // If URL doesn't start with http/https, assume it's a GitHub repo reference
        if (!url.startsWith('http')) {
          // Check if it's in the format owner/repo
          if (url.includes('/')) {
            return `https://github.com/${url}`;
          } else {
            // Invalid format
            return null;
          }
        }
        return url;
      })
      .filter((url) => url !== null);

    return urls;
  }

  // Function to initialize batch scan
  async function startBatchScan() {
    const urls = parseUrlsFromTextarea();
    if (urls.length === 0) {
      if (window.NotificationSystem) {
        window.NotificationSystem.showWarning(
          'No URLs Found',
          'Please enter at least one valid GitHub repository URL.',
          5000,
        );
      }
      return;
    }

    try {
      // Initialize IndexedDB if not already initialized
      if (!batchScanDB) {
        await initBatchScanDB();
      }

      // Check for existing progress
      const existingProgress = await loadBatchProgress();
      let resumeMode = false;

      if (existingProgress && existingProgress.length > 0) {
        // Compare with current URLs to see if we're resuming
        const existingUrls = existingProgress.map((item) => item.url);
        const matchingUrls = urls.filter((url) => existingUrls.includes(url));

        if (matchingUrls.length > 0 && matchingUrls.length < urls.length) {
          // Ask user if they want to resume or start fresh using the notification system
          if (window.NotificationSystem) {
            await new Promise((resolve) => {
              window.NotificationSystem.showConfirmation(
                'Resume Batch Scan',
                `Found ${matchingUrls.length} previously scanned repositories. Would you like to resume and skip successful scans?`,
                'Resume', // Primary action
                'Start Fresh', // Secondary action
                (confirmed) => {
                  if (confirmed) {
                    resumeMode = true;
                    debug('app', 'Resuming batch scan with existing progress');
                  } else {
                    // User chose to start fresh
                    clearBatchProgress()
                      .then(() =>
                        debug('app', 'Starting fresh batch scan, cleared existing progress'),
                      )
                      .catch((err) =>
                        debug('app', `Error clearing batch progress: ${err.message}`, err),
                      );
                  }
                  resolve();
                },
              );
            });
          } else {
            // Fallback to confirm dialog if notification system is not available
            const confirmResume = confirm(
              `Found ${matchingUrls.length} previously scanned repositories. Would you like to resume and skip successful scans?`,
            );

            if (confirmResume) {
              resumeMode = true;
              debug('app', 'Resuming batch scan with existing progress');
            } else {
              // Clear existing progress
              await clearBatchProgress();
              debug('app', 'Starting fresh batch scan, cleared existing progress');
            }
          }
        } else if (matchingUrls.length === urls.length) {
          // All URLs match existing progress
          if (window.NotificationSystem) {
            await new Promise((resolve) => {
              window.NotificationSystem.showConfirmation(
                'Resume Batch Scan',
                `You've already scanned these repositories. Would you like to resume and skip successful scans?`,
                'Resume', // Primary action
                'Start Fresh', // Secondary action
                (confirmed) => {
                  if (confirmed) {
                    resumeMode = true;
                    debug('app', 'Resuming batch scan with existing progress');
                  } else {
                    // User chose to start fresh
                    clearBatchProgress()
                      .then(() =>
                        debug('app', 'Starting fresh batch scan, cleared existing progress'),
                      )
                      .catch((err) =>
                        debug('app', `Error clearing batch progress: ${err.message}`, err),
                      );
                  }
                  resolve();
                },
              );
            });
          } else {
            // Fallback to confirm dialog if notification system is not available
            const confirmResume = confirm(
              `You've already scanned these repositories. Would you like to resume and skip successful scans?`,
            );

            if (confirmResume) {
              resumeMode = true;
              debug('app', 'Resuming batch scan with existing progress');
            } else {
              // Clear existing progress
              await clearBatchProgress();
              debug('app', 'Starting fresh batch scan, cleared existing progress');
            }
          }
        } else {
          // No matching URLs, clear existing progress
          await clearBatchProgress();
          debug('app', 'Starting fresh batch scan with new URLs');
        }
      }

      // Reset batch scan state
      batchUrls = urls;
      batchScanActive = true;
      batchProcessedCount = 0;
      batchCancelled = false;

      // Clear previous batch items
      batchItems.innerHTML = '';

      // Initialize UI
      batchProgressBar.style.width = '0%';
      batchProgressText.textContent = `0/${urls.length} Completed`;
      batchResults.classList.add('active');
      batchCancelContainer.style.display = 'block';

      // Create placeholder items for each URL
      urls.forEach((url, index) => {
        const item = document.createElement('div');

        // Check if we have existing progress for this URL in resume mode
        let initialClass = 'batch-item pending';
        let initialStatus = 'Pending';
        let initialMessage = 'Waiting to be processed...';
        let viewBtnDisabled = true;
        let retryBtnDisabled = true;

        if (resumeMode) {
          const existingItem = existingProgress.find((p) => p.url === url);
          if (existingItem && existingItem.status === 'success') {
            initialClass = 'batch-item success';
            initialStatus = 'Completed';
            initialMessage = existingItem.result
              ? `Analysis complete: ${existingItem.result.compliance.issues.length} issues, ${existingItem.result.compliance.compliant.length} passed`
              : 'Analysis complete';
            viewBtnDisabled = false;
            batchProcessedCount++; // Count previously successful items
          }
        }

        item.className = initialClass;
        item.id = `batch-item-${index}`;

        // Extract repo name from URL for display
        let repoName = url;
        if (url.includes('github.com/')) {
          repoName = url.split('github.com/')[1];
        }

        item.innerHTML = `
                    <div class="batch-item-header">
                        <div class="batch-item-title">${repoName}</div>
                        <div class="batch-item-status">${initialStatus}</div>
                    </div>
                    <div class="batch-item-message">${initialMessage}</div>
                    <div class="batch-item-actions">
                        <button class="view-btn" ${viewBtnDisabled ? 'disabled' : ''}>View Report</button>
                        <button class="retry-btn" ${retryBtnDisabled ? 'disabled' : ''}>Retry</button>
                    </div>
                `;

        batchItems.appendChild(item);

        // If this item is already successful and we're in resume mode,
        // set up the view button click handler with stored result
        if (resumeMode && !viewBtnDisabled) {
          const existingItem = existingProgress.find((p) => p.url === url);
          if (existingItem && existingItem.result) {
            const viewBtn = item.querySelector('.view-btn');
            viewBtn.addEventListener('click', () => {
              displayBatchItemResults(existingItem.result);
            });
          }
        }
      });

      // Update initial progress
      if (resumeMode && batchProcessedCount > 0) {
        const progressPercentage = (batchProcessedCount / urls.length) * 100;
        batchProgressBar.style.width = `${progressPercentage}%`;
        batchProgressText.textContent = `${batchProcessedCount}/${urls.length} Completed`;
      }

      // Process each URL sequentially
      for (let i = 0; i < urls.length; i++) {
        // Check if the batch was cancelled
        if (batchCancelled) {
          debug('app', 'Batch scan cancelled, stopping further processing');
          break;
        }

        const url = urls[i];
        const itemElement = document.getElementById(`batch-item-${i}`);

        // Skip already successful items in resume mode
        if (resumeMode) {
          const existingItem = existingProgress.find((p) => p.url === url);
          if (existingItem && existingItem.status === 'success') {
            debug('app', `Skipping already successful item ${i + 1}/${urls.length}: ${url}`);
            continue;
          }
        }

        // Update UI to show processing
        itemElement.className = 'batch-item processing';
        itemElement.querySelector('.batch-item-status').textContent = 'Processing';
        itemElement.querySelector('.batch-item-message').textContent =
          'Checking repository status...';

        try {
          debug('app', `Processing batch item ${i + 1}/${urls.length}: ${url}`);

          // First check if the repository needs to be forked
          let processedUrl = url;
          try {
            processedUrl = await checkAndUpdateRepoUrl(url);

            if (processedUrl !== url) {
              itemElement.querySelector('.batch-item-message').textContent =
                'Using fork of the repository...';
            } else {
              itemElement.querySelector('.batch-item-message').textContent =
                'Analyzing repository...';
            }
          } catch (forkError) {
            debug('app', `Error during fork check: ${forkError.message}`, forkError);
            itemElement.querySelector('.batch-item-message').textContent =
              'Proceeding with original repository...';
          }

          // Process with the obtained URL (original or forked)
          const result = await appAnalyzer.analyzeTemplate(processedUrl, 'dod');

          // Update item UI to show success
          itemElement.className = 'batch-item success';
          itemElement.querySelector('.batch-item-status').textContent = 'Completed';
          itemElement.querySelector('.batch-item-message').textContent =
            `Analysis complete: ${result.compliance.issues.length} issues, ${result.compliance.compliant.length} passed`;

          // Update buttons
          const viewBtn = itemElement.querySelector('.view-btn');
          viewBtn.disabled = false;

          // Add click handler for view button
          viewBtn.addEventListener('click', () => {
            // Display the results for this specific repository
            displayBatchItemResults(result);
          });

          // Save successful result to IndexedDB
          try {
            await saveBatchProgress(`repo-${i}`, url, 'success', result);
            debug('app', `Saved successful result for ${url} to IndexedDB`);
          } catch (dbError) {
            debug('app', `Error saving to IndexedDB: ${dbError.message}`, dbError);
          } // Submit analysis results to GitHub for PR creation
          if (window.submitAnalysisToGitHub && window.GitHubClient?.auth?.isAuthenticated()) {
            try {
              // Get current username
              const username = window.GitHubClient.auth.getUsername();

              if (username) {
                debug('app', `Submitting batch item analysis to GitHub with username: ${username}`);

                itemElement.querySelector('.batch-item-message').textContent =
                  'Creating PR with results...';

                const submitResult = await window.submitAnalysisToGitHub(result, username);

                if (submitResult.success) {
                  debug('app', 'Batch item analysis submitted successfully to GitHub');
                  itemElement.querySelector('.batch-item-message').textContent =
                    `Analysis complete: ${result.compliance.issues.length} issues, ${result.compliance.compliant.length} passed. PR created.`;
                } else {
                  debug('app', `Error submitting batch item analysis: ${submitResult.error}`);
                  itemElement.querySelector('.batch-item-message').textContent =
                    `Analysis complete: ${result.compliance.issues.length} issues, ${result.compliance.compliant.length} passed. PR creation failed.`;
                }
              }
            } catch (submitErr) {
              debug(
                'app',
                `Error in GitHub submission for batch item: ${submitErr.message}`,
                submitErr,
              );
              itemElement.querySelector('.batch-item-message').textContent =
                `Analysis complete but PR creation failed: ${submitErr.message}`;
            }
          }
        } catch (error) {
          debug('app', `Error processing batch item ${i + 1}: ${error.message}`, error);

          // Update item UI to show error
          itemElement.className = 'batch-item error';
          itemElement.querySelector('.batch-item-status').textContent = 'Error';
          itemElement.querySelector('.batch-item-message').textContent =
            error.message || 'An unknown error occurred';

          // Save error state to IndexedDB
          try {
            await saveBatchProgress(`repo-${i}`, url, 'error');
            debug('app', `Saved error state for ${url} to IndexedDB`);
          } catch (dbError) {
            debug('app', `Error saving error state to IndexedDB: ${dbError.message}`, dbError);
          }

          // Enable retry button
          const retryBtn = itemElement.querySelector('.retry-btn');
          retryBtn.disabled = false;

          // Add click handler for retry button
          retryBtn.addEventListener('click', async () => {
            // Reset this item and retry
            itemElement.className = 'batch-item processing';
            itemElement.querySelector('.batch-item-status').textContent = 'Processing';
            itemElement.querySelector('.batch-item-message').textContent = 'Retrying...';
            retryBtn.disabled = true;

            try {
              // Retry the forking check and analysis
              let processedUrl = url;
              try {
                processedUrl = await checkAndUpdateRepoUrl(url);
              } catch (forkError) {
                debug('app', `Error during retry fork check: ${forkError.message}`, forkError);
              }

              const retryResult = await appAnalyzer.analyzeTemplate(processedUrl, 'dod');

              // Update item UI to show success
              itemElement.className = 'batch-item success';
              itemElement.querySelector('.batch-item-status').textContent = 'Completed';
              itemElement.querySelector('.batch-item-message').textContent =
                `Analysis complete: ${retryResult.compliance.issues.length} issues, ${retryResult.compliance.compliant.length} passed`;

              // Enable view button
              const viewBtn = itemElement.querySelector('.view-btn');
              viewBtn.disabled = false;

              // Add click handler for view button
              viewBtn.addEventListener('click', () => {
                displayBatchItemResults(retryResult);
              });

              // Save successful retry result to IndexedDB
              try {
                await saveBatchProgress(`repo-${i}`, url, 'success', retryResult);
                debug('app', `Saved successful retry result for ${url} to IndexedDB`);
              } catch (dbError) {
                debug('app', `Error saving retry result to IndexedDB: ${dbError.message}`, dbError);
              }
            } catch (retryError) {
              debug('app', `Error during retry of batch item: ${retryError.message}`, retryError);

              // Update item UI to show error
              itemElement.className = 'batch-item error';
              itemElement.querySelector('.batch-item-status').textContent = 'Error';
              itemElement.querySelector('.batch-item-message').textContent =
                retryError.message || 'An unknown error occurred during retry';

              // Re-enable retry button
              retryBtn.disabled = false;

              // Save retry error state to IndexedDB
              try {
                await saveBatchProgress(`repo-${i}`, url, 'error');
                debug('app', `Saved retry error state for ${url} to IndexedDB`);
              } catch (dbError) {
                debug(
                  'app',
                  `Error saving retry error state to IndexedDB: ${dbError.message}`,
                  dbError,
                );
              }
            }
          });
        }

        // Update progress
        batchProcessedCount++;
        const progressPercentage = (batchProcessedCount / urls.length) * 100;
        batchProgressBar.style.width = `${progressPercentage}%`;
        batchProgressText.textContent = `${batchProcessedCount}/${urls.length} Completed`;
      }

      // All items processed, update UI
      if (batchCancelled) {
        const cancelledItems = batchUrls.length - batchProcessedCount;
        if (window.NotificationSystem) {
          window.NotificationSystem.showInfo(
            'Batch Scan Cancelled',
            `Batch scan cancelled. ${batchProcessedCount} repositories processed, ${cancelledItems} cancelled.`,
            5000,
          );
        }
      } else {
        if (window.NotificationSystem) {
          window.NotificationSystem.showSuccess(
            'Batch Scan Complete',
            `Completed scanning ${batchUrls.length} repositories.`,
            5000,
          );
        }
      }

      // Hide cancel button when all done
      batchCancelContainer.style.display = 'none';
    } catch (error) {
      debug('app', `Error in batch scan: ${error.message}`, error);
      if (window.NotificationSystem) {
        window.NotificationSystem.showError(
          'Batch Scan Error',
          `An error occurred during batch scan: ${error.message}`,
          5000,
        );
      }
    }
  }

  // Function to display results for a specific batch item
  function displayBatchItemResults(result) {
    // Show loading state
    document.getElementById('search-section').style.display = 'none';
    if (scannedTemplatesSection) scannedTemplatesSection.style.display = 'none';
    analysisSection.style.display = 'block';
    resultsContainer.style.display = 'none';
    loadingContainer.style.display = 'none';
    errorSection.style.display = 'none';

    // Set repo info
    const repoName = result.repoUrl.split('github.com/')[1] || result.repoUrl;
    document.getElementById('repo-name').textContent = repoName;
    document.getElementById('repo-url').textContent = result.repoUrl;

    // Change the back button text to "Back to Results" for batch items
    const backButton = document.getElementById('back-button');
    if (backButton) {
      backButton.innerHTML = '<i class="fas fa-arrow-left"></i> Back to Results';

      // Store the original event listener
      const originalListener = backButton.onclick;

      // Set a new event listener that will first restore the button text and then call the original listener
      backButton.onclick = function () {
        backButton.innerHTML = '<i class="fas fa-arrow-left"></i> Back to Search';
        backButton.onclick = originalListener; // Restore original event listener
        originalListener.call(this); // Call the original listener
      };
    }

    // Render the dashboard
    resultsContainer.style.display = 'block';
    debug('app', 'Rendering batch item analysis results', result);
    appDashboard.render(result, resultsContainer);

    // Scroll to the top of the analysis section
    analysisSection.scrollIntoView({ behavior: 'smooth' });
  }

  // --- Scanned Templates Functionality ---
  function loadScannedTemplates() {
    // First check if user is authenticated
    if (!window.GitHubAuth || !window.GitHubAuth.isAuthenticated()) {
      debug('app', 'User is not authenticated, not loading scanned templates');
      scannedTemplates = [];
      return false;
    }

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

  // Add these variables for pagination
  let currentPage = 1;
  const templatesPerPage = 6;

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
      const templateId = `template-${template.relativePath.split('/')[0]}`.replace(
        /[^a-zA-Z0-9-]/g,
        '-',
      );

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
                        <div class="compliance-fill" style="width: ${template.compliance.percentage}%"></div>
                        <span class="compliance-value">${template.compliance.percentage}%</span>
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
                    <button class="validate-btn">Run Validation</button>
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
        document.getElementById('repo-name').textContent =
          template.repoUrl.split('github.com/')[1] || template.repoUrl;
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
        const lastScanner =
          template.scannedBy && template.scannedBy.length > 0
            ? template.scannedBy[template.scannedBy.length - 1]
            : null;

        // Create the folder path with scanner prefix if needed
        const folderPath = lastScanner ? `${lastScanner}-${folderName}` : folderName;

        console.log(`HANDLER: Loading report for ${folderName} from path ${folderPath}`);

        // First, try to load latest.json to find the current data file
        const latestJsonPath = `/results/${folderPath}/latest.json`;
        console.log(`HANDLER: Fetching latest.json from: ${latestJsonPath}`);

        // Clear any existing reportData
        resultsContainer.innerHTML = '';

        fetch(latestJsonPath)
          .then((response) => {
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
          })
          .then((latestData) => {
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
              scriptTag.onload = function () {
                console.log('Script loaded! Window.reportData:', window.reportData);

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
                    showFullReportBtn.addEventListener('click', function () {
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
              scriptTag.onerror = function (error) {
                console.error('Script loading error:', error);
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
                  .then((response) => {
                    rawDataContainer.innerHTML += `
                                            <div style="margin-bottom: 10px;">
                                                <strong>Fetch status:</strong> ${response.status} ${response.statusText}
                                            </div>
                                        `;
                    return response.text();
                  })
                  .then((content) => {
                    // Show the raw file content
                    rawDataContainer.innerHTML += `
                                            <h4>Raw file content:</h4>
                                            <pre style="background: #333; color: #fff; padding: 10px; border-radius: 5px; max-height: 300px; overflow: auto;">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
                                        `;
                  })
                  .catch((fetchError) => {
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
          .catch((error) => {
            console.error(`HANDLER: Error in fetch process: ${error.message}`);
            loadingContainer.style.display = 'none';
            errorSection.style.display = 'block';
            errorMessage.textContent = `Error loading report: ${error.message}`;

            // Try to load report with ReportLoader instead
            if (window.ReportLoader) {
              console.log(`HANDLER: Falling back to ReportLoader`);
              // Add folderName and folderPath to template object for better context
              const templateWithFolder = {
                ...template,
                folderName: folderName,
                folderPath: folderPath,
              };
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
                    errorMessage.textContent =
                      'Report data is empty or invalid. This could be due to a missing data.js file.';
                    return;
                  }

                  debug(
                    'app',
                    'Report loaded successfully via ReportLoader, rendering dashboard',
                    result,
                  );
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
                  errorMessage.textContent =
                    errorMsg || 'An unknown error occurred loading the report';
                },
              );
            } else {
              debug('app', 'Report loader not available');
              loadingContainer.style.display = 'none';
              errorSection.style.display = 'block';
              errorMessage.textContent =
                'Report loader not initialized. Please reload the page and try again.';
            }
          });
      });

      card.querySelector('.rescan-btn').addEventListener('click', async () => {
        // Check if the repository needs to be forked before scanning
        try {
          const updatedRepoUrl = await checkAndUpdateRepoUrl(template.repoUrl);
          internalAnalyzeRepo(updatedRepoUrl, 'show-modal');
        } catch (error) {
          debug('app', `Error checking fork status: ${error.message}`, error);
          // Continue with original URL on error
          internalAnalyzeRepo(template.repoUrl, 'show-modal');
        }
      });

      // Add event listener for validate button
      card.querySelector('.validate-btn').addEventListener('click', () => {
        // Show loading state
        document.getElementById('search-section').style.display = 'none';
        if (scannedTemplatesSection) scannedTemplatesSection.style.display = 'none';
        analysisSection.style.display = 'block';
        resultsContainer.style.display = 'none';
        loadingContainer.style.display = 'none';
        errorSection.style.display = 'none';

        // Set repo info
        document.getElementById('repo-name').textContent =
          template.repoUrl.split('github.com/')[1] || template.repoUrl;
        document.getElementById('repo-url').textContent = template.repoUrl;

        // Check if validation container exists, create if not
        let validationContainer = document.getElementById('validation-container');
        if (!validationContainer) {
          validationContainer = document.createElement('div');
          validationContainer.id = 'validation-container';
          resultsContainer.parentNode.insertBefore(validationContainer, resultsContainer);
        }

        // Initialize the validation UI in the container
        if (window.GitHubWorkflowValidation) {
          window.GitHubWorkflowValidation.init(
            'validation-container',
            template.repoUrl,
            (status) => {
              debug('app', `Validation status update: ${status.status}`, status);
              // When validation completes, show the results container
              if (status.status === 'completed') {
                validationContainer.style.marginBottom = '30px';
                resultsContainer.style.display = 'block';
              }
            },
          );
        } else {
          validationContainer.innerHTML = `
            <div class="validation-error">
              <p>Validation module not loaded. Please refresh the page and try again.</p>
            </div>
          `;
        }

        // Show the container
        validationContainer.style.display = 'block';
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
    recentSearches = recentSearches.filter((url) => url !== repoUrl);
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
    recentSearches.forEach((url) => {
      const li = document.createElement('li');
      li.innerHTML = `<a href="#">${url}</a>`;
      li.querySelector('a').addEventListener('click', (e) => {
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

    debug(
      'app',
      `Searching for template with repo name: ${repoNameToSearch} (from: ${searchTerm})`,
    );

    // Search through templates, focusing on the repo name
    let match = scannedTemplates.find((template) => {
      const repoUrl = template.repoUrl.toLowerCase();

      // Extract just the repo name (last part of the URL)
      const parts = repoUrl.split('/');
      const templateRepoName = parts[parts.length - 1].replace('.git', '');

      // Try exact match on repo name
      return templateRepoName === repoNameToSearch;
    });

    // If no exact repo name match, try matching against the full repository identifier (owner/repo)
    if (!match && searchTerm.includes('/')) {
      match = scannedTemplates.find((template) => {
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
      match = scannedTemplates.find((template) => {
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

    // Defensive fallback: if scanned templates haven't been populated yet but
    // window.templatesData exists (e.g., tests or late load), populate now to
    // avoid race conditions with the template-data-loaded event
    if (
      (!scannedTemplates || scannedTemplates.length === 0) &&
      Array.isArray(window.templatesData) &&
      window.templatesData.length > 0
    ) {
      scannedTemplates = window.templatesData;
    }

    // First check if this matches an already scanned template
    const matchedTemplate = findScannedTemplate(query);
    if (matchedTemplate) {
      searchResults.innerHTML = '';

      // Create result for the matched template
      const div = document.createElement('div');
      div.className = 'repo-item previously-scanned';

      const repoName = matchedTemplate.repoUrl.split('github.com/')[1] || matchedTemplate.repoUrl;
      const templateId = `template-${matchedTemplate.relativePath.split('/')[0]}`.replace(
        /[^a-zA-Z0-9-]/g,
        '-',
      );

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
                    <button class="validate-btn">Run Validation</button>
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
        document.getElementById('repo-name').textContent =
          matchedTemplate.repoUrl.split('github.com/')[1] || matchedTemplate.repoUrl;
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
            },
          );
        } else {
          debug('app', 'Report loader not available');
          loadingContainer.style.display = 'none';
          errorSection.style.display = 'block';
          errorMessage.textContent =
            'Report loader not initialized. Please reload the page and try again.';
        }

        scrollAndHighlightTemplate(templateId);
      });

      div.querySelector('.rescan-btn').addEventListener('click', async () => {
        // Check if the repository needs to be forked before scanning
        try {
          const updatedRepoUrl = await checkAndUpdateRepoUrl(matchedTemplate.repoUrl);
          internalAnalyzeRepo(updatedRepoUrl);
        } catch (error) {
          debug('app', `Error checking fork status: ${error.message}`, error);
          // Continue with original URL on error
          internalAnalyzeRepo(matchedTemplate.repoUrl);
        }
      });

      // Add event listener for validation button
      div.querySelector('.validate-btn').addEventListener('click', () => {
        // Extract template URL from the repoUrl
        const templateUrl = matchedTemplate.repoUrl;

        // Show validation UI in the analysis section
        document.getElementById('search-section').style.display = 'none';
        if (scannedTemplatesSection) scannedTemplatesSection.style.display = 'none';
        analysisSection.style.display = 'block';
        resultsContainer.style.display = 'none';
        loadingContainer.style.display = 'none';
        errorSection.style.display = 'none';

        // Set repo info
        document.getElementById('repo-name').textContent =
          matchedTemplate.repoUrl.split('github.com/')[1] || matchedTemplate.repoUrl;
        document.getElementById('repo-url').textContent = matchedTemplate.repoUrl;

        // Create validation container if it doesn't exist
        let validationContainer = document.getElementById('validation-container');
        if (!validationContainer) {
          validationContainer = document.createElement('div');
          validationContainer.id = 'validation-container';
          resultsContainer.parentNode.insertBefore(validationContainer, resultsContainer);
        }

        validationContainer.style.display = 'block';

        // Initialize the validation UI
        if (window.GitHubWorkflowValidation) {
          window.GitHubWorkflowValidation.init('validation-container', templateUrl, (status) => {
            debug('app', 'Validation status update:', status);
            // When validation completes, show the results container
            if (status.status === 'completed') {
              validationContainer.style.marginBottom = '30px';
              resultsContainer.style.display = 'block';
            }
          });
        } else {
          validationContainer.innerHTML = `
            <div class="validation-error">
              <p>Validation module not loaded. Please refresh the page and try again.</p>
            </div>
          `;
        }

        // Scroll to the validation container
        validationContainer.scrollIntoView({ behavior: 'smooth' });
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
                                <button class="validate-btn">Run Validation</button>
                            </div>
                        </div>
                    `;

          searchResults.querySelector('.analyze-btn').addEventListener('click', async () => {
            // Check if the repository needs to be forked before scanning
            try {
              const updatedRepoUrl = await checkAndUpdateRepoUrl(repoUrl);
              internalAnalyzeRepo(updatedRepoUrl, 'show-modal');
            } catch (error) {
              debug('app', `Error checking fork status: ${error.message}`, error);
              // Continue with original URL on error
              internalAnalyzeRepo(repoUrl, 'show-modal');
            }
          });

          // Add event listener for validate button
          searchResults.querySelector('.validate-btn').addEventListener('click', () => {
            // Show loading state
            document.getElementById('search-section').style.display = 'none';
            if (scannedTemplatesSection) scannedTemplatesSection.style.display = 'none';
            analysisSection.style.display = 'block';
            resultsContainer.style.display = 'none';
            loadingContainer.style.display = 'none';
            errorSection.style.display = 'none';

            // Set repo info
            document.getElementById('repo-name').textContent =
              repoUrl.split('github.com/')[1] || repoUrl;
            document.getElementById('repo-url').textContent = repoUrl;

            // Check if validation container exists, create if not
            let validationContainer = document.getElementById('validation-container');
            if (!validationContainer) {
              validationContainer = document.createElement('div');
              validationContainer.id = 'validation-container';
              resultsContainer.parentNode.insertBefore(validationContainer, resultsContainer);
            }

            // Initialize the validation UI in the container
            if (window.GitHubWorkflowValidation) {
              window.GitHubWorkflowValidation.init('validation-container', repoUrl, (status) => {
                debug('app', `Validation status update: ${status.status}`, status);
                // When validation completes, show the results container
                if (status.status === 'completed') {
                  validationContainer.style.marginBottom = '30px';
                  resultsContainer.style.display = 'block';
                }
              });
            } else {
              validationContainer.innerHTML = `
                <div class="validation-error">
                  <p>Validation module not loaded. Please refresh the page and try again.</p>
                </div>
              `;
            }

            // Show the container
            validationContainer.style.display = 'block';
          });
        } else {
          searchResults.innerHTML = '<div>No repositories found.</div>';
        }
        return;
      }

      searchResults.innerHTML = '';
      res.items.forEach((repo) => {
        const div = document.createElement('div');
        div.className = 'repo-item';

        // Check if this repo was previously scanned
        const previouslyScanneIndex = scannedTemplates.findIndex(
          (t) =>
            t.repoUrl.includes(repo.full_name) ||
            repo.html_url.includes(t.repoUrl.split('github.com/')[1]),
        );

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
                        ${
                          isPreviouslyScanned
                            ? `<button class="view-report-btn" data-index="${previouslyScanneIndex}">View Report</button>`
                            : ''
                        }
                        <button class="analyze-btn">${isPreviouslyScanned ? 'Rescan' : isUserRepo ? 'Scan Template' : 'Fork and Scan Template'}</button>
                        <button class="validate-btn">Run Validation</button>
                    </div>
                `;

        div.querySelector('.analyze-btn').addEventListener('click', async () => {
          if (isUserRepo || isPreviouslyScanned) {
            // Even for previously scanned repos, check if it needs to be forked
            try {
              const updatedRepoUrl = await checkAndUpdateRepoUrl(repo.html_url);
              internalAnalyzeRepo(updatedRepoUrl, 'show-modal');
            } catch (error) {
              debug('app', `Error checking fork status: ${error.message}`, error);
              // Continue with original URL on error
              internalAnalyzeRepo(repo.html_url, 'show-modal');
            }
          } else {
            // Would need to implement fork functionality
            try {
              const updatedRepoUrl = await checkAndUpdateRepoUrl(repo.html_url);
              internalAnalyzeRepo(updatedRepoUrl, 'show-modal');
            } catch (error) {
              debug('app', `Error checking fork status: ${error.message}`, error);
              // Use the original approach as fallback
              if (window.Notifications) {
                window.Notifications.confirm(
                  'Fork Repository',
                  `This will fork ${repo.full_name} to your account before scanning. Continue?`,
                  {
                    confirmLabel: 'Fork and Scan',
                    cancelLabel: 'Cancel',
                    onConfirm: () => {
                      internalAnalyzeRepo(repo.html_url, 'show-modal');
                    },
                  },
                );
              } else {
                if (
                  confirm(
                    `This will fork ${repo.full_name} to your account before scanning. Continue?`,
                  )
                ) {
                  internalAnalyzeRepo(repo.html_url, 'show-modal');
                }
              }
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
            document.getElementById('repo-name').textContent =
              template.repoUrl.split('github.com/')[1] || template.repoUrl;
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
                  errorMessage.textContent =
                    errorMsg || 'An unknown error occurred loading the report';
                },
              );
            } else {
              debug('app', 'Report loader not available');
              loadingContainer.style.display = 'none';
              errorSection.style.display = 'block';
              errorMessage.textContent =
                'Report loader not initialized. Please reload the page and try again.';
            }

            // Also scroll to the template card and highlight it
            const templateId = `template-${template.relativePath.split('/')[0]}`.replace(
              /[^a-zA-Z0-9-]/g,
              '-',
            );
            scrollAndHighlightTemplate(templateId);
          });
        }

        // Add event listener for validate button
        div.querySelector('.validate-btn').addEventListener('click', () => {
          // Show loading state
          document.getElementById('search-section').style.display = 'none';
          if (scannedTemplatesSection) scannedTemplatesSection.style.display = 'none';
          analysisSection.style.display = 'block';
          resultsContainer.style.display = 'none';
          loadingContainer.style.display = 'none';
          errorSection.style.display = 'none';

          // Set repo info
          document.getElementById('repo-name').textContent = repo.full_name;
          document.getElementById('repo-url').textContent = repo.html_url;

          // Check if validation container exists, create if not
          let validationContainer = document.getElementById('validation-container');
          if (!validationContainer) {
            validationContainer = document.createElement('div');
            validationContainer.id = 'validation-container';
            resultsContainer.parentNode.insertBefore(validationContainer, resultsContainer);
          }

          // Initialize the validation UI in the container
          if (window.GitHubWorkflowValidation) {
            window.GitHubWorkflowValidation.init(
              'validation-container',
              repo.html_url,
              (status) => {
                debug('app', `Validation status update: ${status.status}`, status);
                // When validation completes, show the results container
                if (status.status === 'completed') {
                  validationContainer.style.marginBottom = '30px';
                  resultsContainer.style.display = 'block';
                }
              },
            );
          } else {
            validationContainer.innerHTML = `
              <div class="validation-error">
                <p>Validation module not loaded. Please refresh the page and try again.</p>
              </div>
            `;
          }

          // Show the container
          validationContainer.style.display = 'block';
        });

        searchResults.appendChild(div);

        // If this repo was previously scanned, highlight the template
        if (isPreviouslyScanned) {
          const template = scannedTemplates[previouslyScanneIndex];
          const templateId = `template-${template.relativePath.split('/')[0]}`.replace(
            /[^a-zA-Z0-9-]/g,
            '-',
          );
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
      const templateIndex = Array.from(allTemplateCards).findIndex(
        (card) => card.id === templateId,
      );

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
  internalAnalyzeRepo = async function (repoUrl, ruleSet = 'dod') {
    if (!ruleSet || ruleSet === 'dod') {
      const cfg = window.TemplateDoctorConfig || {};
      if (cfg.defaultRuleSet && typeof cfg.defaultRuleSet === 'string') {
        ruleSet = cfg.defaultRuleSet;
      }
    }
    
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
            5000,
          );
        }
        debug('app', 'Required services still unavailable after reinitialization attempt');
        return;
      }
    }
    
    // Determine whether to use server-side or client-side analysis
    const cfg = window.TemplateDoctorConfig || {};
    // Check for server-side analysis preference in config - now handled by the analyzer
    // We still need this for backward compatibility with older code paths
  const useServerSide = cfg.analysis?.useServerSide === true;

    // Check if the repository belongs to one of the configured organizations
    // and offer to use the user's fork instead
    try {
      debug('app', `Checking if repository ${repoUrl} needs forking`);
      const updatedRepoUrl = await checkAndUpdateRepoUrl(repoUrl);

      if (updatedRepoUrl !== repoUrl) {
        debug('app', `Repository URL updated from ${repoUrl} to ${updatedRepoUrl}`);
        repoUrl = updatedRepoUrl;
      }
    } catch (forkCheckError) {
      debug('app', `Error checking fork status: ${forkCheckError.message}`, forkCheckError);
      // Continue with original URL on error
    }

    // Double-check analyzer
    if (!appAnalyzer) {
      debug('app', 'Template analyzer still not available after reinitialization');

      if (window.NotificationSystem) {
        window.NotificationSystem.showWarning(
          'Initializing Analyzer',
          'Template analyzer is initializing. Your request will be processed shortly.',
          5000,
        );
      }

      // Wait a moment and try again
      setTimeout(() => {
        if (window.TemplateAnalyzer) {
          appAnalyzer = window.TemplateAnalyzer;
          internalAnalyzeRepo(repoUrl, ruleSet); // Retry the analysis
        } else {
          if (window.NotificationSystem) {
            window.NotificationSystem.showError(
              'Analyzer Not Available',
              'Could not initialize the analyzer. Please refresh the page and try again.',
              5000,
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
              5000,
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
            5000,
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
      const ruleSetDisplayName =
        ruleSet === 'dod'
          ? 'DoD'
          : ruleSet === 'partner'
            ? 'Partner'
            : ruleSet === 'docs'
              ? 'Docs'
              : 'Custom';
      window.NotificationSystem.showInfo(
        'Analysis Started',
        `Analyzing repository: ${repoName} with ${ruleSetDisplayName} ruleset`,
        3000,
      );
    }

    try {
      debug('app', `Starting analysis of repo: ${repoUrl} with ruleset: ${ruleSet}`);
      let result;
      
      // Determine whether to use server-side or client-side analysis
      if (useServerSide) {
        try {
          debug('app', `Using server-side analysis for ${repoUrl}`);
          
          // Use the analyzer's server-side implementation which handles all the API logic
          result = await appAnalyzer.analyzeTemplate(repoUrl, ruleSet);
          
          // Add custom configuration details if applicable
          if (ruleSet === 'custom' && customConfig) {
            result.customConfig = {
              gistUrl: customConfig.gistUrl || null,
            };
          }
          
          // Validate minimal result structure
          if (!result.repoUrl) result.repoUrl = repoUrl;
          if (!result.ruleSet) result.ruleSet = ruleSet;
          if (!result.compliance) {
            throw new Error('Invalid analysis result: missing compliance data');
          }
          
          debug('app', 'Server-side analysis complete');
        } catch (apiError) {
          debug('app', `Server-side analysis failed: ${apiError.message}`, apiError);
          
          // Strict mode: no client-side fallback when server preferred
          throw apiError;
        }
      } else {
        // Use client-side analyzer
        debug('app', `Using client-side analysis for ${repoUrl}`);
        result = await appAnalyzer.analyzeTemplate(repoUrl, ruleSet);
      }

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
                  5000,
                );
              }
            } else {
              debug('app', `Error submitting analysis: ${submitResult.error}`);
              if (window.NotificationSystem) {
                const errorMessage = submitResult.details
                  ? `${submitResult.error} ${submitResult.details}`
                  : submitResult.error;

                const helpLink = document.createElement('div');
                helpLink.style.marginTop = '10px';
                helpLink.innerHTML = `
                                    <a href="/docs/usage/GITHUB_ACTION_SETUP.md" target="_blank" style="color: #0078d4; text-decoration: underline;">
                                        View GitHub Action setup guide
                                    </a>
                                `;

                window.NotificationSystem.showWarning(
                  'Submission Issue',
                  `Analysis completed but could not be submitted: ${errorMessage}`,
                  10000,
                  helpLink,
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
                            <a href="/docs/usage/GITHUB_ACTION_SETUP.md" target="_blank" style="color: #0078d4; text-decoration: underline;">
                                View GitHub Action setup guide
                            </a>
                        `;

            window.NotificationSystem.showWarning(
              'Submission Error',
              `Failed to submit analysis: ${submitErr.message}`,
              10000,
              helpLink,
            );
          }
        }
      }
    } catch (err) {
      debug('app', `Error analyzing repo: ${err.message}`, err);
      loadingContainer.style.display = 'none';
      errorSection.style.display = 'block';

      // Check if this is a SAML error (detected by the GitHub client)
      if (
        err.isSamlError ||
        (err.status === 403 && err.data?.documentation_url?.includes('/saml-single-sign-on/'))
      ) {
        console.log('[App] SAML protected repository detected, attempting to fork');

        // Update error message
        errorMessage.textContent =
          'This repository is protected by SAML SSO. Attempting to fork it...';

        // Extract owner and repo from URL to attempt forking
        try {
          const urlParts = repoUrl.split('github.com/')[1].split('/');
          const owner = urlParts[0];
          const repo = urlParts[1];

          if (!owner || !repo || !window.GitHubClient) {
            throw new Error('Invalid repository URL or GitHub client not available');
          }

          // Check if user is authenticated
          if (!window.GitHubClient.auth.isAuthenticated()) {
            errorMessage.textContent =
              'Please login with GitHub to fork this SAML-protected repository.';
            return;
          }

          // Create and add a loading indicator
          const loadingIndicator = document.createElement('div');
          loadingIndicator.className = 'fork-loading';
          loadingIndicator.innerHTML =
            '<div class="loading-spinner"></div><p>Attempting to fork repository...</p>';
          document.querySelector('.error-container').appendChild(loadingIndicator);

          // Try to fork the repository
          (async function () {
            try {
              // Check if user already has a fork
              const currentUsername = window.GitHubClient.auth.getUsername();
              const hasFork = await window.GitHubClient.checkUserHasFork(owner, repo);

              let forkUrl;
              if (hasFork) {
                // User already has a fork
                console.log(`[App] User already has a fork of ${owner}/${repo}`);
                forkUrl = `https://github.com/${currentUsername}/${repo}`;
              } else {
                // Create a new fork
                console.log(`[App] Attempting to create a new fork of ${owner}/${repo}`);
                const forkResult = await window.GitHubClient.forkRepository(owner, repo);

                if (!forkResult || !forkResult.html_url) {
                  throw new Error('Failed to create fork - no URL returned');
                }

                forkUrl = forkResult.html_url;
              }

              // Remove loading indicator
              loadingIndicator.remove();

              // Update error message with success
              errorMessage.textContent = `Successfully forked repository. Analyzing the fork...`;

              // Hide error section and show loading again
              errorSection.style.display = 'none';
              loadingContainer.style.display = 'flex';

              // Prefer confirmed fork URL if available (poll client for availability)
              try {
                if (
                  window.GitHubClient &&
                  typeof window.GitHubClient.waitForForkAvailability === 'function'
                ) {
                  const urlParts = forkUrl.split('github.com/')[1].split('/');
                  const forkOwner = urlParts[0];
                  const forkRepo = urlParts[1];
                  const confirmed = await window.GitHubClient.waitForForkAvailability(owner, repo);
                  if (confirmed?.html_url) {
                    forkUrl = confirmed.html_url;
                  } else if (forkOwner && forkRepo) {
                    // Compose canonical URL just in case
                    forkUrl = `https://github.com/${forkOwner}/${forkRepo}`;
                  }
                }
              } catch (confirmErr) {
                console.warn(
                  '[App] Fork confirmation failed, proceeding with initial URL:',
                  confirmErr?.message || confirmErr,
                );
              }

              // Use the internal analyze function to analyze the forked repo (confirmed URL if available)
              internalAnalyzeRepo(forkUrl, ruleSet);
            } catch (forkError) {
              // Remove loading indicator
              loadingIndicator.remove();

              // Update error message
              errorMessage.textContent = `Failed to fork repository: ${forkError.message}`;

              // If this is also a SAML error, show the auth link
              if (forkError.isSamlError && forkError.data?.documentation_url) {
                const authLink = document.createElement('div');
                authLink.innerHTML = `
                                    <p style="margin-top: 15px;">Authorization required for this organization.</p>
                                    <a href="${forkError.data.documentation_url}" target="_blank" 
                                       style="display: inline-block; margin-top: 10px; padding: 8px 16px; 
                                              background-color: #28a745; color: white; text-decoration: none; 
                                              border-radius: 4px; font-weight: bold;">
                                        Authorize SAML Access
                                    </a>
                                `;
                document.querySelector('.error-container').appendChild(authLink);
              }
            }
          })();
        } catch (parseError) {
          errorMessage.textContent = `Could not parse repository URL: ${parseError.message}`;
        }
      } else {
        // Regular error (not SAML-related)
        errorMessage.textContent = err.message || 'An unknown error occurred during analysis';
      }
    }
  };

  // Function to show ruleset configuration modal
  function showRuleSetModal(repoUrl) {
    // Use the showRulesetModal function from ruleset-modal.js
    if (window.showRulesetModal) {
      window.showRulesetModal(repoUrl);
    } else {
      console.error('showRulesetModal function not found. Is ruleset-modal.js loaded?');
      // Fallback to direct analysis if modal doesn't work
      internalAnalyzeRepo(repoUrl, 'dod');
    }
  }

  // --- Event Listeners ---
  if (searchButton) searchButton.addEventListener('click', searchRepos);
  if (searchInput)
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') searchRepos();
    });
  if (backButton)
    backButton.addEventListener('click', () => {
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
  if (errorBackButton)
    errorBackButton.addEventListener('click', () => {
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

  // Batch scan event listeners
  if (scanModeToggle) {
    scanModeToggle.addEventListener('change', function () {
      toggleScanMode(this.checked);
    });
  }

  if (batchScanButton) {
    batchScanButton.addEventListener('click', startBatchScan);
  }

  if (batchCancelBtn) {
    batchCancelBtn.addEventListener('click', function () {
      if (batchScanActive) {
        batchCancelled = true;

        // Record batch cancellation in IndexedDB
        if (batchScanDB) {
          // Save a cancellation marker in IndexedDB
          saveBatchProgress('batch-status', 'cancel', 'cancelled', {
            timestamp: new Date().toISOString(),
            processedCount: batchProcessedCount,
            totalCount: batchUrls.length,
          }).catch((error) => {
            debug('app', `Error saving batch cancellation to IndexedDB: ${error.message}`, error);
          });
        }

        if (window.NotificationSystem) {
          window.NotificationSystem.showInfo(
            'Cancelling Batch Scan',
            'Batch scan is being cancelled. Current scan will complete before stopping.',
            5000,
          );
        }
        this.disabled = true;
        this.textContent = 'Cancelling...';
      }
    });
  }

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
    document.addEventListener('template-data-loaded', function () {
      debug('app', 'Template data loaded event received');
      loadScannedTemplates();
    });
  }

  // Listen for authentication state changes
  document.addEventListener('auth-state-changed', function (event) {
    debug('app', 'Auth state changed event received', event.detail);
    if (event.detail.authenticated) {
      // User authenticated, load templates data
      loadScannedTemplates();
    } else {
      // User logged out, clear templates data
      scannedTemplates = [];
      if (templateGrid) {
        templateGrid.innerHTML =
          '<div class="no-templates">Please sign in to view scanned templates.</div>';
      }
      // Hide pagination
      const pagination = scannedTemplatesSection?.querySelector('.pagination');
      if (pagination) pagination.style.display = 'none';
    }
  });

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
    dashboard: !!appDashboard,
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
        3000,
      );
    }
  } else {
    debug('app', 'Template analyzer still not available after ready event');
  }
});
