import { listRepoFiles, fetchFileContent, getDefaultBranch } from "./githubClient.js";
import dodRulesConfig from "./config/dod-rules.js";
import partnerRulesConfig from "./config/partner-rules.js";
import customRulesConfig from "./config/custom-rules.js";
import { TemplateConfig } from "./config/config-types.js";

// Define valid rule sets
export type RuleSet = "dod" | "partner" | "custom";

type Issue = { id: string; severity: "error" | "warning"; message: string, error?: string };
type ReadmeHeading = { level: number; text: string; hasImage?: boolean };

type ComplianceItem = { 
  id: string; 
  category: string; 
  message: string;
  details?: any;
};

/**
 * Get the appropriate configuration based on the selected rule set
 * @param ruleSet The rule set to use: "dod", "partner", or "custom"
 * @returns The configuration for the selected rule set
 */
function getConfig(ruleSet: RuleSet = "dod"): TemplateConfig {
  switch (ruleSet) {
    case "partner":
      return partnerRulesConfig;
    case "custom":
      return customRulesConfig;
    case "dod":
    default:
      return dodRulesConfig;
  }
}

export async function analyzeTemplate(repoUrl: string, ruleSet: RuleSet = "dod"): Promise<{
  repoUrl: string;
  ruleSet: RuleSet;
  timestamp: string;
  compliance: {
    issues: Issue[];
    compliant: ComplianceItem[];
    summary: string;
  };
}> {
  // Get the appropriate configuration based on the rule set
  const config = getConfig(ruleSet);
  const repoFullName = extractRepoFullName(repoUrl);
  const defaultBranch = await getDefaultBranch(repoFullName);
  const files = await listRepoFiles(repoFullName, defaultBranch);
  const issues: Issue[] = [];
  const compliant: ComplianceItem[] = [];

  const normalized = files.map((f) => f.toLowerCase());

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

  // Check for required documentation files that can exist in multiple locations
  if (config.requiredDocFiles) {
    for (const docFile of config.requiredDocFiles) {
      const matchingFiles = normalized.filter(file => 
        docFile.patterns.some((pattern: RegExp) => pattern.test(file))
      );
      
      if (matchingFiles.length === 0) {
        issues.push({
          id: `missing-doc-${docFile.patterns[0].source}`,
          severity: "error",
          message: docFile.message,
          error: docFile.message
        });
      } else {
        compliant.push({
          id: `doc-${docFile.patterns[0].source}`,
          category: "requiredDocumentation",
          message: `Required documentation file found: ${matchingFiles[0]}`,
          details: {
            fileName: matchingFiles[0],
            allMatches: matchingFiles
          }
        });
      }
    }
  }

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
      const readmeContent = await fetchFileContent(repoFullName, "README.md", defaultBranch);
      await checkReadmeRequirements(readmeContent, issues, compliant, config);
    } catch (err) {
      issues.push({
        id: "readme-read-error",
        severity: "warning",
        message: "Could not read README.md",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  const deprecatedModels = config.openai?.deprecatedModels ?? [];

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
    
    for (const file of bicepFiles) {
      try {
        const content = await fetchFileContent(repoFullName, file, defaultBranch);
        
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
        
        // Check for deprecated models
        let usesDeprecatedModels = false;
        const foundDeprecatedModels = [];
        
        for (const model of deprecatedModels) {
          const modelRegex = new RegExp(`["']?${model}["']?`, "i");
          if (modelRegex.test(content)) {
            issues.push({
              id: `bicep-deprecated-model-${model}`,
              severity: "error",
              message: `Deprecated OpenAI model "${model}" used in ${file}`,
              error: `File ${file} contains deprecated model ${model}`
            });
            usesDeprecatedModels = true;
            foundDeprecatedModels.push(model);
          }
        }
        
        if (!usesDeprecatedModels) {
          compliant.push({
            id: `bicep-no-deprecated-models-${file}`,
            category: "bicepOpenAIModels",
            message: `No deprecated OpenAI models found in ${file}`,
            details: {
              file: file
            }
          });
        }
      } catch(err) {
        console.error(`Failed to read Bicep file: ${file}`);
        console.error(`Error: ${err instanceof Error ? err.message : err}  `);
        issues.push({
          id: `error-reading-${file}`,
          severity: "warning",
          message: `Failed to read ${file}`,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }
  }

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
      const azureYamlContent = await fetchFileContent(repoFullName, azureYamlPath, defaultBranch);
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

  const summary = issues.length === 0 ? "No issues found 🎉" : "Issues found";
  
  // Calculate compliance percentages
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
}

function extractRepoFullName(url: string): string {
  const match = url.match(/github\.com\/([^/]+\/[^/]+)(\.git)?/);
  if (!match) throw new Error("Invalid GitHub URL");
  return match[1];
}

/**
 * Parses markdown content and extracts headings with their levels
 * @param markdown Markdown content
 * @returns Array of headings with their levels and texts
 */
function parseMarkdownHeadings(markdown: string): ReadmeHeading[] {
  const headings: ReadmeHeading[] = [];
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
 * @param readmeContent README.md content
 * @param issues Array to add issues to
 * @param compliant Array to add compliant items to
 * @param config The configuration to use for the analysis
 */
async function checkReadmeRequirements(readmeContent: string, issues: Issue[], compliant: ComplianceItem[], config: TemplateConfig): Promise<void> {
  const headings = parseMarkdownHeadings(readmeContent);
  
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
