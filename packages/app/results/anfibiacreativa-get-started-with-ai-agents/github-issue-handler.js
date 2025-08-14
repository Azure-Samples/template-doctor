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
      // Always parse the error response to get the proper GitHub error message
      const errorData = await response.json();
      console.log("GitHub API Error Response:", errorData);
      
      // Special handling for disabled issues (403 or 410 status)
      if ((response.status === 403 || response.status === 410 || 
           parseInt(errorData.status) === 403 || parseInt(errorData.status) === 410) && 
          (errorData.code === 'ISSUES_DISABLED' || 
           errorData.message === 'Issues are disabled for this repo')) {
        
        // Get the original GitHub error message
        const githubMessage = errorData.message || 'Issues are disabled for this repository';
        const docUrl = errorData.documentation_url || 'https://docs.github.com/v3/issues/';
        // Ensure status code is an integer, and defaults to response.status if not available
        const statusCode = parseInt(errorData.status) || response.status;
        
        const errorMessage = `
          <div class="error-box">
            <h4>⚠️ GitHub API Error (${statusCode})</h4>
            <p><strong>Error message from GitHub:</strong> ${githubMessage}</p>
            <p><strong>Documentation:</strong> <a href="${docUrl}" target="_blank">${docUrl}</a></p>
            <p>To enable issues for this repository:</p>
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
      
      // For other errors, show the detailed message from GitHub API response
      // This ensures we show the actual error message, not a generic one
      const errorMsg = errorData.message || errorData.error || `Network response was not ok: ${response.status}`;
      
      // For 500 errors, create a formatted error message with more detail
      if (response.status === 500) {
        const formattedError = `
          <div class="error-box">
            <h4>⚠️ Server Error (${response.status})</h4>
            <p><strong>Error message:</strong> ${errorMsg}</p>
            <p>The server encountered an error while processing your request. This might be a temporary issue.</p>
            <p>Please try again later or contact the repository administrator if the problem persists.</p>
          </div>
        `;
        onError(formattedError, true); // Pass true to indicate this is HTML content
        return;
      }
      
      throw new Error(errorMsg);
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
      // For all other errors, create a more user-friendly error message
      const formattedError = `
        <div class="error-box">
          <h4>⚠️ Error Creating GitHub Issue</h4>
          <p><strong>Error message:</strong> ${error.message}</p>
          <p>There was a problem creating the GitHub issue. This might be due to:</p>
          <ul>
            <li>Network connectivity issues</li>
            <li>GitHub API rate limits</li>
            <li>Missing permissions for the repository</li>
            <li>Server-side errors</li>
          </ul>
          <p>Please try again later or check your repository permissions.</p>
        </div>
      `;
      onError(formattedError, true); // Always use HTML content for better user experience
    }
  }
}

// Export for use in dashboard
window.templateDoctor = window.templateDoctor || {};
window.templateDoctor.github = {
  createIssue: createGitHubIssue
};
