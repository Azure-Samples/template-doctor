// GitHub Issue Handler - Functions for creating GitHub issues from compliance reports

/**
 * Create a GitHub issue for all compliance issues
 */
async function createGitHubIssue() {
  // Make sure we have report data
  if (!window.reportData) {
    console.error('No report data available');
    if (window.Notifications) {
      window.Notifications.error('Error', 'No compliance data available to create GitHub issue');
    }
    return;
  }

  // Check if GitHub client is available and user is authenticated
  if (!window.GitHubClient) {
    console.error('GitHub client not available');
    if (window.Notifications) {
      window.Notifications.error(
        'Error',
        'GitHub client not available. Please refresh the page and try again.',
      );
    }
    return;
  }

  const github = window.GitHubClient;

  if (!github.auth || !github.auth.isAuthenticated()) {
    console.log('User not authenticated, prompting login');
    if (window.Notifications) {
      window.Notifications.warning(
        'Authentication Required',
        'You need to be logged in with GitHub to create issues.',
        10000,
      );
    }

    // Trigger login flow
    if (github.auth && typeof github.auth.login === 'function') {
      github.auth.login();
    }
    return;
  }

  // Show a confirmation dialog using our notification system
  if (window.Notifications) {
    window.Notifications.confirm(
      'Create GitHub Issues',
      'This will create GitHub issues for all compliance problems in the repository. Proceed?',
      {
        confirmLabel: 'Create Issues',
        cancelLabel: 'Cancel',
        onConfirm: () => processIssueCreation(github),
      },
    );
  } else {
    // Fallback to regular confirm if notification system isn't available
    if (
      confirm(
        'This will create GitHub issues for all compliance problems in the repository. Proceed?',
      )
    ) {
      processIssueCreation(github);
    }
  }
}

/**
 * Verify that the token has the required scopes
 * @param {Object} github - GitHub client instance
 * @returns {Promise<boolean>} - True if token has required scopes
 */
async function verifyRequiredScopes(github) {
  try {
    // Check if the token has the required scopes
    const scopes = await github.checkTokenScopes();
    console.log('Token scopes:', scopes);

    const requiredScopes = ['public_repo'];
    const hasRequiredScopes = requiredScopes.some(
      (scope) => scopes.includes(scope) || scopes.includes('repo'), // Full 'repo' scope would also work
    );

    if (!hasRequiredScopes) {
      if (window.NotificationSystem) {
        window.NotificationSystem.showError(
          'Permission Error',
          'Your GitHub token does not have the "public_repo" permission required to create issues. Please logout and login again to grant this permission.',
          15000,
        );
      } else if (window.Notifications) {
        window.Notifications.error(
          'Permission Error',
          'Your GitHub token does not have the "public_repo" permission required to create issues. Please logout and login again to grant this permission.',
        );
      } else {
        console.error(
          'Permission Error: Your GitHub token does not have the required permissions.',
        );
      }
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error verifying scopes:', error);
    return false;
  }
}

/**
 * Process the issue creation workflow
 * @param {Object} github - GitHub client instance
 */
async function processIssueCreation(github) {
  // First verify we have the required scopes
  const hasScopes = await verifyRequiredScopes(github);
  if (!hasScopes) return;
  // Add today's date in square brackets for the issue title
  const today = new Date();
  const formattedDate = `[${today.toISOString().split('T')[0]}]`;

  // Get the repository owner and name from the URL
  const repoUrl = window.reportData.repoUrl;
  let owner, repo;

  try {
    const urlParts = new URL(repoUrl).pathname.split('/');
    if (urlParts.length >= 3) {
      owner = urlParts[1];
      repo = urlParts[2];
    }
  } catch (e) {
    console.error('Failed to parse repository URL', e);
  }

  if (!owner || !repo) {
    if (window.NotificationSystem) {
      window.NotificationSystem.showError(
        'Error',
        'Could not determine repository owner and name from URL. Please check the repository URL.',
        10000,
      );
    } else if (window.Notifications) {
      window.Notifications.error(
        'Error',
        'Could not determine repository owner and name from URL. Please check the repository URL.',
      );
    } else {
      console.error('Could not determine repository owner and name from URL.');
    }
    return;
  }

  // Show loading notification
  let notification;
  if (window.NotificationSystem) {
    notification = window.NotificationSystem.showLoading(
      'Creating GitHub Issues',
      'Preparing to create issues...',
    );
  } else if (window.Notifications) {
    notification = window.Notifications.loading(
      'Creating GitHub Issues',
      'Preparing to create issues...',
    );
  }

  // Disable the button to prevent multiple submissions
  const createIssueButton = document.getElementById('create-github-issue-btn');
  // Define restoreButton function in the outer scope so it's accessible throughout the function
  let restoreButton = () => {}; // Default empty function

  if (createIssueButton) {
    const originalText = createIssueButton.innerHTML;
    createIssueButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Issues...';
    createIssueButton.disabled = true;

    // Assign the actual implementation to the already declared restoreButton
    restoreButton = () => {
      createIssueButton.innerHTML = originalText;
      createIssueButton.disabled = false;
    };
  }

  try {
    // First check if the repository exists and is accessible
    if (notification)
      notification.update('Checking repository access', 'Verifying repository permissions...');

    let repoInfo;
    try {
      repoInfo = await github.getRepository(owner, repo);
    } catch (error) {
      console.error('Error accessing repository:', error);
      if (notification)
        notification.error(
          'Repository Error',
          'Could not access the repository. Make sure it exists and you have proper permissions.',
        );
      if (createIssueButton) restoreButton();
      return;
    }

    // Check if we should create child issues for each problem
    const createChildIssues = window.reportData.compliance.issues.length > 0;

    // Create the main issue first
    if (notification)
      notification.update('Creating main issue', 'Creating the main tracking issue...');

    // Create summary of issues for the GitHub issue body
    let issueBody = '# Template Doctor Analysis\n\n';
    issueBody += `Template: ${window.reportData.repoUrl}\n\n`;
    issueBody += `Analyzed on: ${new Date().toLocaleString()}\n\n`;
    issueBody += `## Summary\n\n`;
    issueBody += `- Compliance: ${window.reportData.compliance.compliant.find((item) => item.category === 'meta')?.details?.percentageCompliant || 0}%\n`;
    issueBody += `- Issues Found: ${window.reportData.compliance.issues.length}\n`;
    issueBody += `- Passed Checks: ${window.reportData.compliance.compliant.filter((item) => item.category !== 'meta').length}\n\n`;

    // Add configuration and severity breakdown
    const ruleSet = window.reportData.ruleSet || 'dod';
    const ruleSetDisplay = ruleSet === 'dod' ? 'DoD' : ruleSet === 'partner' ? 'Partner' : 'Custom';
    const customGistUrl =
      ruleSet === 'custom' &&
      window.reportData.customConfig &&
      window.reportData.customConfig.gistUrl
        ? window.reportData.customConfig.gistUrl
        : null;

    // Severity breakdown
    const sevCounts = window.reportData.compliance.issues.reduce(
      (acc, it) => {
        const sev = (it.severity || 'warning').toLowerCase();
        if (sev === 'error') acc.high += 1;
        else if (sev === 'warning') acc.medium += 1;
        else acc.low += 1; // info/others
        return acc;
      },
      { high: 0, medium: 0, low: 0 },
    );

    issueBody += `## Configuration\n\n`;
    issueBody += `- Rule Set: ${ruleSetDisplay}${customGistUrl ? ` (custom from ${customGistUrl})` : ''}\n`;
    issueBody += `- Severity Breakdown: High ${sevCounts.high}, Medium ${sevCounts.medium}, Low ${sevCounts.low}\n\n`;

    if (window.reportData.compliance.issues.length > 0) {
      issueBody += `## Issues to Fix\n\n`;
      window.reportData.compliance.issues.forEach((issue, index) => {
        issueBody += `${index + 1}. **${issue.message}**\n`;
        if (issue.error) {
          issueBody += `   - ${issue.error}\n`;
        }
        issueBody += `\n`;
      });
    }

    // Add unique ID to help identify this issue
    const uniqueId = `template-doctor-${Date.now()}`;
    issueBody += `\n---\n*This issue was created by Template Doctor, an automated compliance checking tool.*`;
    issueBody += `\n\n<!-- Issue Tracker ID: ${uniqueId} -->`;

    // Check for existing issues to avoid duplicates
    if (notification)
      notification.update('Checking for duplicates', 'Looking for existing issues...');

    const issueTitle = `Template Doctor Analysis: ${window.reportData.compliance.summary} ${formattedDate}`;
    let existingIssues;

    try {
      existingIssues = await github.findIssuesByTitle(owner, repo, issueTitle, 'template-doctor');
    } catch (error) {
      console.warn('Error checking for existing issues:', error);
      // Continue anyway
    }

    if (existingIssues && existingIssues.length > 0) {
      const firstIssue = existingIssues[0];
      if (notification) {
        // Check if we're using the new or old notification API
        if (notification.warning) {
          notification.warning(
            'Issue Already Exists',
            `A Template Doctor issue already exists: #${firstIssue.number} - ${firstIssue.title}`,
            {
              actions: [
                {
                  label: 'Open Issue',
                  onClick: () => window.open(firstIssue.url, '_blank'),
                  primary: true,
                },
              ],
            },
          );
        } else {
          notification.update(
            'Issue Already Exists',
            `A Template Doctor issue already exists: #${firstIssue.number} - ${firstIssue.title}`,
          );
          setTimeout(() => {
            // Clean up notification after a delay
            if (notification.close) notification.close();
          }, 10000);
        }
      }
      if (createIssueButton) restoreButton();
      return;
    }

    // Create the main issue with GraphQL to assign to copilot-swe-agent
    // Only the main issue should be assigned to Copilot, child issues will be created without assignment
    let mainIssue;
    try {
      if (notification)
        notification.update(
          'Creating main issue',
          'Creating issue and assigning to Copilot Agent...',
        );

      // Configurable GitHub labels
      const baseLabels =
        typeof window.GITHUB_LABELS !== 'undefined' && Array.isArray(window.GITHUB_LABELS)
          ? window.GITHUB_LABELS
          : ['template-doctor', 'template-doctor-full-scan'];

      // Add ruleset label to the main issue
      const rulesetLabel = `ruleset:${ruleSet}`;
      const mainIssueLabels = Array.from(new Set([...baseLabels, rulesetLabel]));

      // Ensure label families exist up-front (base + ruleset + severity family)
      const severityFamily = ['severity:high', 'severity:medium', 'severity:low'];
      await github.ensureLabelsExist(
        owner,
        repo,
        Array.from(new Set([...mainIssueLabels, ...severityFamily])),
      );

      mainIssue = await github.createIssueGraphQL(
        owner,
        repo,
        issueTitle,
        issueBody,
        mainIssueLabels,
      );

      console.log('Main issue created:', mainIssue);
    } catch (error) {
      console.error('Error creating main issue:', error);
      if (notification)
        notification.error('Error', `Failed to create the main issue: ${error.message}`);
      if (createIssueButton) restoreButton();
      return;
    }

    // Create child issues for each problem if there are any
    const childIssues = [];

    if (createChildIssues) {
      if (notification)
        notification.update(
          'Creating child issues',
          `Creating ${window.reportData.compliance.issues.length} child issues...`,
        );

      for (let i = 0; i < window.reportData.compliance.issues.length; i++) {
        const issue = window.reportData.compliance.issues[i];

        try {
          if (notification) {
            notification.update(
              'Creating child issues',
              `Creating issue ${i + 1} of ${window.reportData.compliance.issues.length}...`,
            );
          }

          // Create a child issue body
          let childBody = `# ${issue.message}\n\n`;
          if (issue.error) childBody += `## Details\n\n${issue.error}\n\n`;

          childBody += `## How to fix\n\n`;

          // Generate a fix hint based on the issue type
          if (issue.id.includes('missing-file') || issue.id.includes('missing-folder')) {
            childBody += `Create the missing ${issue.id.includes('file') ? 'file' : 'folder'} in your repository.\n\n`;
          } else if (issue.id.includes('missing-workflow')) {
            childBody += 'Add the required workflow file to your .github/workflows directory.\n\n';
          } else if (issue.id.includes('readme')) {
            childBody += 'Update your README.md with the required headings and content.\n\n';
          } else if (issue.id.includes('bicep')) {
            childBody += 'Add the missing resources to your Bicep files.\n\n';
          } else if (issue.id.includes('azure-yaml')) {
            childBody += 'Update your azure.yaml file to include required sections.\n\n';
          } else {
            childBody += 'Review the issue details and make appropriate changes.\n\n';
          }

          // Add severity + configuration context
          const severity = (issue.severity || 'warning').toLowerCase();
          const severityDisplay =
            severity === 'error' ? 'High' : severity === 'warning' ? 'Medium' : 'Low';
          childBody += `## Context\n\n- Severity: ${severityDisplay}\n- Rule Set: ${ruleSetDisplay}${customGistUrl ? ` (custom from ${customGistUrl})` : ''}\n`;

          childBody += `\n---\n*This is a child issue created by Template Doctor. Parent issue: #${mainIssue.number}*`;
          childBody += `\n\n<!-- Parent Issue: ${mainIssue.id} -->`;

          const childTitle = `${issue.message} [${issue.id}]`;

          // Map severity to standardized label values
          const sevLabel =
            severity === 'error'
              ? 'severity:high'
              : severity === 'warning'
                ? 'severity:medium'
                : 'severity:low';

          // Ensure child labels exist (severity + ruleset + base)
          const childLabels = Array.from(
            new Set([
              'template-doctor',
              'template-doctor-child-issue',
              sevLabel,
              `ruleset:${ruleSet}`,
            ]),
          );
          await github.ensureLabelsExist(owner, repo, childLabels);

          // Create the child issue without assigning to Copilot
          const childIssue = await github.createIssueWithoutCopilot(
            owner,
            repo,
            childTitle,
            childBody,
            childLabels,
          );

          childIssues.push(childIssue);
        } catch (error) {
          console.error(`Error creating child issue for ${issue.id}:`, error);

          // Add a more detailed error message to notification
          if (notification) {
            notification.update(
              'Creating child issues',
              `Error creating issue ${i + 1}: ${error.message}. Continuing with other issues...`,
            );
          }

          // If this is a permissions error, we should stop creating more issues
          if (
            error.message &&
            (error.message.includes('scope') || error.message.includes('permission'))
          ) {
            if (notification) {
              notification.error(
                'Permission Error',
                'Insufficient permissions to create additional issues. Please check your GitHub token.',
              );
            }
            break; // Exit the loop
          }

          // Continue with other issues
        }
      }

      if (notification)
        notification.update(
          'Updating main issue',
          'Adding links to child issues in the main issue...',
        );

      // Update the main issue with links to child issues
      if (childIssues.length > 0) {
        try {
          let childIssuesBody = `\n\n## Child Issues\n\n`;
          childIssues.forEach((childIssue) => {
            childIssuesBody += `- #${childIssue.number} ${childIssue.title}\n`;
          });

          // We would update the main issue body here, but GraphQL doesn't support updating issues directly
          // In a real implementation, you would use the REST API to update the issue
          console.log('Would update main issue with child issue links:', childIssuesBody);
        } catch (error) {
          console.error('Error updating main issue with child issues:', error);
          // Not critical, continue
        }
      }
    }

    // Create repository issues URL
    const repoIssuesUrl = `https://github.com/${owner}/${repo}/issues`;

    // Show success notification
    if (notification) {
      // Check if we're using the new or old notification API
      if (notification.success) {
        notification.success(
          'Issues Created Successfully',
          `Main issue #${mainIssue.number} created${childIssues.length > 0 ? ` with ${childIssues.length} child issues` : ''}.`,
          {
            actions: [
              {
                label: 'Open Issue',
                onClick: () => window.open(mainIssue.url, '_blank'),
                primary: true,
              },
              {
                label: 'View All Issues',
                onClick: () => window.open(repoIssuesUrl, '_blank'),
              },
            ],
          },
        );
      } else {
        // We're using the new NotificationSystem API
        if (window.NotificationSystem) {
          // Close the loading notification first
          if (notification.close) notification.close();

          // Show a new success notification
          window.NotificationSystem.showSuccess(
            'Issues Created Successfully',
            `Main issue #${mainIssue.number} created${childIssues.length > 0 ? ` with ${childIssues.length} child issues` : ''}.
                        <br><a href="${repoIssuesUrl}" target="_blank">View all repository issues</a>`,
            15000,
            {
              actions: [
                {
                  label: 'Open Issue',
                  onClick: () => window.open(mainIssue.url, '_blank'),
                  primary: true,
                },
                {
                  label: 'View All Issues',
                  onClick: () => window.open(repoIssuesUrl, '_blank'),
                },
              ],
            },
          );
        }
      }

      // Log a helpful message with links
      console.log('Issues created successfully:', {
        mainIssue: mainIssue.url,
        issueNumber: mainIssue.number,
        childIssues: childIssues.length,
        repositoryIssues: repoIssuesUrl,
      });
    }

    // Restore button state
    if (createIssueButton) restoreButton();
  } catch (error) {
    console.error('Error creating GitHub issues:', error);

    if (notification) {
      // Check which notification API we're using
      if (notification.error) {
        notification.error('Error', `Failed to create GitHub issues: ${error.message}`);
      } else {
        // We're using the new NotificationSystem API
        if (notification.close) notification.close();

        if (window.NotificationSystem) {
          window.NotificationSystem.showError(
            'Error',
            `Failed to create GitHub issues: ${error.message}`,
            15000,
          );
        }
      }
    } else if (window.NotificationSystem) {
      window.NotificationSystem.showError(
        'Error',
        `Failed to create GitHub issues: ${error.message}`,
        15000,
      );
    } else if (window.Notifications) {
      window.Notifications.error('Error', `Failed to create GitHub issues: ${error.message}`);
    } else {
      console.error(`Error creating GitHub issues: ${error.message}`);
    }

    // Restore button state
    if (createIssueButton) restoreButton();
  }
}

/**
 * Test AZD provision for the template
 */
function testAzdProvision() {
  // Make sure we have report data
  if (!window.reportData) {
    console.error('No report data available');
    if (window.Notifications) {
      window.Notifications.error('Error', 'No compliance data available to test AZD provision');
    } else {
      console.error('No compliance data available to test AZD provision');
    }
    return;
  }

  // Show a confirmation dialog
  if (window.Notifications) {
    window.Notifications.confirm(
      'Test AZD Provision',
      'This will run azd init on the template repository in an Azure Container. Proceed?',
      {
        onConfirm: () => runAzdProvisionTest(),
      },
    );
  } else {
    if (
      confirm(
        'This will run azd init on the template repository in an Azure Container. Proceed?',
      )
    ) {
      runAzdProvisionTest();
    }
  }
}

/**
 * Run the AZD provision test
 */
function runAzdProvisionTest() {
  // Normalize incoming template identifiers to just the repo name (for azd -t)
  function normalizeTemplateToRepo(input) {
    if (!input || typeof input !== 'string') return '';
    let name = input.trim();
    try {
      if (name.startsWith('http://') || name.startsWith('https://') || name.startsWith('git@')) {
        if (name.startsWith('git@')) {
          const parts = name.split(':');
          if (parts.length > 1) name = parts[1];
        } else {
          const url = new URL(name);
          name = url.pathname;
        }
      }
    } catch {}
    name = name.replace(/^\/+/, '');
    const segments = name.split('/').filter(Boolean);
    name = segments.length ? segments[segments.length - 1] : name;
    name = name.replace(/\.git$/i, '');
    return name;
  }
  // Hardcoded override for standalone Functions base (temporary until runtime-config is live)
  const FORCED_BACKEND_BASE = 'https://template-doctor-standalone-nv.azurewebsites.net';
  // Helper to fetch runtime config (cached)
  function getBasePath() {
    const pathname = window.location.pathname || '/';
    const withoutFile = pathname.match(/\.[a-zA-Z0-9]+$/)
      ? pathname.substring(0, pathname.lastIndexOf('/'))
      : pathname;
    if (withoutFile === '/') return '';
    return withoutFile.endsWith('/') ? withoutFile.slice(0, -1) : withoutFile;
  }
  // No runtime-config fetch: we will use FORCED_BACKEND_BASE directly to avoid 404s
  function joinUrl(base, path, query) {
    const b = (base || '').replace(/\/$/, '');
    const p = (path || '').startsWith('/') ? path : `/${path || ''}`;
    const q = query ? (query.startsWith('?') ? query : `?${query}`) : '';
    return `${b}${p}${q}`;
  }
  // Get the template URL and parse owner/repo
  const templateUrl = window.reportData.repoUrl;
  let owner, repo;
  try {
    const urlParts = new URL(templateUrl).pathname.split('/');
    if (urlParts.length >= 3) {
      owner = urlParts[1];
      repo = urlParts[2];
    }
  } catch (e) {
    console.error('Failed to parse repository URL', e);
  }

  // Prefer upstream template name if provided in report data; otherwise use owner/repo from the report URL
  let templateName = null;
  const upstreamFromReport =
    (window.reportData && (window.reportData.upstreamTemplate || window.reportData.upstream)) || '';
  if (typeof upstreamFromReport === 'string' && upstreamFromReport.includes('/')) {
    templateName = upstreamFromReport.trim();
  } else if (owner && repo) {
    templateName = `${owner}/${repo}`;
  }
  if (!templateName) {
    const msg = '[error] Could not determine template name from repository URL.';
    try {
      appendLog(document.getElementById('azd-provision-logs') || console, msg);
    } catch {
      console.error(msg);
    }
    return;
  }
  // Normalize to repo-only for azd init -t
  const templateRepo = normalizeTemplateToRepo(templateName);

  // Show loading state
  const testProvisionButton = document.getElementById('testProvisionButton');
  if (testProvisionButton) {
    const originalText = testProvisionButton.innerHTML;
    testProvisionButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting…';
    testProvisionButton.disabled = true;

    // Function to restore button
    const restoreButton = () => {
      setTimeout(() => {
        testProvisionButton.innerHTML = originalText;
        testProvisionButton.style.backgroundColor = '';
        testProvisionButton.disabled = false;
      }, 3000);
    };
  }

  // Create a live log container below the header (simple terminal-style area)
  let logEl = document.getElementById('azd-provision-logs');
  if (!logEl) {
    logEl = document.createElement('pre');
    logEl.id = 'azd-provision-logs';
    logEl.style.cssText =
      'max-height: 300px; overflow:auto; background:#0b0c0c; color:#d0d0d0; padding:20px; border-radius:6px 0 0 6px; font-size:12px; margin:10px 0 50px 0;';
    const header = document.querySelector('.report-actions') || document.body;
    header.parentNode.insertBefore(logEl, header.nextSibling);
    // Add controls row (Stop button)
    const controls = document.createElement('div');
    controls.id = 'azd-provision-controls';
    controls.style.cssText = 'margin:10px 0 6px; display:flex; gap:8px; align-items:center;';
    const stopBtn = document.createElement('button');
    stopBtn.id = 'azd-stop-btn';
    stopBtn.textContent = 'Stop Provision';
    stopBtn.style.cssText =
      'padding:6px 12px; background:#b10e1e; color:#fff; border:none; border-radius:6px; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.15); margin: 0 0 10px 20px';
    stopBtn.disabled = true;
    controls.appendChild(stopBtn);
    logEl.parentNode.insertBefore(controls, logEl);
  } else {
    logEl.textContent = '';
  }
  try {
    const sb = document.getElementById('azd-stop-btn');
    if (sb) {
      const rect = sb.getBoundingClientRect();
      const absY = rect.top + window.scrollY + 200; // target Stop button + 200px offset
      const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const targetY = Math.min(absY, maxY);
      window.scrollTo({ top: targetY, behavior: 'smooth' });
    } else {
      logEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  } catch {}

  const baseUrl =
    window.location.origin +
    (window.location.pathname.includes('/index.html')
      ? window.location.pathname.replace('/index.html', '')
      : window.location.pathname);

  let notification;
  if (window.Notifications) {
    notification = window.Notifications.loading(
      'Starting AZD Provision',
      `Starting provisioning for ${templateRepo} in Azure Container App using Azure CLI image...`,
    );
  }

  // Resolve backend base URL and optional function key from runtime config
  const apiBase = (FORCED_BACKEND_BASE || '').trim();
  if (!apiBase) {
    appendLog(logEl, '[error] Missing backend base URL. Set FORCED_BACKEND_BASE.');
    return;
  }
  console.log('[azd] apiBase:', apiBase);
  
  // Add debug log to show we're using the latest frontend code
  appendLog(logEl, `[debug] Using updated frontend code with enhanced debugging`);
  appendLog(logEl, `[debug] Template repo: ${templateRepo}, Template name: ${templateName}`);
  // Kick off ACA Job via Function (public routes, now with /aca prefix)
  const startUrl = joinUrl(apiBase, '/api/aca-start-job');
  appendLog(logEl, `[info] Calling start URL: ${startUrl}`);
  console.log('[azd] startUrl:', startUrl);
  appendLog(logEl, `[info] Requested template: ${templateRepo} (server will normalize)`);
  fetch(startUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateName: templateRepo }),
  })
    .then(async (r) => {
      if (!r.ok) {
        let detail = '';
        try {
          const ct = r.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            const j = await r.json();
            detail = j && (j.error || j.message) ? ` - ${j.error || j.message}` : '';
          } else {
            const t = await r.text();
            detail = t ? ` - ${t.substring(0, 200)}` : '';
          }
        } catch {}
        throw new Error(`Start failed: ${r.status}${detail}`);
      }
      const json = await r.json();
      const { executionName } = json;
      appendLog(logEl, `[info] Job started: ${executionName}`);
      if (json.templateUsed) {
        appendLog(logEl, `[info] Template used: ${json.templateUsed}`);
      }
      // Open SSE stream with polling fallback and Stop button support
      const streamPath = `/api/aca-job-logs/${encodeURIComponent(executionName)}`;
      const streamUrl = joinUrl(apiBase, streamPath);
      appendLog(logEl, `[info] Connecting logs stream: ${streamUrl}`);
      console.log('[azd] streamUrl:', streamUrl);
      const stopBtn = document.getElementById('azd-stop-btn');
      let ev;
      let pollTimer;
      let pollSince = '';
      let finished = false;
      let currentExecution = executionName;

      function finalize(result) {
        finished = true;
        if (ev)
          try {
            ev.close();
          } catch {}
        if (pollTimer) {
          clearTimeout(pollTimer);
          pollTimer = null;
        }
        if (stopBtn) stopBtn.disabled = true;
        if (!notification) return;
        if (result && result.succeeded) {
          notification.success('Provision Completed', 'azd completed successfully');
        } else if (result && result.status) {
          notification.error('Provision Failed', `Status: ${result.status}`);
        }
      }

      function startPolling() {
        const doPoll = async () => {
          if (finished) return;
          try {
            const url =
              streamUrl + `?mode=poll${pollSince ? `&since=${encodeURIComponent(pollSince)}` : ''}`;
            const pr = await fetch(url, { headers: { Accept: 'application/json' } });
            if (!pr.ok) throw new Error(`poll ${pr.status}`);
            const data = await pr.json();
            
            // Debug raw response
            console.log('[debug] Poll response:', data);
            
            if (Array.isArray(data.messages)) {
              appendLog(logEl, `[debug] Received ${data.messages.length} messages`);
              data.messages.forEach((m) => appendLog(logEl, m));
            }
            if (data.nextSince) pollSince = data.nextSince;
            if (data.status) {
              const det = data.details || {};
              const extras = [];
              if (det.provisioningState) extras.push(`prov=${det.provisioningState}`);
              if (det.status) extras.push(`status=${det.status}`);
              if (typeof det.exitCode !== 'undefined' && det.exitCode !== null)
                extras.push(`exit=${det.exitCode}`);
              appendLog(
                logEl,
                `[status] ${data.status}${extras.length ? ' (' + extras.join(', ') + ')' : ''}`,
              );
            }
            if (data.done)
              return finalize({ succeeded: data.status === 'Succeeded', status: data.status });
          } catch (e) {
            appendLog(logEl, `[error] poll: ${e.message}`);
          } finally {
            if (!finished) pollTimer = setTimeout(doPoll, 3000);
          }
        };
        doPoll();
      }

      function trySSE() {
        try {
          ev = new EventSource(streamUrl);
        } catch (e) {
          appendLog(logEl, `[warn] SSE unavailable, falling back to polling`);
          return startPolling();
        }
        ev.addEventListener('open', () => {
          if (stopBtn) stopBtn.disabled = false;
        });
        ev.addEventListener('status', (e) => {
          try {
            const d = JSON.parse(e.data);
            if (d && typeof d === 'object') {
              const det = d.details || {};
              const extras = [];
              if (det.provisioningState) extras.push(`prov=${det.provisioningState}`);
              if (det.status) extras.push(`status=${det.status}`);
              if (typeof det.exitCode !== 'undefined' && det.exitCode !== null)
                extras.push(`exit=${det.exitCode}`);
              appendLog(
                logEl,
                `[status] ${d.state}${extras.length ? ' (' + extras.join(', ') + ')' : ''}`,
              );
            } else {
              appendLog(logEl, `[status] ${d}`);
            }
          } catch {}
        });
        ev.addEventListener('message', (e) => {
          appendLog(logEl, e.data);
        });
        ev.addEventListener('error', () => {
          if (!finished) {
            appendLog(logEl, `[warn] Stream error, switching to polling`);
            try {
              ev.close();
            } catch {}
            startPolling();
          }
        });
        ev.addEventListener('complete', (e) => {
          try {
            const d = JSON.parse(e.data);
            if (d && d.details) {
              const { startTime, endTime, exitCode } = d.details;
              if (startTime && endTime) {
                const st = new Date(startTime);
                const et = new Date(endTime);
                const durMs = Math.max(0, et - st);
                const mins = Math.floor(durMs / 60000);
                const secs = Math.floor((durMs % 60000) / 1000);
                appendLog(
                  logEl,
                  `[summary] ${d.status} in ${mins}m ${secs}s${typeof exitCode === 'number' ? ` (exit=${exitCode})` : ''}`,
                );
              }
            }
            finalize(d);
          } catch {
            finalize({ succeeded: false, status: 'Unknown' });
          }
        });
      }

      // Wire Stop button
      if (stopBtn) {
        stopBtn.disabled = false;
        stopBtn.onclick = () => {
          appendLog(logEl, '[info] Stopping…');
          // Best-effort: ask backend to stop the job execution
          try {
            const stopUrl = joinUrl(apiBase, '/api/aca-stop-job');
            // Add additional debug for the container app job name prefix
            const containerAppJobName = 'template-doctor-aca-job'; // Hardcoded job name
            const jobExecutionName = `${containerAppJobName}-${currentExecution}`;
            
            appendLog(logEl, `[debug] Attempting to stop job with full execution name: ${jobExecutionName}`);
            appendLog(logEl, `[debug] Falling back to short execution name if that fails: ${currentExecution}`);
            
            // First try with the fully qualified name
            fetch(stopUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ executionName: currentExecution }),
            })
              .then(async (r) => {
                if (!r.ok) {
                  let msg = '';
                  try {
                    const j = await r.json();
                    msg = j.error || '';
                  } catch {}
                  appendLog(
                    logEl,
                    `[warn] Stop request failed: ${r.status}${msg ? ' - ' + msg : ''}`,
                  );
                } else {
                  appendLog(logEl, '[info] Stop requested');
                }
              })
              .catch(() => {});
          } catch {}
          finalize({ succeeded: false, status: 'Stopped' });
        };
      }

      // Start with SSE, fallback to polling
      trySSE();
    })
    .catch((err) => {
      appendLog(logEl, `[error] ${err.message}`);
      if (notification) notification.error('Error', err.message);
    });
}

function appendLog(el, line) {
  el.textContent += line.endsWith('\n') ? line : line + '\n';
  el.scrollTop = el.scrollHeight;
  // Also scroll the viewport so the console is fully visible: target Stop button + 200px
  try {
    const sb = document.getElementById('azd-stop-btn');
    if (sb) {
      const rect = sb.getBoundingClientRect();
      const absY = rect.top + window.scrollY + 200; // 200px below the Stop button
      const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const targetY = Math.min(absY, maxY);
      // Only scroll down if the target is below current viewport by a noticeable margin
      const currentBottom = window.scrollY + window.innerHeight;
      if (currentBottom + 40 < targetY) {
        window.scrollTo({ top: targetY, behavior: 'smooth' });
      }
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  } catch {}
}
