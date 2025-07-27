window.reportData = {
  "repoUrl": "https://github.com/anfibiacreativa/todo-nodejs-mongo-coreconf",
  "timestamp": "2025-07-24T13:17:10.014Z",
  "compliance": {
    "issues": [
      {
        "id": "missing-workflow-\\.github\\/workflows\\/template-validation\\.(yaml|yml)$",
        "severity": "error",
        "message": "Missing required workflow: .github/workflows/template-validation.yaml (or .yml)",
        "error": "Missing required workflow: .github/workflows/template-validation.yaml (or .yml)"
      },
      {
        "id": "missing-doc-^CODE_OF_CONDUCT\\.md$",
        "severity": "error",
        "message": "Missing required file: CODE_OF_CONDUCT.md (should be in root or .github folder)",
        "error": "Missing required file: CODE_OF_CONDUCT.md (should be in root or .github folder)"
      },
      {
        "id": "missing-doc-^CONTRIBUTING\\.md$",
        "severity": "error",
        "message": "Missing required file: CONTRIBUTING.md (should be in root or .github folder)",
        "error": "Missing required file: CONTRIBUTING.md (should be in root or .github folder)"
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
        "id": "readme-missing-heading-resources",
        "severity": "error",
        "message": "README.md is missing required h2 heading: Resources",
        "error": "README.md does not contain required h2 heading: Resources"
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
        "message": "Missing resource \"Microsoft.Identity\" in infra/applicationinsights.bicep",
        "error": "File infra/applicationinsights.bicep does not contain required resource Microsoft.Identity"
      },
      {
        "id": "bicep-missing-microsoft.identity",
        "severity": "error",
        "message": "Missing resource \"Microsoft.Identity\" in infra/main.bicep",
        "error": "File infra/main.bicep does not contain required resource Microsoft.Identity"
      },
      {
        "id": "bicep-missing-microsoft.identity",
        "severity": "error",
        "message": "Missing resource \"Microsoft.Identity\" in infra/resources.bicep",
        "error": "File infra/resources.bicep does not contain required resource Microsoft.Identity"
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
        "id": "workflow-.github/workflows/azure-dev.yml",
        "category": "requiredWorkflow",
        "message": "Required workflow file found: .github/workflows/azure-dev.yml",
        "details": {
          "fileName": ".github/workflows/azure-dev.yml",
          "patternMatched": "\\.github\\/workflows\\/azure-dev\\.(yaml|yml)$"
        }
      },
      {
        "id": "folder-.github/workflows",
        "category": "requiredFolder",
        "message": "Required folder found: .github/workflows/",
        "details": {
          "folderPath": ".github/workflows",
          "fileCount": 1
        }
      },
      {
        "id": "folder-src",
        "category": "requiredFolder",
        "message": "Required folder found: src/",
        "details": {
          "folderPath": "src",
          "fileCount": 98
        }
      },
      {
        "id": "folder-infra",
        "category": "requiredFolder",
        "message": "Required folder found: infra/",
        "details": {
          "folderPath": "infra",
          "fileCount": 5
        }
      },
      {
        "id": "bicep-files-exist",
        "category": "bicepFiles",
        "message": "Bicep files found in infra/ directory: 3 files",
        "details": {
          "count": 3,
          "files": [
            "infra/applicationinsights.bicep",
            "infra/main.bicep",
            "infra/resources.bicep"
          ]
        }
      },
      {
        "id": "bicep-no-deprecated-models-infra/applicationinsights.bicep",
        "category": "bicepOpenAIModels",
        "message": "No deprecated OpenAI models found in infra/applicationinsights.bicep",
        "details": {
          "file": "infra/applicationinsights.bicep"
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
        "id": "bicep-no-deprecated-models-infra/resources.bicep",
        "category": "bicepOpenAIModels",
        "message": "No deprecated OpenAI models found in infra/resources.bicep",
        "details": {
          "file": "infra/resources.bicep"
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
        "id": "azure-yaml-services-defined",
        "category": "azureYaml",
        "message": "\"services:\" section found in azure.yaml",
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
      "timestamp": "2025-07-21T15:38:52.047Z",
      "percentage": 52,
      "issues": 12,
      "passed": 13,
      "dashboardPath": "1753112332056-dashboard.html"
    },
    {
      "timestamp": "2025-07-21T15:40:59.280Z",
      "percentage": 52,
      "issues": 12,
      "passed": 13,
      "dashboardPath": "1753112459289-dashboard.html"
    },
    {
      "timestamp": "2025-07-21T15:43:11.795Z",
      "percentage": 52,
      "issues": 12,
      "passed": 13,
      "dashboardPath": "1753112591805-dashboard.html"
    },
    {
      "timestamp": "2025-07-21T15:56:16.991Z",
      "percentage": 52,
      "issues": 12,
      "passed": 13,
      "dashboardPath": "1753113376997-dashboard.html"
    },
    {
      "timestamp": "2025-07-21T15:59:34.473Z",
      "percentage": 52,
      "issues": 12,
      "passed": 13,
      "dashboardPath": "1753113574479-dashboard.html"
    },
    {
      "timestamp": "2025-07-21T16:03:06.029Z",
      "percentage": 52,
      "issues": 12,
      "passed": 13,
      "dashboardPath": "1753113786034-dashboard.html"
    },
    {
      "timestamp": "2025-07-24T12:25:48.520Z",
      "percentage": 52,
      "issues": 12,
      "passed": 13,
      "dashboardPath": "1753359948530-dashboard.html"
    },
    {
      "timestamp": "2025-07-24T12:49:04.170Z",
      "percentage": 52,
      "issues": 12,
      "passed": 13,
      "dashboardPath": "1753361344179-dashboard.html"
    },
    {
      "timestamp": "2025-07-24T12:50:51.796Z",
      "percentage": 52,
      "issues": 12,
      "passed": 13,
      "dashboardPath": "1753361451807-dashboard.html"
    },
    {
      "timestamp": "2025-07-24T13:17:10.014Z",
      "percentage": 52,
      "issues": 12,
      "passed": 13,
      "dashboardPath": "1753363030048-dashboard.html"
    }
  ]
};