/**
 * Helper script for manager demo - shows GitHub workflow validation in action
 * This script can be included after github-workflow-validation.js in your HTML
 * or executed in the browser console for demo purposes.
 */

// Demo function that runs the validation with successful results
function runGitHubWorkflowValidationDemo() {
  // Check if the validator component is loaded
  if (!window.GitHubWorkflowValidation) {
    console.error('GitHub Workflow Validation component not loaded!');
    return;
  }

  // Sample template URL - replace with an actual URL if needed
  const templateUrl = 'https://github.com/microsoft/vscode-azuretools-template';

  // Find an existing container or create one if needed
  let container = document.getElementById('githubWorkflowValidationContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'githubWorkflowValidationContainer';

    // Insert the container where appropriate
    const target = document.querySelector('.main-content') || document.body;
    target.appendChild(container);
  }

  // Initialize the validation component in demo mode
  window.GitHubWorkflowValidation.runDemo(
    'githubWorkflowValidationContainer',
    templateUrl,
    (status) => {
      console.log('Validation status update:', status);
    },
  );

  console.log('Demo validation started - showing successful results in 4 seconds');
}

// Auto-run the demo if the githubWorkflowValidationContainer element exists
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('githubWorkflowValidationContainer');
  if (container) {
    console.log('Auto-starting GitHub workflow validation demo');
    setTimeout(runGitHubWorkflowValidationDemo, 500);
  }
});

// Export the demo function globally
window.runGitHubWorkflowValidationDemo = runGitHubWorkflowValidationDemo;
