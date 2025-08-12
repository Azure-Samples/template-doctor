// Template Doctor - GitHub Action Hook
// Sends analysis results to GitHub to create a PR with the results

/**
 * Submits template analysis results to the GitHub repository
 * @param {Object} result - Analysis result from the analyzer
 * @param {string} username - GitHub username of the person who ran the analysis
 * @returns {Promise<Object>} - Response from GitHub API
 */
async function submitAnalysisToGitHub(result, username) {
  if (!result || !username) {
    console.error('Cannot submit analysis: missing required parameters');
    return { success: false, error: 'Missing parameters' };
  }

  try {
    // Log analysis data for debugging
    console.log('Analysis data being submitted:', {
      repoUrl: result.repoUrl,
      ruleSet: result.ruleSet,
      username,
      timestamp: result.timestamp,
      complianceStats: {
        percentage:
          result.compliance.compliant.find((c) => c.id === 'compliance-summary')?.details
            ?.percentageCompliant || 0,
        passed: result.compliance.compliant.length,
        issues: result.compliance.issues.length,
      },
    });

    // Extract necessary data from the result
    const payload = {
      repoUrl: result.repoUrl,
      ruleSet: result.ruleSet,
      username: username,
      timestamp: result.timestamp,
      analysisData: result,
      compliance: {
        percentage:
          result.compliance.compliant.find((c) => c.id === 'compliance-summary')?.details
            ?.percentageCompliant || 0,
        passed: result.compliance.compliant.length,
        issues: result.compliance.issues.length,
      },
    };

    // Get the API URL from configuration or default to the main repo
    const targetRepo = 'anfibiacreativa/template-doctor';
    const apiUrl =
      window.config?.githubActionWebhookUrl ||
      `https://api.github.com/repos/${targetRepo}/dispatches`;

    console.log(`Submitting to repository: ${targetRepo}`);
    console.log(`API URL: ${apiUrl}`);

    // Get the GitHub token
    const token = window.GitHubClient?.auth?.getToken();
    if (!token) {
      console.error('Cannot submit analysis: No GitHub token available');
      return {
        success: false,
        error:
          'No GitHub token available. Please ensure you are logged in with a GitHub account that has write access to the repository.',
        details:
          'The GitHub token is required to create a pull request with your analysis results.',
      };
    }

    // Make sure the token has proper permissions
    console.log('Using token with permissions:', {
      tokenAvailable: !!token,
      tokenLength: token ? token.length : 0,
    });

    // Make the API request
    console.log('Sending repository_dispatch event...');
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'template-analysis-completed',
        client_payload: payload,
      }),
    });

    console.log('GitHub API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Error response body:', errorData);

      // Provide more helpful error messages based on status code
      if (response.status === 404) {
        throw new Error(
          `Repository not found (404): The repository '${targetRepo}' either doesn't exist or you don't have access to it.`,
        );
      } else if (response.status === 403) {
        throw new Error(
          `Permission denied (403): Your GitHub token doesn't have permission to trigger workflows. Please check that your token has the 'repo' scope.`,
        );
      } else if (response.status === 401) {
        throw new Error(
          `Unauthorized (401): Your GitHub authentication token is invalid or expired. Please log out and log in again.`,
        );
      } else {
        throw new Error(`GitHub API error (${response.status}): ${errorData}`);
      }
    }

    return {
      success: true,
      message: 'Analysis submitted successfully',
    };
  } catch (error) {
    console.error('Error submitting analysis to GitHub:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Export function for use in other modules
window.submitAnalysisToGitHub = submitAnalysisToGitHub;
