// Test script for the fork workflow functionality
(function () {
  'use strict';

  // Test the fork workflow when DOM is loaded
  document.addEventListener('DOMContentLoaded', function () {
    console.log('Fork workflow test script loaded');

    // Create a test button
    const testButton = document.createElement('button');
    testButton.textContent = 'Test Fork Workflow';
    testButton.style.position = 'fixed';
    testButton.style.bottom = '10px';
    testButton.style.right = '10px';
    testButton.style.padding = '10px';
    testButton.style.backgroundColor = '#0078d4';
    testButton.style.color = 'white';
    testButton.style.border = 'none';
    testButton.style.borderRadius = '4px';
    testButton.style.cursor = 'pointer';
    testButton.style.zIndex = '9999';

    // Add event listener
    testButton.addEventListener('click', testForkWorkflow);

    // Add to body
    document.body.appendChild(testButton);

    // Test fork functionality
    async function testForkWorkflow() {
      // Make sure GitHub client is available and user is authenticated
      if (!window.GitHubClient || !window.GitHubClient.auth.isAuthenticated()) {
        alert('Please sign in to GitHub first');
        return;
      }

      // Get current user
      const currentUsername = window.GitHubClient.auth.getUsername();
      console.log('Current user:', currentUsername);

      // Test repository (a public repo that's not likely to be owned by the current user)
      const testRepoOwner = 'microsoft';
      const testRepo = 'vscode';

      try {
        // Test check for fork
        console.log(`Checking if ${currentUsername} has forked ${testRepoOwner}/${testRepo}...`);
        const hasFork = await window.GitHubClient.checkUserHasFork(testRepoOwner, testRepo);

        if (hasFork) {
          console.log('Fork exists:', hasFork);

          // Test check if fork is up to date
          console.log('Checking if fork is up to date...');
          const isUpToDate = await window.GitHubClient.isForkUpToDate(currentUsername, testRepo);
          console.log('Is fork up to date:', isUpToDate);

          // Show appropriate notification
          if (isUpToDate) {
            window.NotificationSystem.showSuccess(
              'Fork Status',
              `Your fork of ${testRepoOwner}/${testRepo} is up to date.`,
              5000,
            );
          } else {
            window.NotificationSystem.showAction(
              'Fork Out of Date',
              `Your fork of ${testRepoOwner}/${testRepo} needs to be updated.`,
              [
                {
                  label: 'Update Fork',
                  primary: true,
                  callback: async () => {
                    try {
                      const updateResult = await window.GitHubClient.updateFork(
                        currentUsername,
                        testRepo,
                      );
                      console.log('Update result:', updateResult);
                      window.NotificationSystem.showSuccess(
                        'Fork Updated',
                        'Your fork has been updated successfully!',
                        3000,
                      );
                    } catch (err) {
                      console.error('Error updating fork:', err);
                      window.NotificationSystem.showError(
                        'Update Failed',
                        `Failed to update fork: ${err.message}`,
                        5000,
                      );
                    }
                  },
                },
                {
                  label: 'Cancel',
                  primary: false,
                },
              ],
            );
          }
        } else {
          console.log('No fork exists');

          // Show create fork notification
          window.NotificationSystem.showAction(
            'Fork Required',
            `To proceed, you'll need to fork ${testRepoOwner}/${testRepo} to your account.`,
            [
              {
                label: 'Create Fork',
                primary: true,
                callback: async () => {
                  try {
                    console.log('Creating fork...');
                    const forkResult = await window.GitHubClient.forkRepository(
                      testRepoOwner,
                      testRepo,
                    );
                    console.log('Fork result:', forkResult);
                    window.NotificationSystem.showSuccess(
                      'Fork Created',
                      `Repository ${testRepoOwner}/${testRepo} has been forked successfully!`,
                      3000,
                    );
                  } catch (err) {
                    console.error('Error creating fork:', err);
                    window.NotificationSystem.showError(
                      'Fork Failed',
                      `Failed to create fork: ${err.message}`,
                      5000,
                    );
                  }
                },
              },
              {
                label: 'Cancel',
                primary: false,
              },
            ],
          );
        }
      } catch (err) {
        console.error('Test error:', err);
        alert(`Test failed: ${err.message}`);
      }
    }
  });
})();
