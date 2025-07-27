// Template Analyzer - Core logic from analyzeTemplate.ts adapted for browser

class TemplateAnalyzer {
    constructor() {
        this.githubClient = window.GitHubClient;
        this.ruleSetConfigs = {
            dod: {}, // Will be loaded when needed
            partner: {},
            custom: {}
        };
        
        // Load rule set configurations
        this.loadRuleSetConfigs();
    }
    
    /**
     * Load rule set configurations from static JSON files
     */
    async loadRuleSetConfigs() {
        try {
            // In a real implementation, these would be loaded from actual JSON files
            // For now, we'll define them inline with a subset of rules for demonstration
            this.ruleSetConfigs.dod = {
                requiredFiles: [
                    "README.md",
                    "azure.yaml",
                    "LICENSE"
                ],
                requiredFolders: [
                    "infra",
                    ".github"
                ],
                requiredWorkflowFiles: [
                    { pattern: /\.github\/workflows\/azure-dev\.yml/i, message: "Missing required GitHub workflow: azure-dev.yml" }
                ],
                readmeRequirements: {
                    requiredHeadings: [
                        "Prerequisites",
                        "Getting Started"
                    ],
                    architectureDiagram: {
                        heading: "Architecture",
                        requiresImage: true
                    }
                },
                bicepChecks: {
                    requiredResources: [
                        "Microsoft.Resources/resourceGroups",
                        "Microsoft.KeyVault/vaults"
                    ]
                },
                azureYamlRules: {
                    mustDefineServices: true
                }
            };
            
            // Load simplified partner rules
            this.ruleSetConfigs.partner = {
                ...this.ruleSetConfigs.dod,
                requiredFiles: [
                    "README.md",
                    "azure.yaml"
                ]
            };
            
            // Load simplified custom rules
            this.ruleSetConfigs.custom = {
                requiredFiles: [
                    "README.md",
                    "azure.yaml"
                ],
                requiredFolders: [
                    "infra"
                ]
            };
            
            console.log("Rule set configurations loaded");
        } catch (error) {
            console.error("Failed to load rule set configurations:", error);
        }
    }
    
    /**
     * Get the appropriate configuration based on the selected rule set
     * @param {string} ruleSet - The rule set to use: "dod", "partner", or "custom"
     * @returns {Object} - The configuration for the selected rule set
     */
    getConfig(ruleSet = "dod") {
        switch (ruleSet) {
            case "partner":
                return this.ruleSetConfigs.partner;
            case "custom":
                return this.ruleSetConfigs.custom;
            case "dod":
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
        if (!match) throw new Error("Invalid GitHub URL");
        return { 
            owner: match[1],
            repo: match[2],
            fullName: `${match[1]}/${match[2]}`
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
                hasImage
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
                const headingMatch = headings.find(h => h.level === 2 && h.text.toLowerCase() === requiredHeading.toLowerCase());
                if (!headingMatch) {
                    issues.push({
                        id: `readme-missing-heading-${requiredHeading.toLowerCase().replace(/\s+/g, '-')}`,
                        severity: "error",
                        message: `README.md is missing required h2 heading: ${requiredHeading}`,
                        error: `README.md does not contain required h2 heading: ${requiredHeading}`
                    });
                } else {
                    compliant.push({
                        id: `readme-heading-${requiredHeading.toLowerCase().replace(/\s+/g, '-')}`,
                        category: "readmeHeading",
                        message: `README.md contains required h2 heading: ${requiredHeading}`,
                        details: {
                            heading: requiredHeading,
                            level: headingMatch.level
                        }
                    });
                }
            }
        }
        
        // Check for architecture diagram heading and image
        if (config.readmeRequirements?.architectureDiagram) {
            const { heading, requiresImage } = config.readmeRequirements.architectureDiagram;
            const architectureHeading = headings.find(h => 
                h.level === 2 && h.text.toLowerCase() === heading.toLowerCase()
            );
            
            if (!architectureHeading) {
                issues.push({
                    id: 'readme-missing-architecture-diagram-heading',
                    severity: "error",
                    message: `README.md is missing required h2 heading: ${heading}`,
                    error: `README.md does not contain required h2 heading: ${heading}`
                });
            } else {
                compliant.push({
                    id: 'readme-architecture-diagram-heading',
                    category: "readmeHeading",
                    message: `README.md contains required h2 heading: ${heading}`,
                    details: {
                        heading: heading,
                        level: architectureHeading.level
                    }
                });
                
                if (requiresImage && !architectureHeading.hasImage) {
                    issues.push({
                        id: 'readme-missing-architecture-diagram-image',
                        severity: "error",
                        message: `Architecture Diagram section does not contain an image`,
                        error: `README.md has Architecture Diagram heading but is missing an image`
                    });
                } else if (requiresImage && architectureHeading.hasImage) {
                    compliant.push({
                        id: 'readme-architecture-diagram-image',
                        category: "readmeImage",
                        message: `Architecture Diagram section contains an image`,
                        details: {
                            heading: heading
                        }
                    });
                }
            }
        }
    }

    /**
     * Analyze a GitHub repository against a rule set
     * @param {string} repoUrl - The GitHub repository URL
     * @param {string} ruleSet - The rule set to use: "dod", "partner", or "custom"
     * @returns {Promise<Object>} - The analysis result
     */
    async analyzeTemplate(repoUrl, ruleSet = "dod") {
        // Get the appropriate configuration based on the rule set
        const config = this.getConfig(ruleSet);
        const repoInfo = this.extractRepoInfo(repoUrl);
        
        // UI feedback - this is usually handled by the caller
        console.log(`Analyzing repository ${repoInfo.fullName} with rule set: ${ruleSet}`);
        
        try {
            // Get default branch
            const defaultBranch = await this.githubClient.getDefaultBranch(repoInfo.owner, repoInfo.repo);
            
            // List all files in the repository
            const files = await this.githubClient.listAllFiles(repoInfo.owner, repoInfo.repo, defaultBranch);
            
            // Start analyzing
            const issues = [];
            const compliant = [];
            
            // Normalize file paths for case-insensitive comparison
            const normalized = files.map(f => f.toLowerCase());
            
            // Check for required files
            for (const file of config.requiredFiles) {
                if (!normalized.includes(file.toLowerCase())) {
                    issues.push({
                        id: `missing-${file}`,
                        severity: "error",
                        message: `Missing required file: ${file}`,
                        error: `File ${file} not found in repository`,
                    });
                } else {
                    compliant.push({
                        id: `file-${file}`,
                        category: "requiredFile",
                        message: `Required file found: ${file}`,
                        details: {
                            fileName: file
                        }
                    });
                }
            }
            
            // Check for required workflow files using patterns
            if (config.requiredWorkflowFiles) {
                for (const workflowFile of config.requiredWorkflowFiles) {
                    const matchingFile = normalized.find(file => workflowFile.pattern.test(file));
                    if (!matchingFile) {
                        issues.push({
                            id: `missing-workflow-${workflowFile.pattern.source}`,
                            severity: "error",
                            message: workflowFile.message,
                            error: workflowFile.message
                        });
                    } else {
                        compliant.push({
                            id: `workflow-${matchingFile}`,
                            category: "requiredWorkflow",
                            message: `Required workflow file found: ${matchingFile}`,
                            details: {
                                fileName: matchingFile,
                                patternMatched: workflowFile.pattern.source
                            }
                        });
                    }
                }
            }
            
            // Check for required folders
            for (const folder of config.requiredFolders) {
                if (!normalized.some((f) => f.startsWith(folder.toLowerCase() + "/"))) {
                    issues.push({
                        id: `missing-folder-${folder}`,
                        severity: "error",
                        message: `Missing required folder: ${folder}/`,
                        error: `Folder ${folder} not found in repository`
                    });
                } else {
                    const folderFiles = normalized.filter(f => f.startsWith(folder.toLowerCase() + "/"));
                    compliant.push({
                        id: `folder-${folder}`,
                        category: "requiredFolder",
                        message: `Required folder found: ${folder}/`,
                        details: {
                            folderPath: folder,
                            fileCount: folderFiles.length
                        }
                    });
                }
            }
            
            // Check README.md content for required headings and architecture diagram
            if (config.readmeRequirements && normalized.some(f => f === "readme.md")) {
                try {
                    const readmeContent = await this.githubClient.getFileContent(
                        repoInfo.owner, repoInfo.repo, "README.md"
                    );
                    this.checkReadmeRequirements(readmeContent, issues, compliant, config);
                } catch (err) {
                    issues.push({
                        id: "readme-read-error",
                        severity: "warning",
                        message: "Could not read README.md",
                        error: err instanceof Error ? err.message : String(err)
                    });
                }
            }
            
            // Check Bicep files
            const bicepFiles = files.filter((f) => f.startsWith("infra/") && f.endsWith(".bicep"));
            if (bicepFiles.length === 0) {
                issues.push({
                    id: "missing-bicep",
                    severity: "error",
                    message: "No Bicep files found in infra/",
                    error: "No Bicep files found in the infra/ directory"
                });
            } else {
                compliant.push({
                    id: "bicep-files-exist",
                    category: "bicepFiles",
                    message: `Bicep files found in infra/ directory: ${bicepFiles.length} files`,
                    details: {
                        count: bicepFiles.length,
                        files: bicepFiles
                    }
                });
                
                // Check each Bicep file for required resources
                for (const file of bicepFiles) {
                    try {
                        const content = await this.githubClient.getFileContent(
                            repoInfo.owner, repoInfo.repo, file
                        );
                        
                        // Check for required resources
                        const foundResources = [];
                        const missingResources = [];
                        
                        for (const resource of config.bicepChecks.requiredResources) {
                            if (!content.includes(resource)) {
                                issues.push({
                                    id: `bicep-missing-${resource.toLowerCase()}`,
                                    severity: "error",
                                    message: `Missing resource "${resource}" in ${file}`,
                                    error: `File ${file} does not contain required resource ${resource}`
                                });
                                missingResources.push(resource);
                            } else {
                                compliant.push({
                                    id: `bicep-resource-${resource.toLowerCase()}-${file}`,
                                    category: "bicepResource",
                                    message: `Found required resource "${resource}" in ${file}`,
                                    details: {
                                        resource: resource,
                                        file: file
                                    }
                                });
                                foundResources.push(resource);
                            }
                        }
                    } catch(err) {
                        console.error(`Failed to read Bicep file: ${file}`);
                        issues.push({
                            id: `error-reading-${file}`,
                            severity: "warning",
                            message: `Failed to read ${file}`,
                            error: err instanceof Error ? err.message : String(err)
                        });
                    }
                }
            }
            
            // Check for azure.yaml or azure.yml
            const azureYamlPath = files.find(f => f === "azure.yaml" || f === "azure.yml");
            if (azureYamlPath) {
                compliant.push({
                    id: "azure-yaml-exists",
                    category: "azureYaml",
                    message: `Found azure.yaml file: ${azureYamlPath}`,
                    details: {
                        fileName: azureYamlPath
                    }
                });
                
                try {
                    const azureYamlContent = await this.githubClient.getFileContent(
                        repoInfo.owner, repoInfo.repo, azureYamlPath
                    );
                    if (config.azureYamlRules?.mustDefineServices && !/services\s*:/i.test(azureYamlContent)) {
                        issues.push({
                            id: "azure-yaml-missing-services",
                            severity: "error",
                            message: `No "services:" defined in ${azureYamlPath}`,
                            error: `File ${azureYamlPath} does not define required "services:" section`
                        });
                    } else if (config.azureYamlRules?.mustDefineServices) {
                        compliant.push({
                            id: "azure-yaml-services-defined",
                            category: "azureYaml",
                            message: `"services:" section found in ${azureYamlPath}`,
                            details: {
                                fileName: azureYamlPath
                            }
                        });
                    }
                } catch {
                    issues.push({
                        id: "azure-yaml-read-error",
                        severity: "warning",
                        message: `Could not read ${azureYamlPath}`,
                        error: `Failed to read file ${azureYamlPath}`
                    });
                }
            } else {
                issues.push({
                    id: "missing-azure-yaml",
                    severity: "error",
                    message: "Missing azure.yaml or azure.yml file",
                    error: "No azure.yaml or azure.yml file found in repository"
                });
            }
            
            // Calculate summary and compliance percentages
            const summary = issues.length === 0 ? "No issues found 🎉" : "Issues found";
            const totalChecks = issues.length + compliant.length;
            const percentageCompliant = totalChecks > 0 ? Math.round((compliant.length / totalChecks) * 100) : 0;
            
            // Add metadata to compliant array
            compliant.push({
                id: "compliance-summary",
                category: "meta",
                message: `Compliance: ${percentageCompliant}%`,
                details: {
                    issueCount: issues.length,
                    compliantCount: compliant.length,
                    totalChecks: totalChecks,
                    percentageCompliant: percentageCompliant
                }
            });
            
            // Return the analysis result
            const result = {
                repoUrl,
                ruleSet,
                timestamp: new Date().toISOString(),
                compliance: {
                    issues,
                    compliant,
                    summary: `${summary} - Compliance: ${percentageCompliant}%`
                }
            };
            
            return result;
        } catch (error) {
            console.error("Error analyzing template:", error);
            throw new Error(`Failed to analyze repository: ${error.message}`);
        }
    }
}

// Function to initialize the analyzer
function initializeAnalyzer() {
    console.log('[TemplateAnalyzer] Initializing analyzer with GitHub client:', {
        clientInitialized: !!window.GitHubClient,
        authenticated: window.GitHubClient?.auth?.isAuthenticated() || false
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
    console.log('[TemplateAnalyzer] GitHub client not available yet, waiting 1 second before initializing');
    setTimeout(initializeAnalyzer, 1000); // 1 second delay
}

// Add a listener for when the GitHub client becomes authenticated
document.addEventListener('github-auth-changed', () => {
    console.log('[TemplateAnalyzer] GitHub auth changed, re-initializing analyzer');
    initializeAnalyzer();
});

// Add extra initialization safety checks
window.checkAnalyzerReady = function() {
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
