// GitHub Issue Handler for Template Doctor
// This file provides improved error handling for GitHub issue creation/management

/**
 * Creates a GitHub issue with better error handling for disabled issues
 * @param {string} url - API endpoint URL
 * @param {Object} data - Issue data to send
 * @param {function} onSuccess - Success callback
 * @param {function} onError - Error callback
 */
async function createGitHubIssue(url, data, onSuccess, onError) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
    
    // Handle non-200 responses
    if (!response.ok) {
      const errorData = await response.json();
      
      // Special handling for disabled issues (403 status)
      if (response.status === 403 && errorData.code === 'ISSUES_DISABLED') {
        const errorMessage = `
          <div class="error-box">
            <h4>⚠️ GitHub Issues are disabled</h4>
            <p>Issues are disabled for this repository. To enable issues:</p>
            <ol>
              <li>Go to the repository settings on GitHub</li>
              <li>Navigate to the "General" tab</li>
              <li>Scroll down to the "Features" section</li>
              <li>Check the "Issues" checkbox</li>
              <li>Click "Save" at the bottom of the page</li>
            </ol>
            <p>After enabling issues, try again.</p>
            <a href="${data.repoUrl}/settings" target="_blank" class="btn btn-primary">
              <i class="fas fa-cog"></i> Open Repository Settings
            </a>
          </div>
        `;
        
        onError(errorMessage, true); // Pass true to indicate this is HTML content
        return;
      }
      
      // For other errors, show the message
      throw new Error(errorData.error || 'Failed to create GitHub issue');
    }
    
    // Handle successful response
    const result = await response.json();
    onSuccess(result);
    
  } catch (error) {
    console.error('Error creating GitHub issue:', error);
    
    // Check if the error message mentions disabled issues
    if (error.message?.includes('Issues are disabled')) {
      const errorMessage = `
        <div class="error-box">
          <h4>⚠️ GitHub Issues are disabled</h4>
          <p>Issues are disabled for this repository. To enable issues:</p>
          <ol>
            <li>Go to the repository settings on GitHub</li>
            <li>Navigate to the "General" tab</li>
            <li>Scroll down to the "Features" section</li>
            <li>Check the "Issues" checkbox</li>
            <li>Click "Save" at the bottom of the page</li>
          </ol>
          <p>After enabling issues, try again.</p>
          <a href="${data.repoUrl}/settings" target="_blank" class="btn btn-primary">
            <i class="fas fa-cog"></i> Open Repository Settings
          </a>
        </div>
      `;
      
      onError(errorMessage, true); // Pass true to indicate this is HTML content
    } else {
      onError(error.message);
    }
  }
}

// Export for use in dashboard
window.templateDoctor = window.templateDoctor || {};
window.templateDoctor.github = {
  createIssue: createGitHubIssue
};
