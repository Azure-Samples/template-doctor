import { TemplateConfig } from './config-types.js';

const config: TemplateConfig = {
  requiredFiles: [
    "azure.yaml",
    "README.md",
    ".devcontainer/devcontainer.json"
  ],
  requiredFolders: [
    ".github/workflows",
    ".github/ISSUE_TEMPLATE",
    "src",
    "infra"
  ],
  requiredWorkflowFiles: [
    {
      pattern: /\.github\/workflows\/template-validation\.(yaml|yml)$/i,
      message: "Missing required workflow: .github/workflows/template-validation.yaml (or .yml)"
    },
    {
      pattern: /\.github\/workflows\/azure-dev\.(yaml|yml)$/i,
      message: "Missing required workflow: .github/workflows/azure-dev.yaml (or .yml)"
    }
  ],
  requiredDocFiles: [
    {
      patterns: [
        /^CODE_OF_CONDUCT\.md$/i,
        /^\.github\/CODE_OF_CONDUCT\.md$/i
      ],
      message: "Missing required file: CODE_OF_CONDUCT.md (should be in root or .github folder)"
    },
    {
      patterns: [
        /^CONTRIBUTING\.md$/i,
        /^\.github\/CONTRIBUTING\.md$/i
      ],
      message: "Missing required file: CONTRIBUTING.md (should be in root or .github folder)"
    }
  ],
  readmeRequirements: {
    requiredHeadings: [
      "Features",
      "Getting Started",
      "Resources",
      "Guidance"
    ],
    architectureDiagram: {
      heading: "Architecture Diagram",
      requiresImage: true
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
