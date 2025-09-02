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

    // Determine archiving flags (global config + one-time override)
    const cfg = window.TemplateDoctorConfig || {};
    // If a one-time override is set (from ruleset modal), prefer it when global is false
    let archiveEnabled = !!cfg.archiveEnabled;
    const hasOverride = Object.prototype.hasOwnProperty.call(
      cfg,
      'nextAnalysisArchiveEnabledOverride',
    );
    if (!archiveEnabled && hasOverride) {
      archiveEnabled = !!cfg.nextAnalysisArchiveEnabledOverride;
      // Clear one-time override after reading so it only applies to the next submission
      delete cfg.nextAnalysisArchiveEnabledOverride;
      window.TemplateDoctorConfig = cfg;
    }
    const archiveCollection = cfg.archiveCollection || 'aigallery';

    // Optionally allow front-end config to specify the target repo for repository_dispatch
    // Useful when the API environment cannot infer the workflow host repo from env
    const targetRepo = cfg.dispatchTargetRepo || '';

    // Extract necessary data from the result
    const payload = {
      repoUrl: result.repoUrl,
      ruleSet: result.ruleSet,
      username: username,
      timestamp: result.timestamp,
      analysisData: result,
      // Pass through centralized archive preferences so the workflow can act on them
      archiveEnabled,
      archiveCollection,
      // Optional override for the server to choose where to dispatch
      ...(targetRepo ? { targetRepo } : {}),
      compliance: {
        percentage:
          result.compliance.compliant.find((c) => c.id === 'compliance-summary')?.details
            ?.percentageCompliant || 0,
        passed: result.compliance.compliant.length,
        issues: result.compliance.issues.length,
      },
    };

    // Post via server to avoid org OAuth restrictions (uses server GH_WORKFLOW_TOKEN)
    // cfg already defined above
    const apiBase = cfg.apiBase || window.location.origin;
    const serverUrl = `${apiBase.replace(/\/$/, '')}/api/submit-analysis-dispatch`;
    console.log(`Submitting via server endpoint: ${serverUrl}`);

    // Build headers; include function key if provided by runtime config
    const headers = {
      'Content-Type': 'application/json',
    };
    if (cfg.functionKey) {
      headers['x-functions-key'] = cfg.functionKey;
    }

    // Make the API request to our server function
    console.log('Sending repository_dispatch event via server...');
    const response = await fetch(serverUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event_type: 'template-analysis-completed',
        client_payload: payload,
      }),
    });

    console.log('Server dispatch response status:', response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Error response body:', errorData);

      // Provide more helpful error messages based on status code
      if (response.status === 404) {
        throw new Error(
          'Endpoint not found (404): Check that the submit-analysis-dispatch function is deployed and apiBase is correct.',
        );
      }
      if (response.status === 401) {
        throw new Error(
          'Unauthorized (401): Function key missing or invalid for the server endpoint.',
        );
      }
      if (response.status === 403) {
        throw new Error(
          'Permission denied (403): The server token may lack required scopes or org SSO. Contact an admin to approve GH_WORKFLOW_TOKEN for the org.',
        );
      }

      throw new Error(`Server error (${response.status}): ${errorData || 'Unknown error'}`);
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
