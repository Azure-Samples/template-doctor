window.reportData = {
  "repoUrl": "https://github.com/anfibiacreativa/openai-langchainjs",
  "timestamp": "2025-07-25T07:37:50.279Z",
  "compliance": {
    "issues": [
      {
        "id": "missing-workflow-\\.github\\/workflows\\/template-validation\\.(yaml|yml)$",
        "severity": "error",
        "message": "Missing required workflow: .github/workflows/template-validation.yaml (or .yml)",
        "error": "Missing required workflow: .github/workflows/template-validation.yaml (or .yml)"
      },
      {
        "id": "missing-workflow-\\.github\\/workflows\\/azure-dev\\.(yaml|yml)$",
        "severity": "error",
        "message": "Missing required workflow: .github/workflows/azure-dev.yaml (or .yml)",
        "error": "Missing required workflow: .github/workflows/azure-dev.yaml (or .yml)"
      },
      {
        "id": "missing-folder-.github/workflows",
        "severity": "error",
        "message": "Missing required folder: .github/workflows/",
        "error": "Folder .github/workflows not found in repository"
      },
      {
        "id": "missing-folder-.github/ISSUE_TEMPLATE",
        "severity": "error",
        "message": "Missing required folder: .github/ISSUE_TEMPLATE/",
        "error": "Folder .github/ISSUE_TEMPLATE not found in repository"
      },
      {
        "id": "readme-missing-heading-features",
        "severity": "error",
        "message": "README.md is missing required h2 heading: Features",
        "error": "README.md does not contain required h2 heading: Features"
      },
      {
        "id": "readme-missing-heading-getting-started",
        "severity": "error",
        "message": "README.md is missing required h2 heading: Getting Started",
        "error": "README.md does not contain required h2 heading: Getting Started"
      },
      {
        "id": "readme-missing-heading-guidance",
        "severity": "error",
        "message": "README.md is missing required h2 heading: Guidance",
        "error": "README.md does not contain required h2 heading: Guidance"
      },
      {
        "id": "readme-missing-architecture-diagram-heading",
        "severity": "error",
        "message": "README.md is missing required h2 heading: Architecture Diagram",
        "error": "README.md does not contain required h2 heading: Architecture Diagram"
      },
      {
        "id": "bicep-missing-microsoft.identity",
        "severity": "error",
        "message": "Missing resource \"Microsoft.Identity\" in infra/core/ai/cognitiveservices.bicep",
        "error": "File infra/core/ai/cognitiveservices.bicep does not contain required resource Microsoft.Identity"
      },
      {
        "id": "bicep-missing-microsoft.identity",
        "severity": "error",
        "message": "Missing resource \"Microsoft.Identity\" in infra/core/security/role.bicep",
        "error": "File infra/core/security/role.bicep does not contain required resource Microsoft.Identity"
      },
      {
        "id": "bicep-missing-microsoft.identity",
        "severity": "error",
        "message": "Missing resource \"Microsoft.Identity\" in infra/main.bicep",
        "error": "File infra/main.bicep does not contain required resource Microsoft.Identity"
      },
      {
        "id": "azure-yaml-missing-services",
        "severity": "error",
        "message": "No \"services:\" defined in azure.yaml",
        "error": "File azure.yaml does not define required \"services:\" section"
      }
    ],
    "compliant": [
      {
        "id": "file-azure.yaml",
        "category": "requiredFile",
        "message": "Required file found: azure.yaml",
        "details": {
          "fileName": "azure.yaml"
        }
      },
      {
        "id": "file-README.md",
        "category": "requiredFile",
        "message": "Required file found: README.md",
        "details": {
          "fileName": "README.md"
        }
      },
      {
        "id": "file-.devcontainer/devcontainer.json",
        "category": "requiredFile",
        "message": "Required file found: .devcontainer/devcontainer.json",
        "details": {
          "fileName": ".devcontainer/devcontainer.json"
        }
      },
      {
        "id": "doc-^CODE_OF_CONDUCT\\.md$",
        "category": "requiredDocumentation",
        "message": "Required documentation file found: code_of_conduct.md",
        "details": {
          "fileName": "code_of_conduct.md",
          "allMatches": [
            "code_of_conduct.md"
          ]
        }
      },
      {
        "id": "doc-^CONTRIBUTING\\.md$",
        "category": "requiredDocumentation",
        "message": "Required documentation file found: contributing.md",
        "details": {
          "fileName": "contributing.md",
          "allMatches": [
            "contributing.md"
          ]
        }
      },
      {
        "id": "folder-src",
        "category": "requiredFolder",
        "message": "Required folder found: src/",
        "details": {
          "folderPath": "src",
          "fileCount": 3
        }
      },
      {
        "id": "folder-infra",
        "category": "requiredFolder",
        "message": "Required folder found: infra/",
        "details": {
          "folderPath": "infra",
          "fileCount": 8
        }
      },
      {
        "id": "readme-heading-resources",
        "category": "readmeHeading",
        "message": "README.md contains required h2 heading: Resources",
        "details": {
          "heading": "Resources",
          "level": 2
        }
      },
      {
        "id": "bicep-files-exist",
        "category": "bicepFiles",
        "message": "Bicep files found in infra/ directory: 3 files",
        "details": {
          "count": 3,
          "files": [
            "infra/core/ai/cognitiveservices.bicep",
            "infra/core/security/role.bicep",
            "infra/main.bicep"
          ]
        }
      },
      {
        "id": "bicep-no-deprecated-models-infra/core/ai/cognitiveservices.bicep",
        "category": "bicepOpenAIModels",
        "message": "No deprecated OpenAI models found in infra/core/ai/cognitiveservices.bicep",
        "details": {
          "file": "infra/core/ai/cognitiveservices.bicep"
        }
      },
      {
        "id": "bicep-no-deprecated-models-infra/core/security/role.bicep",
        "category": "bicepOpenAIModels",
        "message": "No deprecated OpenAI models found in infra/core/security/role.bicep",
        "details": {
          "file": "infra/core/security/role.bicep"
        }
      },
      {
        "id": "bicep-no-deprecated-models-infra/main.bicep",
        "category": "bicepOpenAIModels",
        "message": "No deprecated OpenAI models found in infra/main.bicep",
        "details": {
          "file": "infra/main.bicep"
        }
      },
      {
        "id": "azure-yaml-exists",
        "category": "azureYaml",
        "message": "Found azure.yaml file: azure.yaml",
        "details": {
          "fileName": "azure.yaml"
        }
      },
      {
        "id": "compliance-summary",
        "category": "meta",
        "message": "Compliance: 52%",
        "details": {
          "issueCount": 12,
          "compliantCount": 13,
          "totalChecks": 25,
          "percentageCompliant": 52
        }
      }
    ],
    "summary": "Issues found - Compliance: 52%"
  },
  "history": [
    {
      "timestamp": "2025-07-25T07:37:50.279Z",
      "percentage": 52,
      "issues": 12,
      "passed": 13,
      "dashboardPath": "1753429070299-dashboard.html"
    }
  ]
};