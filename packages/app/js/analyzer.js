// Template Analyzer - Core logic from analyzeTemplate.ts adapted for browser
//
// Security Best Practices:
// The analyzer now includes enhanced security checks for Azure Bicep files:
// 1. Detection of Managed Identity usage - Identifies when Managed Identity is correctly used
// 2. Detection of insecure authentication methods - Identifies connection strings, access keys, SAS tokens, etc.
// 3. Detection of resources with potentially anonymous access - Identifies Azure resources that should have auth
//
// These checks can be enabled/disabled in the configuration files using the securityBestPractices settings
// in the bicepChecks section. See the config files for examples.

class TemplateAnalyzer {
  constructor() {
    this.githubClient = window.GitHubClient;
    this.ruleSetConfigs = {
      dod: {}, // Will be loaded when needed
      partner: {},
      docs: [],
      custom: {},
    };

    // Load rule set configurations
    this.loadRuleSetConfigs();
    
    // Add a debug method for consistent logging
    this.debug = (tag, message, data) => {
      if (window.debug) {
        window.debug(tag, message, data);
      } else {
        console.log(`[${tag}] ${message}`, data || '');
      }
    };
  }

  /**
   * Load rule set configurations from static JSON files
   */
  async loadRuleSetConfigs() {
    try {
      // Load DoD (default) config
      const dodResponse = await fetch('./configs/dod-config.json');
      if (!dodResponse.ok) {
        throw new Error(`Failed to load DoD config: ${dodResponse.status}`);
      }
      this.ruleSetConfigs.dod = await dodResponse.json();

      // Convert pattern strings to RegExp objects for workflow files
      if (this.ruleSetConfigs.dod.requiredWorkflowFiles) {
        this.ruleSetConfigs.dod.requiredWorkflowFiles =
          this.ruleSetConfigs.dod.requiredWorkflowFiles.map((item) => ({
            pattern: new RegExp(item.pattern, 'i'),
            message: item.message,
          }));
      }

      // Load Partner config
      const partnerResponse = await fetch('./configs/partner-config.json');
      if (!partnerResponse.ok) {
        throw new Error(`Failed to load Partner config: ${partnerResponse.status}`);
      }
      this.ruleSetConfigs.partner = await partnerResponse.json();

      // Convert pattern strings to RegExp objects for workflow files
      if (this.ruleSetConfigs.partner.requiredWorkflowFiles) {
        this.ruleSetConfigs.partner.requiredWorkflowFiles =
          this.ruleSetConfigs.partner.requiredWorkflowFiles.map((item) => ({
            pattern: new RegExp(item.pattern, 'i'),
            message: item.message,
          }));
      }

      // Load Docs config
      this.ruleSetConfigs.docs = await TemplateAnalyzerDocs.prototype.getConfig();

      // Load Custom config - this will be overridden if the user provides a custom config
      const customResponse = await fetch('./configs/custom-config.json');
      if (!customResponse.ok) {
        throw new Error(`Failed to load Custom config: ${customResponse.status}`);
      }
      this.ruleSetConfigs.custom = await customResponse.json();

      // Convert pattern strings to RegExp objects for workflow files (if any)
      if (this.ruleSetConfigs.custom.requiredWorkflowFiles) {
        this.ruleSetConfigs.custom.requiredWorkflowFiles =
          this.ruleSetConfigs.custom.requiredWorkflowFiles.map((item) => ({
            pattern: new RegExp(item.pattern, 'i'),
            message: item.message,
          }));
      }

      console.log('Rule set configurations loaded');
    } catch (error) {
      console.error('Failed to load rule set configurations:', error);

      // Fallback to hardcoded configs if loading fails
      this.ruleSetConfigs.dod = {
        requiredFiles: ['README.md', 'azure.yaml', 'LICENSE'],
        requiredFolders: ['infra', '.github'],
        requiredWorkflowFiles: [
          {
            pattern: /\.github\/workflows\/azure-dev\.yml/i,
            message: 'Missing required GitHub workflow: azure-dev.yml',
          },
        ],
        readmeRequirements: {
          requiredHeadings: ['Prerequisites', 'Getting Started'],
          architectureDiagram: {
            heading: 'Architecture',
            requiresImage: true,
          },
        },
      };

      this.ruleSetConfigs.partner = {
        ...this.ruleSetConfigs.dod,
        requiredFiles: ['README.md', 'azure.yaml'],
      };

      this.ruleSetConfigs.custom = {
        requiredFiles: ['README.md', 'azure.yaml'],
        requiredFolders: ['infra'],
      };
    }
  }

  /**
   * Get the appropriate configuration based on the selected rule set
   * @param {string} ruleSet - The rule set to use: "dod", "partner", "docs",or "custom"
   * @returns {Object} - The configuration for the selected rule set
   */
  getConfig(ruleSet = 'dod') {
    if (!ruleSet || ruleSet === 'dod') {
      const cfg = window.TemplateDoctorConfig || {};
      if (cfg.defaultRuleSet && typeof cfg.defaultRuleSet === 'string') {
        ruleSet = cfg.defaultRuleSet;
      }
    }
    switch (ruleSet) {
      case 'partner':
        return this.ruleSetConfigs.partner;
      case 'custom':
        return this.ruleSetConfigs.custom;
      case 'docs':
        return this.ruleSetConfigs.docs;
      case 'dod':
      default:
        return this.ruleSetConfigs.dod;
    }
  }

  /**
   * Extract owner and repo from a GitHub URL
   * @param {string} url - GitHub repository URL
   * @returns {Object} - Object with owner and repo properties
   */
  extractRepoInfo(url) {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)(\.git)?/);
    if (!match) throw new Error('Invalid GitHub URL');
    return {
      owner: match[1],
      repo: match[2],
      fullName: `${match[1]}/${match[2]}`,
    };
  }

  /**
   * Parse markdown content and extract headings with their levels
   * @param {string} markdown - Markdown content
   * @returns {Array} - Array of headings with their levels and texts
   */
  parseMarkdownHeadings(markdown) {
    const headings = [];
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;

    let match;
    while ((match = headingRegex.exec(markdown)) !== null) {
      const level = match[1].length;
      const text = match[2].trim();

      // Check if there's an image immediately after this heading
      const nextLines = markdown.substring(match.index + match[0].length);
      const hasImage = /^\s*!\[.*?\]\(.*?\)/m.test(nextLines.split('\n').slice(0, 5).join('\n'));

      headings.push({
        level,
        text,
        hasImage,
      });
    }

    return headings;
  }

  /**
   * Checks README.md content for required headings and architecture diagram
   * @param {string} readmeContent - README.md content
   * @param {Array} issues - Array to add issues to
   * @param {Array} compliant - Array to add compliant items to
   * @param {Object} config - The configuration to use for the analysis
   */
  checkReadmeRequirements(readmeContent, issues, compliant, config) {
    const headings = this.parseMarkdownHeadings(readmeContent);

    // Check for required headings (h2)
    if (config.readmeRequirements?.requiredHeadings) {
      for (const requiredHeading of config.readmeRequirements.requiredHeadings) {
        const headingMatch = headings.find(
          (h) => h.level === 2 && h.text.toLowerCase() === requiredHeading.toLowerCase(),
        );
        if (!headingMatch) {
          issues.push({
            id: `readme-missing-heading-${requiredHeading.toLowerCase().replace(/\s+/g, '-')}`,
            severity: 'error',
            message: `README.md is missing required h2 heading: ${requiredHeading}`,
            error: `README.md does not contain required h2 heading: ${requiredHeading}`,
          });
        } else {
          compliant.push({
            id: `readme-heading-${requiredHeading.toLowerCase().replace(/\s+/g, '-')}`,
            category: 'readmeHeading',
            message: `README.md contains required h2 heading: ${requiredHeading}`,
            details: {
              heading: requiredHeading,
              level: headingMatch.level,
            },
          });
        }
      }
    }

    // Check for architecture diagram heading and image
    if (config.readmeRequirements?.architectureDiagram) {
      const { heading, requiresImage } = config.readmeRequirements.architectureDiagram;
      const architectureHeading = headings.find(
        (h) => h.level === 2 && h.text.toLowerCase() === heading.toLowerCase(),
      );

      if (!architectureHeading) {
        issues.push({
          id: 'readme-missing-architecture-diagram-heading',
          severity: 'error',
          message: `README.md is missing required h2 heading: ${heading}`,
          error: `README.md does not contain required h2 heading: ${heading}`,
        });
      } else {
        compliant.push({
          id: 'readme-architecture-diagram-heading',
          category: 'readmeHeading',
          message: `README.md contains required h2 heading: ${heading}`,
          details: {
            heading: heading,
            level: architectureHeading.level,
          },
        });

        if (requiresImage && !architectureHeading.hasImage) {
          issues.push({
            id: 'readme-missing-architecture-diagram-image',
            severity: 'error',
            message: `Architecture Diagram section does not contain an image`,
            error: `README.md has Architecture Diagram heading but is missing an image`,
          });
        } else if (requiresImage && architectureHeading.hasImage) {
          compliant.push({
            id: 'readme-architecture-diagram-image',
            category: 'readmeImage',
            message: `Architecture Diagram section contains an image`,
            details: {
              heading: heading,
            },
          });
        }
      }
    }
  }

  /**
   * Analyze a GitHub repository against a rule set
   * @param {string} repoUrl - The GitHub repository URL
   * @param {string} ruleSet - The rule set to use: "dod", "partner", "docs", or "custom"
   * @returns {Promise<Object>} - The analysis result
   */
  async analyzeTemplate(repoUrl, ruleSet = 'dod') {
    if (!ruleSet || ruleSet === 'dod') {
      const cfg = window.TemplateDoctorConfig || {};
      if (cfg.defaultRuleSet && typeof cfg.defaultRuleSet === 'string') {
        ruleSet = cfg.defaultRuleSet;
      }
    }
    
    // Check if server-side analysis is preferred
    const cfg = window.TemplateDoctorConfig || {};
    // Support both legacy flag (preferServerSideAnalysis) and new nested config.analysis.useServerSide
    const preferServerSide =
      cfg.preferServerSideAnalysis === true || cfg.analysis?.useServerSide === true;
    // Fallback disabled permanently post v4 migration
    const allowFallback = false;

    if (preferServerSide) {
      try {
        const result = await this.analyzeTemplateServerSide(repoUrl, ruleSet);
        window.TemplateDoctorRuntime = Object.assign({}, window.TemplateDoctorRuntime, {
          lastMode: 'server',
          lastServerAttemptFailed: false,
          fallbackUsed: false,
        });
        document.dispatchEvent(new CustomEvent('analysis-mode-changed'));
        return result;
      } catch (err) {
        console.error('[analyzer] Server-side analysis failed', err);
        window.TemplateDoctorRuntime = Object.assign({}, window.TemplateDoctorRuntime, {
          lastMode: 'server-failed',
          lastServerAttemptFailed: true,
        });
        document.dispatchEvent(new CustomEvent('analysis-mode-changed'));
        // Fallback removed: propagate error
        throw err instanceof Error ? err : new Error(String(err));
      }
    }
    // If we reach here we are doing client-side only because server not preferred; no fallback semantics
    window.TemplateDoctorRuntime = Object.assign({}, window.TemplateDoctorRuntime, {
      lastMode: 'client',
      fallbackUsed: false,
    });
    document.dispatchEvent(new CustomEvent('analysis-mode-changed'));
    
    // Get the appropriate configuration based on the rule set
    const config = this.getConfig(ruleSet);
    const repoInfo = this.extractRepoInfo(repoUrl);

    // Store custom config details if using custom ruleset
    let customConfig = null;
    if (ruleSet === 'custom') {
      try {
        const savedConfig = localStorage.getItem('td_custom_ruleset');
        if (savedConfig) {
          customConfig = JSON.parse(savedConfig);
        }
      } catch (e) {
        console.error('Error loading custom configuration:', e);
      }
    }

    // UI feedback - this is usually handled by the caller
    this.debug('analyzer', `Analyzing repository ${repoInfo.fullName} with rule set: ${ruleSet}`);

    try {
      // Get default branch
      const defaultBranch = await this.githubClient.getDefaultBranch(repoInfo.owner, repoInfo.repo);

      // List all files in the repository
      const files = await this.githubClient.listAllFiles(
        repoInfo.owner,
        repoInfo.repo,
        defaultBranch,
      );

      // Start analyzing
      const issues = [];
      const compliant = [];

      // Run repository-level configuration validations early (docs-config rules)
      // Only run docs-specific repo validations when the docs ruleset is selected
      if (ruleSet === 'docs') {
        TemplateAnalyzerDocs.prototype.validateRepoConfiguration(
          config,
          repoInfo,
          defaultBranch,
          files,
          issues,
          compliant,
        );
      }

      // Normalize file paths for case-insensitive comparison
      const normalized = files.map((f) => f.toLowerCase());

      // Check for required files
      for (const file of config.requiredFiles) {
        if (!normalized.includes(file.toLowerCase())) {
          issues.push({
            id: `missing-${file}`,
            severity: 'error',
            message: `Missing required file: ${file}`,
            error: `File ${file} not found in repository`,
          });
        } else {
          compliant.push({
            id: `file-${file}`,
            category: 'requiredFile',
            message: `Required file found: ${file}`,
            details: {
              fileName: file,
            },
          });
        }
      }

      // Check for required workflow files using patterns
      if (config.requiredWorkflowFiles) {
        for (const workflowFile of config.requiredWorkflowFiles) {
          const matchingFile = normalized.find((file) => workflowFile.pattern.test(file));
          if (!matchingFile) {
            issues.push({
              id: `missing-workflow-${workflowFile.pattern.source}`,
              severity: 'error',
              message: workflowFile.message,
              error: workflowFile.message,
            });
          } else {
            compliant.push({
              id: `workflow-${matchingFile}`,
              category: 'requiredWorkflow',
              message: `Required workflow file found: ${matchingFile}`,
              details: {
                fileName: matchingFile,
                patternMatched: workflowFile.pattern.source,
              },
            });
          }
        }
      }

      // Check for required folders
      for (const folder of config.requiredFolders) {
        if (!normalized.some((f) => f.startsWith(folder.toLowerCase() + '/'))) {
          issues.push({
            id: `missing-folder-${folder}`,
            severity: 'error',
            message: `Missing required folder: ${folder}/`,
            error: `Folder ${folder} not found in repository`,
          });
        } else {
          const folderFiles = normalized.filter((f) => f.startsWith(folder.toLowerCase() + '/'));
          compliant.push({
            id: `folder-${folder}`,
            category: 'requiredFolder',
            message: `Required folder found: ${folder}/`,
            details: {
              folderPath: folder,
              fileCount: folderFiles.length,
            },
          });
        }
      }

      // Check README.md content for required headings and architecture diagram
      if (config.readmeRequirements && normalized.some((f) => f === 'readme.md')) {
        try {
          const readmeContent = await this.githubClient.getFileContent(
            repoInfo.owner,
            repoInfo.repo,
            'README.md',
          );
          this.checkReadmeRequirements(readmeContent, issues, compliant, config);
        } catch (err) {
          issues.push({
            id: 'readme-read-error',
            severity: 'warning',
            message: 'Could not read README.md',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // Check Bicep files
      const bicepFiles = files.filter((f) => f.startsWith('infra/') && f.endsWith('.bicep'));
      if (bicepFiles.length === 0) {
        issues.push({
          id: 'missing-bicep',
          severity: 'error',
          message: 'No Bicep files found in infra/',
          error: 'No Bicep files found in the infra/ directory',
        });
      } else {
        compliant.push({
          id: 'bicep-files-exist',
          category: 'bicepFiles',
          message: `Bicep files found in infra/ directory: ${bicepFiles.length} files`,
          details: {
            count: bicepFiles.length,
            files: bicepFiles,
          },
        });

        // Check each Bicep file for required resources
        for (const file of bicepFiles) {
          try {
            const content = await this.githubClient.getFileContent(
              repoInfo.owner,
              repoInfo.repo,
              file,
            );

            // Check for required resources
            const foundResources = [];
            const missingResources = [];

            for (const resource of config.bicepChecks.requiredResources) {
              if (!content.includes(resource)) {
                issues.push({
                  id: `bicep-missing-${resource.toLowerCase()}`,
                  severity: 'error',
                  message: `Missing resource "${resource}" in ${file}`,
                  error: `File ${file} does not contain required resource ${resource}`,
                });
                missingResources.push(resource);
              } else {
                compliant.push({
                  id: `bicep-resource-${resource.toLowerCase()}-${file}`,
                  category: 'bicepResource',
                  message: `Found required resource "${resource}" in ${file}`,
                  details: {
                    resource: resource,
                    file: file,
                  },
                });
                foundResources.push(resource);
              }
            }

            // Check for authentication methods and recommend Managed Identity when appropriate
            this.analyzeAuthenticationMethods(content, file, issues, compliant);
          } catch (err) {
            console.error(`Failed to read Bicep file: ${file}`);
            issues.push({
              id: `error-reading-${file}`,
              severity: 'warning',
              message: `Failed to read ${file}`,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }

      // Check for azure.yaml or azure.yml
      const azureYamlPath = files.find((f) => f === 'azure.yaml' || f === 'azure.yml');
      if (azureYamlPath) {
        compliant.push({
          id: 'azure-yaml-exists',
          category: 'azureYaml',
          message: `Found azure.yaml file: ${azureYamlPath}`,
          details: {
            fileName: azureYamlPath,
          },
        });

        try {
          const azureYamlContent = await this.githubClient.getFileContent(
            repoInfo.owner,
            repoInfo.repo,
            azureYamlPath,
          );
          if (
            config.azureYamlRules?.mustDefineServices &&
            !/services\s*:/i.test(azureYamlContent)
          ) {
            issues.push({
              id: 'azure-yaml-missing-services',
              severity: 'error',
              message: `No "services:" defined in ${azureYamlPath}`,
              error: `File ${azureYamlPath} does not define required "services:" section`,
            });
          } else if (config.azureYamlRules?.mustDefineServices) {
            compliant.push({
              id: 'azure-yaml-services-defined',
              category: 'azureYaml',
              message: `"services:" section found in ${azureYamlPath}`,
              details: {
                fileName: azureYamlPath,
              },
            });
          }
        } catch {
          issues.push({
            id: 'azure-yaml-read-error',
            severity: 'warning',
            message: `Could not read ${azureYamlPath}`,
            error: `Failed to read file ${azureYamlPath}`,
          });
        }
      } else {
        issues.push({
          id: 'missing-azure-yaml',
          severity: 'error',
          message: 'Missing azure.yaml or azure.yml file',
          error: 'No azure.yaml or azure.yml file found in repository',
        });
      }

      // Calculate summary and compliance percentages
      const summary = issues.length === 0 ? 'No issues found 🎉' : 'Issues found';
      const totalChecks = issues.length + compliant.length;
      const percentageCompliant =
        totalChecks > 0 ? Math.round((compliant.length / totalChecks) * 100) : 0;

      // Add metadata to compliant array
      compliant.push({
        id: 'compliance-summary',
        category: 'meta',
        message: `Compliance: ${percentageCompliant}%`,
        details: {
          issueCount: issues.length,
          compliantCount: compliant.length,
          totalChecks: totalChecks,
          percentageCompliant: percentageCompliant,
        },
      });

      // Return the analysis result
      const result = {
        repoUrl,
        ruleSet,
        timestamp: new Date().toISOString(),
        compliance: {
          issues,
          compliant,
          summary: `${summary} - Compliance: ${percentageCompliant}%`,
        },
      };

      // Add custom configuration details if applicable
      if (ruleSet === 'custom' && customConfig) {
        result.customConfig = {
          gistUrl: customConfig.gistUrl || null,
        };
      }

      return result;
    } catch (error) {
      console.error('Error analyzing template:', error);
      throw new Error(`Failed to analyze repository: ${error.message}`);
    }
  }

  /**
   * Analyze a GitHub repository using the server-side API
   * @param {string} repoUrl - The GitHub repository URL
   * @param {string} ruleSet - The rule set to use: "dod", "partner", "docs", or "custom"
   * @returns {Promise<Object>} - The analysis result
   */
  async analyzeTemplateServerSide(repoUrl, ruleSet) {
    this.debug('analyzer', `Using server-side analysis for ${repoUrl} with ruleset: ${ruleSet}`);
    
    try {
      // Get custom configuration if needed
      let customConfig = null;
      if (ruleSet === 'custom') {
        try {
          const savedConfig = localStorage.getItem('td_custom_ruleset');
          if (savedConfig) {
            customConfig = JSON.parse(savedConfig);
          }
        } catch (e) {
          console.error('Error loading custom configuration:', e);
        }
      }
      
      // Create the request payload
      const payload = {
        repoUrl,
        ruleSet,
        ...(customConfig ? { customConfig } : {})
      };
      
      // Get the API endpoint
      const cfg = window.TemplateDoctorConfig || {};
      const apiBase = cfg.apiBase || window.location.origin; // retained for fallback logging
      const endpoint = window.ApiRoutes
        ? window.ApiRoutes.build('analyze-template')
        : `${apiBase.replace(/\/$/, '')}/api/analyze-template`;
      
      // Build headers
      const headers = {
        'Content-Type': 'application/json',
      };
      
      // Add function key if available
      if (cfg.functionKey) {
        headers['x-functions-key'] = cfg.functionKey;
      }
      
      // Add authorization if available
      if (window.GitHubClient && window.GitHubClient.auth && window.GitHubClient.auth.isAuthenticated()) {
        const token = window.GitHubClient.auth.getToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }
      
      // Make the API request
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server-side analysis failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      // Parse the result
      const result = await response.json();
      
      // Add timestamp if not provided
      if (!result.timestamp) {
        result.timestamp = new Date().toISOString();
      }
      
      return result;
    } catch (error) {
      console.error('Error in server-side analysis:', error);
      throw new Error(`Server-side analysis failed: ${error.message}`);
    }
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
   * Analyze authentication methods in Bicep files
   * @param {string} content - The Bicep file content
   * @param {string} file - The file path
   * @param {Array} issues - The issues array to populate with any issues found
   * @param {Array} compliant - The compliant array to populate with any compliant items
   */
  analyzeAuthenticationMethods(content, file, issues, compliant) {
    // Skip if security checks are not enabled in config
    const config = this.getConfig();
    const securityChecks = config.bicepChecks?.securityBestPractices;
    if (!securityChecks) {
      return;
    }

    // Check for Managed Identity
    const hasManagedIdentity = this.checkForManagedIdentity(content);

    // Check for other authentication methods
    const authMethods = this.detectAuthenticationMethods(content);

    if (hasManagedIdentity) {
      compliant.push({
        id: `bicep-uses-managed-identity-${file}`,
        category: 'bicepSecurity',
        message: `Good practice: ${file} uses Managed Identity for Azure authentication`,
        details: {
          file: file,
          authMethod: 'ManagedIdentity',
        },
      });
    }

    // If other authentication methods are found, suggest using Managed Identity instead
    if (securityChecks.detectInsecureAuth && authMethods.length > 0) {
      const authMethodsList = authMethods.join(', ');

      issues.push({
        id: `bicep-alternative-auth-${file}`,
        severity: 'warning',
        message: `Security recommendation: Replace ${authMethodsList} with Managed Identity in ${file}`,
        error: `File ${file} uses ${authMethodsList} for authentication instead of Managed Identity`,
        recommendation: `Consider replacing ${authMethodsList} with Managed Identity for better security.`,
      });
    }

    // If no authentication method is found, check if there are any resources that typically need auth
    if (securityChecks.checkAnonymousAccess && !hasManagedIdentity && authMethods.length === 0) {
      const resourcesRequiringAuth = this.detectResourcesRequiringAuth(content);

      if (resourcesRequiringAuth.length > 0) {
        const resourcesList = resourcesRequiringAuth.join(', ');

        issues.push({
          id: `bicep-missing-auth-${file}`,
          severity: 'warning',
          message: `Security recommendation: Add Managed Identity for ${resourcesList} in ${file}`,
          error: `File ${file} may have resources (${resourcesList}) with anonymous access or missing authentication`,
          recommendation: `Configure Managed Identity for secure access to these resources.`,
        });
      }
    }
  }

  /**
   * Check if the Bicep file uses Managed Identity
   * @param {string} content - The Bicep file content
   * @returns {boolean} - Whether Managed Identity is used
   */
  checkForManagedIdentity(content) {
    // Common patterns for Managed Identity in Bicep files
    const patterns = [
      /identity:\s*\{\s*type:\s*['"]SystemAssigned['"]/i,
      /identity:\s*\{\s*type:\s*['"]UserAssigned['"]/i,
      /identity:\s*\{\s*type:\s*['"]SystemAssigned,UserAssigned['"]/i,
      /['"]identity['"]\s*:\s*\{\s*['"]type['"]\s*:\s*['"]SystemAssigned['"]/i,
      /['"]identity['"]\s*:\s*\{\s*['"]type['"]\s*:\s*['"]UserAssigned['"]/i,
      /['"]identity['"]\s*:\s*\{\s*['"]type['"]\s*:\s*['"]SystemAssigned,UserAssigned['"]/i,
      /managedIdentities:\s*\{\s*systemAssigned:\s*true/i,
      /managedIdentities:\s*\{\s*userAssignedResourceIds:/i,
    ];

    return patterns.some((pattern) => pattern.test(content));
  }

  /**
   * Detect other authentication methods in Bicep files
   * @param {string} content - The Bicep file content
   * @returns {string[]} - Array of detected authentication methods
   *
   * This method looks for various authentication patterns in Bicep templates that could be
   * replaced with Managed Identity for better security. It detects:
   * 1. Connection strings (potentially containing credentials)
   * 2. Access keys
   * 3. KeyVault secrets referenced without using Managed Identity
   * 4. SAS tokens
   * 5. Storage account keys
   * 6. Connection strings with explicit credentials
   *
   * When these patterns are found, the analyzer will recommend replacing them with
   * Managed Identity for improved security.
   */
  detectAuthenticationMethods(content) {
    const authMethods = [];

    // Check for connection strings
    if (/connectionString/i.test(content) || /['"]ConnectionString['"]/i.test(content)) {
      authMethods.push('Connection String');
    }

    // Check for access keys
    if (
      /accessKey/i.test(content) ||
      /['"]accessKey['"]/i.test(content) ||
      /primaryKey/i.test(content) ||
      /['"]primaryKey['"]/i.test(content) ||
      /secondaryKey/i.test(content) ||
      /['"]secondaryKey['"]/i.test(content)
    ) {
      authMethods.push('Access Key');
    }

    // Check for secrets
    // Find resource blocks that reference KeyVault secrets
    const resourceBlocks = content.match(/resource\s+\w+\s+'[^']*'\s*{[^}]*}/gis) || [];
    let keyVaultSecretWithoutMI = false;
    for (const block of resourceBlocks) {
      if (/keyVault.*\/secrets\//i.test(block) || /['"]secretUri['"]/i.test(block)) {
        // Check if this block has an identity property
        if (!/identity\s*:/i.test(block) && !/identity\s*{/i.test(block)) {
          keyVaultSecretWithoutMI = true;
          break;
        }
      }
    }
    if (keyVaultSecretWithoutMI) {
      authMethods.push('KeyVault Secret without Managed Identity');
    }

    // Check for SAS tokens
    if (
      /sasToken/i.test(content) ||
      /['"]sasToken['"]/i.test(content) ||
      /sharedAccessSignature/i.test(content) ||
      /SharedAccessKey/i.test(content)
    ) {
      authMethods.push('SAS Token');
    }

    // Check for Storage Account Keys
    if (/storageAccountKey/i.test(content) || /['"]storageAccountKey['"]/i.test(content)) {
      authMethods.push('Storage Account Key');
    }

    // Check for connection strings with credentials
    if (
      /AccountKey=/i.test(content) ||
      /Password=/i.test(content) ||
      /UserName=/i.test(content) ||
      /AccountEndpoint=/i.test(content)
    ) {
      authMethods.push('Connection String with credentials');
    }

    return authMethods;
  }

  /**
   * Detect resources that typically require authentication
   * @param {string} content - The Bicep file content
   * @returns {string[]} - Array of resources that typically require authentication
   *
   * This method identifies Azure resources in Bicep templates that typically
   * should use some form of authentication - preferably Managed Identity.
   * When such resources are found but no authentication method is detected,
   * the analyzer will suggest adding Managed Identity to avoid potential
   * anonymous access security risks.
   *
   * This is particularly important for resources like Key Vault, Storage Accounts,
   * Cosmos DB, SQL Server, and other services that should never be exposed without
   * proper authentication.
   */
  detectResourcesRequiringAuth(content) {
    const resources = [];

    // Common Azure resources that typically require authentication
    const resourcePatterns = [
      { pattern: /Microsoft\.Storage\/storageAccounts/i, name: 'Storage Account' },
      { pattern: /Microsoft\.KeyVault\/vaults/i, name: 'Key Vault' },
      { pattern: /Microsoft\.DocumentDB\/databaseAccounts/i, name: 'Cosmos DB' },
      { pattern: /Microsoft\.Sql\/servers/i, name: 'SQL Server' },
      { pattern: /Microsoft\.Web\/sites/i, name: 'App Service' },
      { pattern: /Microsoft\.ContainerRegistry\/registries/i, name: 'Container Registry' },
      { pattern: /Microsoft\.ServiceBus\/namespaces/i, name: 'Service Bus' },
      { pattern: /Microsoft\.EventHub\/namespaces/i, name: 'Event Hub' },
      { pattern: /Microsoft\.ApiManagement\/service/i, name: 'API Management' },
      { pattern: /Microsoft\.CognitiveServices\/accounts/i, name: 'Cognitive Services' },
      { pattern: /Microsoft\.ContainerService\/managedClusters/i, name: 'AKS Cluster' },
      { pattern: /Microsoft\.Cache\/Redis/i, name: 'Redis Cache' },
      { pattern: /Microsoft\.Search\/searchServices/i, name: 'Search Service' },
      { pattern: /Microsoft\.OperationalInsights\/workspaces/i, name: 'Log Analytics' },
    ];

    for (const { pattern, name } of resourcePatterns) {
      if (pattern.test(content)) {
        resources.push(name);
      }
    }

    return resources;
  }

  /**
   * Run all repository configuration validations together. Keep this minimal so future config checks can be added cleanly.
   * @param {Object} config
   * @param {Object} repoInfo
   * @param {string} defaultBranch
   * @param {Array} issues
   * @param {Array} compliant
   */
  validateRepoConfiguration(config, repoInfo, defaultBranch, issues, compliant) {
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

// Function to initialize the analyzer
function initializeAnalyzer() {
  console.log('[TemplateAnalyzer] Initializing analyzer with GitHub client:', {
    clientInitialized: !!window.GitHubClient,
    authenticated: window.GitHubClient?.auth?.isAuthenticated() || false,
  });

  // If the analyzer already exists and the token changes, re-initialize it
  if (window.TemplateAnalyzer && window.GitHubClient) {
    window.TemplateAnalyzer.githubClient = window.GitHubClient;
    console.log('[TemplateAnalyzer] Updated existing analyzer with current GitHub client');
  } else {
    // Create new analyzer
    const templateAnalyzer = new TemplateAnalyzer();
    window.TemplateAnalyzer = templateAnalyzer;
    console.log('[TemplateAnalyzer] Analyzer initialized and assigned to window.TemplateAnalyzer');
  }

  // Dispatch event that analyzer is ready
  const event = new CustomEvent('template-analyzer-ready');
  document.dispatchEvent(event);

  return true;
}

// Try to initialize immediately if GitHub client is already available
if (window.GitHubClient) {
  initializeAnalyzer();
} else {
  // Create and export the analyzer instance after a small delay to ensure GitHub client is fully initialized
  console.log(
    '[TemplateAnalyzer] GitHub client not available yet, waiting 1 second before initializing',
  );
  setTimeout(initializeAnalyzer, 1000); // 1 second delay
}

// Add a listener for when the GitHub client becomes authenticated
document.addEventListener('github-auth-changed', () => {
  console.log('[TemplateAnalyzer] GitHub auth changed, re-initializing analyzer');
  initializeAnalyzer();
});

// Add extra initialization safety checks
window.checkAnalyzerReady = function () {
  // Check if analyzer exists
  if (window.TemplateAnalyzer) {
    console.log('[TemplateAnalyzer] Analyzer is already initialized');
    return true;
  }

  // Check for GitHub client
  if (!window.GitHubClient) {
    console.error('[TemplateAnalyzer] GitHub client not available');
    return false;
  }

  // If we got here, we need to initialize the analyzer
  console.log('[TemplateAnalyzer] Analyzer not ready, initializing now');

  // Create the analyzer immediately
  try {
    const templateAnalyzer = new TemplateAnalyzer();
    window.TemplateAnalyzer = templateAnalyzer;
    console.log('[TemplateAnalyzer] Analyzer initialized successfully');

    // Dispatch event that analyzer is ready
    const event = new CustomEvent('template-analyzer-ready');
    document.dispatchEvent(event);

    return true;
  } catch (error) {
    console.error('[TemplateAnalyzer] Failed to initialize analyzer:', error);
    return false;
  }
};
