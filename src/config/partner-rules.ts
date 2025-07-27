import { TemplateConfig } from './config-types.js';

/**
 * Partner rules configuration - focuses only on infrastructure checks
 * without documentation requirements
 */
const config: TemplateConfig = {
  requiredFiles: [
    "azure.yaml",
    "README.md",
  ],
  requiredFolders: [
    "src",
    "infra"
  ],
  requiredWorkflowFiles: [
    {
      pattern: /\.github\/workflows\/azure-dev\.(yaml|yml)$/i,
      message: "Missing required workflow: .github/workflows/azure-dev.yaml (or .yml)"
    }
  ],
  requiredDocFiles: [], // No documentation requirements
  readmeRequirements: {
    requiredHeadings: [], // No specific headings required
    architectureDiagram: {
      heading: "Architecture Diagram",
      requiresImage: false // Not requiring images
    }
  },
  bicepChecks: {
    requiredResources: [
      "Microsoft.Identity"
    ]
  },
  azureYamlRules: {
    mustDefineServices: true
  },
  openai: {
    deprecatedModels: [
      "gpt-35-turbo",
      "gpt-4",
      "gpt-4-32k",
      "text-embedding-ada-002"
    ]
  }
};

export default config;
