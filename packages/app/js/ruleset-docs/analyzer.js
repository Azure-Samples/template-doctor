console.log('Docs rule set loaded');

class TemplateAnalyzerDocs {
  async getConfig() {
    const docsResponse = await fetch('./configs/docs-config.json');
    if (!docsResponse.ok) {
      throw new Error(`Failed to load docs config: ${docsResponse.status}`);
    }
    const ruleSetConfig = await docsResponse.json();

    // Convert pattern strings to RegExp objects for workflow files
    if (ruleSetConfig.requiredWorkflowFiles) {
      ruleSetConfig.requiredWorkflowFiles = ruleSetConfig.requiredWorkflowFiles.map((item) => ({
        pattern: new RegExp(item.pattern, 'i'),
        message: item.message,
      }));
    }

    return ruleSetConfig;
  }

  getRequiredFiles() {
    // TBD
    return { requiredFiles: [] };
  }
  getRequiredFolders() {
    // TBD
    return { requiredFolders: [] };
  }

  /**
   * Evaluate the default branch rule from docs-config.json
   * @param {Object} config - The configuration object
   * @param {Object} repoInfo - The repository information object
   * @param {string} defaultBranch - The default branch of the repository
   * @param {Array} issues - The issues array to populate with any issues found
   * @param {Array} compliant - The compliant array to populate with any compliant items
   */
  evaluateDefaultBranchRule(config, repoInfo, defaultBranch, issues, compliant) {
    // Guard: only run if docs-config defines a default branch requirement
    const expected = config?.githubRepositoryConfiguration?.defaultBranch?.mustBe;
    if (!expected) return;

    // Compare exact match by default; normalize if case-insensitive comparison desired
    const normalize = (s) => String(s).trim();
    if (normalize(defaultBranch) !== normalize(expected)) {
      issues.push({
        id: `default-branch-not-${expected}`,
        severity: 'error',
        message: `Default branch must be '${expected}'. Current default branch is '${defaultBranch}'.`,
        error: `Default branch is '${defaultBranch}', expected '${expected}'`,
      });
    } else {
      compliant.push({
        id: `default-branch-is-${expected}`,
        category: 'branch',
        message: `Default branch is '${expected}'`,
        details: { defaultBranch },
      });
    }
  }

  /**
   * Run all repository configuration validations together. Keep this minimal so future config checks can be added cleanly.
   * @param {Object} config
   * @param {Object} repoInfo
   * @param {string} defaultBranch
   * @param {Array} issues
   * @param {Array} compliant
   */
  validateRepoConfiguration(config, repoInfo, defaultBranch, files, issues, compliant) {
    try {
      // Run the existing default branch rule (docs-config defaultBranch.mustBe)
      this.evaluateDefaultBranchRule(config, repoInfo, defaultBranch, issues, compliant);

      // Future repo-level validations (webhooks, deploy keys, actions permissions, branch protection, etc.)
      // can be added here as additional helper calls such as:
      // this.evaluateWebhooksRule(config, repoInfo, issues);
      // this.evaluateDeployKeysRule(config, repoInfo, issues);
    } catch (err) {
      console.error('Error validating repository configuration:', err);
      issues.push({
        id: 'repo-configuration-validation-failed',
        severity: 'warning',
        message: 'Repository configuration validation failed',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
