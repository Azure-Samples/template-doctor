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
    const PREFIX = 'docs-repository-'; // Consistent prefix for this validation
    const category = "Repo";
    
    // Guard: only run if docs-config defines a default branch requirement
    const expected = config?.githubRepositoryConfiguration?.defaultBranch?.mustBe;
    if (!expected) return;

    // Compare exact match by default; normalize if case-insensitive comparison desired
    const normalize = (s) => String(s).trim();
    if (normalize(defaultBranch) !== normalize(expected)) {
      issues.push({
        id: `${PREFIX}default-branch-incorrect`,
        category,
        severity: 'error',
        message: `Default branch must be '${expected}'. Current default branch is '${defaultBranch}'.`,
        error: `Default branch is '${defaultBranch}', expected '${expected}'`,
      });
    } else {
      compliant.push({
        id: `${PREFIX}default-branch-correct`,
        category,
        message: `Default branch is '${expected}'`,
        details: { defaultBranch },
      });
    }
  }
  async evaluateOssfScore(apiUrl, config, repoInfo, defaultBranch, issues, compliant) {
    const PREFIX = 'ossf-'; // Consistent prefix for this validation
    
    try {
      const minScore = 6.0;
      const templateUrl = `${repoInfo.owner}/${repoInfo.repo}`;

      const ossfApiUrl = `${apiUrl}/validation-ossf`;
      console.log(`[Docs-ossf] ${ossfApiUrl} for ${templateUrl}  `);

      const response = await fetch(ossfApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateUrl,
          minScore
        }),
      });


      console.log(`[Docs-ossf] ${ossfApiUrl} response.status: ${response.status} ${response.statusText}`);

      // this api has up to 3 minutes to timeout
      if (response.ok) { // Fixed: was response.ok()

        const data = await response.json();

        console.log(`[Docs-ossf] data received: ${JSON.stringify(data)}`);

        if (data?.issues?.length > 0) {
          // Add each issue to the passed issues array
          data.issues.forEach(issue => {
            // Preserve original id if it already has the correct prefix
            const id = issue.id.startsWith(PREFIX) 
              ? issue.id 
              : `${PREFIX}${issue.id}`;
              
            issues.push({
              ...issue,
              id
            });
          });
        }

        if (data?.compliant?.length > 0) {
          // Add each compliant item to the passed compliant array
          data.compliant.forEach(item => {
            // Preserve original id if it already has the correct prefix
            const id = item.id.startsWith(PREFIX) 
              ? item.id 
              : `${PREFIX}${item.id}`;
              
            compliant.push({
              ...item,
              id
            });
          });
        }
      } else {
        issues.push({
          id: `${PREFIX}api-failure`,
          severity: 'warning',
          message: `Failed to validate OSSF score via API: ${response.status} ${response.statusText}`,
          error: `OSSF score validation API returned status ${response.status}`,
        });
      }
    } catch (error) {
      console.error('Error during OSSF score validation:', error);
      issues.push({
        id: `${PREFIX}exception`,
        severity: 'warning',
        message: 'Exception occurred during OSSF score validation',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  async evaluateTrivyScore(apiUrl, config, repoInfo, issues, compliant) {
    const PREFIX = 'docker-'; // Consistent prefix for this validation
    
    try {
      const minScore = 0.0;
      const templateUrl = `${repoInfo.owner}/${repoInfo.repo}`;

      const trivyApiUrl = `${apiUrl}/validation-docker-image`;
      console.log(`[Docs-trivy] ${trivyApiUrl} for ${templateUrl}  `);

      const response = await fetch(trivyApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateUrl,
          minScore
        }),
      });

      console.log(`[Docs-trivy] ${trivyApiUrl} response.status: ${response.status} ${response.statusText}`);

      // this api has up to 3 minutes to timeout
      if (response.ok) { // Fixed: was response.ok()

        const data = await response.json();

        if (!data?.details?.complianceResults) {
          // Add each issue to the passed issues array
          issues.push({
            id: `${PREFIX}api-data-response-failure`,
            severity: 'error',
            message: `Failed to validate docker images via API: no complianceResults returned`,
            error: `Docker image validation API returned no complianceResults`
          });
          return;
        }

        if (data?.details?.complianceResults?.repositoryScan) {

          const repositoryScan = data?.details?.complianceResults?.repositoryScan;

          const criticalMisconfigurations = repositoryScan.criticalMisconfigurations;
          const criticalVulnerabilities = repositoryScan.criticalVulns;

          if (criticalMisconfigurations == 0 && criticalVulnerabilities == 0) {
            compliant.push({
              id: `${PREFIX}repo-security-check-passed`,
              category: 'security',
              message: `Repository security checks completed successfully`,
              details: {
                criticalMisconfigurations,
                criticalVulnerabilities
              },
            });
          } else {
            issues.push({
              id: `${PREFIX}repo-security-check`,
              severity: 'warning',
              message: `Repo vulnerability scan found issues: ${criticalMisconfigurations} critical misconfigurations, ${criticalVulnerabilities} critical vulnerabilities`,
            });
          }

        }

        if (data?.details?.complianceResults?.imageScans?.length > 0) {
          const imageScans = data?.details?.complianceResults?.imageScans;
          let imagesWithIssues = 0;
          imageScans.forEach(image => {
            const criticalMisconfigurations = image.criticalMisconfigurations;
            const criticalVulnerabilities = image.criticalVulns;
            if (criticalMisconfigurations == 0 && criticalVulnerabilities == 0) {
              compliant.push({
                id: `${PREFIX}image-security-check-${image.artifactName}`,
                category: 'security',
                message: `Docker image ${image.artifactName} security checks completed successfully`,
                details: {
                  artifactName: image.artifactName,
                  criticalMisconfigurations,
                  criticalVulnerabilities
                },
              });
            } else {
              imagesWithIssues++;
              issues.push({
                id: `${PREFIX}image-security-check-${image.artifactName}`,
                severity: 'warning',
                message: `Docker image ${image.artifactName} vulnerability scan found issues: ${criticalMisconfigurations} critical misconfigurations, ${criticalVulnerabilities} critical vulnerabilities`,
              });
            }
          });
          if (imagesWithIssues === 0) {
            compliant.push({
              id: `${PREFIX}images-no-security-issues`,
              category: 'security',
              message: `All Docker images are free of critical misconfigurations and vulnerabilities`,
              details: {
                imageCount: imageScans.length
              },
            });
          }
        }


      } else {
        issues.push({
          id: `${PREFIX}image-api-failure`,
          severity: 'warning',
          message: `Failed to validate Docker image via API: ${response.status} ${response.statusText}`,
          error: `Docker image validation API returned status ${response.status}`,
        });
      }
    } catch (error) {
      console.error('Error during Docker image validation:', error);
      issues.push({
        id: `${PREFIX}image-validation-exception`,
        severity: 'warning',
        message: 'Exception occurred during Docker image validation',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  /**
   * Run all repository configuration validations together. Keep this minimal so future config checks can be added cleanly.
   * @param {Object} config - Configuration object containing validation rules
   * @param {Object} repoInfo - Repository information with owner and repo name
   * @param {string} defaultBranch - The default branch of the repository
   * @param {Array} files - List of files in the repository
   * @param {Array} issues - Array to populate with any issues found
   * @param {Array} compliant - Array to populate with any compliant items
   * @returns {Object} Summary of validation results
   */
  async validateDocConfiguration(config, repoInfo, defaultBranch, files, issues, compliant) {
    // Initialize validation results tracking
    const validationResults = {
      total: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      details: []
    };

    try {
      // Check for valid configuration
      if (!config) {
        issues.push({
          id: 'docs-missing-configuration',
          category: 'validation',
          severity: 'error',
          message: 'Documentation validation configuration is missing or invalid'
        });
        return validationResults;
      }

      const isLocalhost = window.location.hostname === 'localhost';
      // Use local Functions port in pure localhost dev, otherwise use SWA-managed /api proxy
      const apiUrl = isLocalhost
        ? 'http://localhost:7071/api'
        : '/api';
      console.log(`[Docs] baseUrl: ${apiUrl}`);

      // Create a map of named validations with their conditions and functions
      const validations = {
        defaultBranch: {
          enabled: !!config?.githubRepositoryConfiguration,
          name: 'Default Branch Check',
          fn: () => this.evaluateDefaultBranchRule(config, repoInfo, defaultBranch, issues, compliant)
        },
        ossf: {
          enabled: !!config?.ossf,
          name: 'OSSF Scorecard',
          fn: () => this.evaluateOssfScore(apiUrl, config, repoInfo, defaultBranch, issues, compliant)
        },
        dockerImages: {
          enabled: !!config?.dockerImages,
          name: 'Docker Image Security',
          fn: () => this.evaluateTrivyScore(apiUrl, config, repoInfo, issues, compliant)
        }
      };

      console.log('[Docs] Validations to run:', Object.entries(validations).filter(([_, v]) => v.enabled).map(([k, v]) => k));

      // Create array of promises for enabled validations
      const asyncValidations = [];
      const validationNames = [];

      // Filter enabled validations and collect them
      Object.entries(validations).forEach(([key, validation]) => {
        if (validation.enabled) {
          asyncValidations.push(validation.fn());
          validationNames.push({ key, name: validation.name });
          validationResults.total++;
        } else {
          validationResults.skipped++;
          validationResults.details.push({
            name: validation.name,
            status: 'skipped',
            reason: 'Disabled in configuration'
          });
        }
      });

      console.log(`[Docs] Running ${asyncValidations.length} validations, skipped ${validationResults.skipped}`);

      // Use allSettled to ensure all promises are attempted even if some fail
      const results = await Promise.allSettled(asyncValidations);

      // Process results and update tracking
      results.forEach((result, index) => {
        const validationInfo = validationNames[index];
        
        if (result.status === 'fulfilled') {
          validationResults.successful++;
          validationResults.details.push({
            name: validationInfo.name,
            key: validationInfo.key,
            status: 'success'
          });
        } else if (result.status === 'rejected') {
          validationResults.failed++;
          validationResults.details.push({
            name: validationInfo.name,
            key: validationInfo.key,
            status: 'failed',
            error: result.reason
          });
          
          console.warn(`[Docs] Validation '${validationInfo.name}' failed:`, result.reason);
        }
      });

      console.log(`[Docs] Completed ${validationResults.successful}/${validationResults.total} validations successfully`);
      return validationResults;

    } catch (err) {
      console.error('Error validating repository configuration:', err);
      issues.push({
        id: 'repo-configuration-validation-failed',
        category: 'validation',
        severity: 'error', // Changed from warning to error
        message: 'Repository configuration validation failed',
        error: err instanceof Error ? err.message : String(err),
      });
      
      validationResults.failed = validationResults.total;
      validationResults.successful = 0;
      return validationResults;
    }
  }
}
