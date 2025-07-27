import { TemplateConfig } from './config-types.js';

/**
 * Custom rules configuration
 * 
 * Your custom config goes here.
 * Modify this file to create your own custom validation rules.
 */
const config: TemplateConfig = {
  requiredFiles: [
    "azure.yaml",
    "README.md",
    // Add your own required files here
  ],
  requiredFolders: [
    ".github/workflows",
    "src",
    "infra",
    // Add your own required folders here
  ],
  requiredWorkflowFiles: [
    {
      pattern: /\.github\/workflows\/azure-dev\.(yaml|yml)$/i,
      message: "Missing required workflow: .github/workflows/azure-dev.yaml (or .yml)"
    },
    // Add your own required workflow files here
  ],
  requiredDocFiles: [
    // Add your own required documentation files here
  ],
  readmeRequirements: {
    requiredHeadings: [
      // Add your required README headings here
    ],
    architectureDiagram: {
      heading: "Architecture Diagram",
      requiresImage: false // Set to true if you want to require images
    }
  },
  bicepChecks: {
    requiredResources: [
      // Add your required Bicep resources here
    ]
  },
  azureYamlRules: {
    mustDefineServices: true // Set to false if you don't require services defined
  },
  openai: {
    deprecatedModels: [
      // Add deprecated models you want to flag
    ]
  }
};

export default config;
