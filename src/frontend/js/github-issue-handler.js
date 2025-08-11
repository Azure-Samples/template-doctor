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
      const GITHUB_LABELS =
        typeof window.GITHUB_LABELS !== 'undefined' && Array.isArray(window.GITHUB_LABELS)
          ? window.GITHUB_LABELS
          : ['template-doctor', 'template-doctor-full-scan'];

      mainIssue = await github.createIssueGraphQL(
        owner,
        repo,
        issueTitle,
        issueBody,
        GITHUB_LABELS,
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

          childBody += `\n---\n*This is a child issue created by Template Doctor. Parent issue: #${mainIssue.number}*`;
          childBody += `\n\n<!-- Parent Issue: ${mainIssue.id} -->`;

          const childTitle = `${issue.message} [${issue.id}]`;

          // Create the child issue without assigning to Copilot
          const childIssue = await github.createIssueWithoutCopilot(
            owner,
            repo,
            childTitle,
            childBody,
            ['template-doctor', 'template-doctor-child-issue'],
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
      'This will test AZD provisioning for the template. Since this is a frontend-only implementation, this will be simulated. Proceed?',
      {
        onConfirm: () => runAzdProvisionTest(),
      },
    );
  } else {
    if (
      confirm(
        'This would test AZD provisioning for the template. Since this is a frontend-only implementation, this will be simulated. Proceed?',
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
  // Get the template URL
  const templateUrl = window.reportData.repoUrl;

  // Parse the owner and repo from the URL
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

  // Show loading state
  const testProvisionButton = document.getElementById('testProvisionButton');
  if (testProvisionButton) {
    const originalText = testProvisionButton.innerHTML;
    testProvisionButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting Test...';
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

  // Simulate the AZD provision test
  const runId = Math.random().toString(36).substring(2, 15);

  // Create a loading notification
  let notification;
  if (window.Notifications) {
    notification = window.Notifications.loading(
      'Starting AZD Provision Test',
      `Preparing to test provisioning for template: ${owner}/${repo}`,
    );
  }

  // Simulate provisioning steps with progress updates
  const steps = [
    { message: 'Initializing AZD environment...', duration: 1500 },
    { message: 'Validating template structure...', duration: 2000 },
    { message: 'Processing azure.yaml configuration...', duration: 1500 },
    { message: 'Checking Bicep files...', duration: 2000 },
    { message: 'Validating ARM templates...', duration: 2500 },
    { message: 'Deploying infrastructure...', duration: 3000 },
    { message: 'Setting up resources...', duration: 2500 },
    { message: 'Configuring dependencies...', duration: 2000 },
    { message: 'Finalizing deployment...', duration: 1500 },
  ];

  let currentStep = 0;

  const runStep = () => {
    if (currentStep >= steps.length) {
      // Provisioning complete
      // Simulate random success/failure
      const success = Math.random() > 0.3; // 70% chance of success

      if (success) {
        if (notification) {
          notification.success(
            'Provision Completed Successfully',
            'The template was successfully provisioned in the simulated environment.',
            {
              actions: [
                {
                  label: 'View Details',
                  onClick: () => {
                    window.Notifications.info(
                      'Provision Details',
                      `<strong>Run ID:</strong> ${runId}<br>
                                            <strong>Template:</strong> ${owner}/${repo}<br>
                                            <strong>Duration:</strong> ${Math.floor(steps.reduce((acc, step) => acc + step.duration, 0) / 1000)} seconds<br>
                                            <strong>Resources:</strong> 12 deployed<br>
                                            <strong>Status:</strong> Success`,
                      10000,
                    );
                  },
                  primary: true,
                },
              ],
            },
          );
        }

        if (testProvisionButton) {
          testProvisionButton.innerHTML = '<i class="fas fa-check"></i> Provision Completed';
          testProvisionButton.style.backgroundColor = '#107c10'; // Success green
          restoreButton();
        }
      } else {
        const errorDetails = [
          'Missing required resource provider registration',
          'Invalid parameter values in main.bicep',
          'Resource naming conflicts in target subscription',
          'Insufficient permissions for service principal',
          'Quota limits exceeded in target region',
        ];

        const randomError = errorDetails[Math.floor(Math.random() * errorDetails.length)];

        if (notification) {
          notification.error(
            'Provision Failed',
            `The template provisioning failed:<br><br><code>${randomError}</code><br><br>Check the template's infrastructure files and try again.`,
            {
              actions: [
                {
                  label: 'View Logs',
                  onClick: () => {
                    window.Notifications.info(
                      'Provision Logs',
                      `<pre style="max-height: 300px; overflow: auto; background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px;">
[error] Failed to provision resource: ${randomError}
[info] Template: ${owner}/${repo}
[info] Run ID: ${runId}
[error] Error code: AZD4001
[debug] See full log at /tmp/azd-${runId}.log
</pre>`,
                      0, // No auto-close
                    );
                  },
                  primary: true,
                },
              ],
            },
          );
        }

        if (testProvisionButton) {
          testProvisionButton.innerHTML = '<i class="fas fa-times"></i> Provision Failed';
          testProvisionButton.style.backgroundColor = '#d83b01'; // Error color
          restoreButton();
        }
      }
      return;
    }

    const step = steps[currentStep];

    if (notification) {
      const progress = Math.floor(((currentStep + 1) / steps.length) * 100);
      notification.update(`Provisioning (${progress}%)`, step.message);
    }

    if (testProvisionButton) {
      const progress = Math.floor(((currentStep + 1) / steps.length) * 100);
      testProvisionButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Running (${progress}%)`;
    }

    currentStep++;

    // Run next step after the current step's duration
    setTimeout(runStep, step.duration);
  };

  // Start the first step
  setTimeout(runStep, 1000);
}
