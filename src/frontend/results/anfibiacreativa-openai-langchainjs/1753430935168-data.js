window.reportData = {
  "repoUrl": "https://github.com/anfibiacreativa/openai-langchainjs",
  "ruleSet": "partner",
  "timestamp": "2025-07-25T08:08:55.163Z",
  "compliance": {
    "issues": [
      {
        "id": "missing-workflow-\\.github\\/workflows\\/azure-dev\\.(yaml|yml)$",
        "severity": "error",
        "message": "Missing required workflow: .github/workflows/azure-dev.yaml (or .yml)",
        "error": "Missing required workflow: .github/workflows/azure-dev.yaml (or .yml)"
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
        "message": "Compliance: 60%",
        "details": {
          "issueCount": 6,
          "compliantCount": 9,
          "totalChecks": 15,
          "percentageCompliant": 60
        }
      }
    ],
    "summary": "Issues found - Compliance: 60%"
  },
  "history": [
    {
      "timestamp": "2025-07-25T07:37:50.279Z",
      "percentage": 52,
      "issues": 12,
      "passed": 13,
      "dashboardPath": "1753429070299-dashboard.html"
    },
    {
      "timestamp": "2025-07-25T08:08:55.163Z",
      "ruleSet": "partner",
      "percentage": 60,
      "issues": 6,
      "passed": 9,
      "dashboardPath": "1753430935168-dashboard.html"
    }
  ]
};