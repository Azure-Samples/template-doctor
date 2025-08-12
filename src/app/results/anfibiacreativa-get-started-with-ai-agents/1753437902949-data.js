window.reportData = {
  "repoUrl": "https://github.com/anfibiacreativa/get-started-with-ai-agents",
  "ruleSet": "partner",
  "timestamp": "2025-07-25T10:05:02.940Z",
  "compliance": {
    "issues": [
      {
        "id": "readme-missing-architecture-diagram-heading",
        "severity": "error",
        "message": "README.md is missing required h2 heading: Architecture Diagram",
        "error": "README.md does not contain required h2 heading: Architecture Diagram"
      },
      {
        "id": "bicep-missing-microsoft.identity",
        "severity": "error",
        "message": "Missing resource \"Microsoft.Identity\" in infra/api.bicep",
        "error": "File infra/api.bicep does not contain required resource Microsoft.Identity"
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
        "message": "Missing resource \"Microsoft.Identity\" in infra/core/host/ai-environment.bicep",
        "error": "File infra/core/host/ai-environment.bicep does not contain required resource Microsoft.Identity"
      },
      {
        "id": "bicep-missing-microsoft.identity",
        "severity": "error",
        "message": "Missing resource \"Microsoft.Identity\" in infra/core/host/container-app-upsert.bicep",
        "error": "File infra/core/host/container-app-upsert.bicep does not contain required resource Microsoft.Identity"
      },
      {
        "id": "bicep-missing-microsoft.identity",
        "severity": "error",
        "message": "Missing resource \"Microsoft.Identity\" in infra/core/host/container-app.bicep",
        "error": "File infra/core/host/container-app.bicep does not contain required resource Microsoft.Identity"
      },
      {
        "id": "bicep-missing-microsoft.identity",
        "severity": "error",
        "message": "Missing resource \"Microsoft.Identity\" in infra/core/host/container-apps-environment.bicep",
        "error": "File infra/core/host/container-apps-environment.bicep does not contain required resource Microsoft.Identity"
      },
      {
        "id": "bicep-missing-microsoft.identity",
        "severity": "error",
        "message": "Missing resource \"Microsoft.Identity\" in infra/core/host/container-apps.bicep",
        "error": "File infra/core/host/container-apps.bicep does not contain required resource Microsoft.Identity"
      },
      {
        "id": "bicep-missing-microsoft.identity",
        "severity": "error",
        "message": "Missing resource \"Microsoft.Identity\" in infra/core/host/container-registry.bicep",
        "error": "File infra/core/host/container-registry.bicep does not contain required resource Microsoft.Identity"
      },
      {
        "id": "bicep-missing-microsoft.identity",
        "severity": "error",
        "message": "Missing resource \"Microsoft.Identity\" in infra/core/monitor/applicationinsights-dashboard.bicep",
        "error": "File infra/core/monitor/applicationinsights-dashboard.bicep does not contain required resource Microsoft.Identity"
      },
      {
        "id": "bicep-missing-microsoft.identity",
        "severity": "error",
        "message": "Missing resource \"Microsoft.Identity\" in infra/core/monitor/applicationinsights.bicep",
        "error": "File infra/core/monitor/applicationinsights.bicep does not contain required resource Microsoft.Identity"
      },
      {
        "id": "bicep-missing-microsoft.identity",
        "severity": "error",
        "message": "Missing resource \"Microsoft.Identity\" in infra/core/monitor/loganalytics.bicep",
        "error": "File infra/core/monitor/loganalytics.bicep does not contain required resource Microsoft.Identity"
      },
      {
        "id": "bicep-missing-microsoft.identity",
        "severity": "error",
        "message": "Missing resource \"Microsoft.Identity\" in infra/core/search/search-services.bicep",
        "error": "File infra/core/search/search-services.bicep does not contain required resource Microsoft.Identity"
      },
      {
        "id": "bicep-missing-microsoft.identity",
        "severity": "error",
        "message": "Missing resource \"Microsoft.Identity\" in infra/core/security/appinsights-access.bicep",
        "error": "File infra/core/security/appinsights-access.bicep does not contain required resource Microsoft.Identity"
      },
      {
        "id": "bicep-missing-microsoft.identity",
        "severity": "error",
        "message": "Missing resource \"Microsoft.Identity\" in infra/core/security/registry-access.bicep",
        "error": "File infra/core/security/registry-access.bicep does not contain required resource Microsoft.Identity"
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
        "message": "Missing resource \"Microsoft.Identity\" in infra/core/storage/storage-account.bicep",
        "error": "File infra/core/storage/storage-account.bicep does not contain required resource Microsoft.Identity"
      },
      {
        "id": "bicep-missing-microsoft.identity",
        "severity": "error",
        "message": "Missing resource \"Microsoft.Identity\" in infra/main.bicep",
        "error": "File infra/main.bicep does not contain required resource Microsoft.Identity"
      },
      {
        "id": "bicep-deprecated-model-gpt-4",
        "severity": "error",
        "message": "Deprecated OpenAI model \"gpt-4\" used in infra/main.bicep",
        "error": "File infra/main.bicep contains deprecated model gpt-4"
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
        "id": "workflow-.github/workflows/azure-dev.yml",
        "category": "requiredWorkflow",
        "message": "Required workflow file found: .github/workflows/azure-dev.yml",
        "details": {
          "fileName": ".github/workflows/azure-dev.yml",
          "patternMatched": "\\.github\\/workflows\\/azure-dev\\.(yaml|yml)$"
        }
      },
      {
        "id": "folder-src",
        "category": "requiredFolder",
        "message": "Required folder found: src/",
        "details": {
          "folderPath": "src",
          "fileCount": 135
        }
      },
      {
        "id": "folder-infra",
        "category": "requiredFolder",
        "message": "Required folder found: infra/",
        "details": {
          "folderPath": "infra",
          "fileCount": 27
        }
      },
      {
        "id": "bicep-files-exist",
        "category": "bicepFiles",
        "message": "Bicep files found in infra/ directory: 17 files",
        "details": {
          "count": 17,
          "files": [
            "infra/api.bicep",
            "infra/core/ai/cognitiveservices.bicep",
            "infra/core/host/ai-environment.bicep",
            "infra/core/host/container-app-upsert.bicep",
            "infra/core/host/container-app.bicep",
            "infra/core/host/container-apps-environment.bicep",
            "infra/core/host/container-apps.bicep",
            "infra/core/host/container-registry.bicep",
            "infra/core/monitor/applicationinsights-dashboard.bicep",
            "infra/core/monitor/applicationinsights.bicep",
            "infra/core/monitor/loganalytics.bicep",
            "infra/core/search/search-services.bicep",
            "infra/core/security/appinsights-access.bicep",
            "infra/core/security/registry-access.bicep",
            "infra/core/security/role.bicep",
            "infra/core/storage/storage-account.bicep",
            "infra/main.bicep"
          ]
        }
      },
      {
        "id": "bicep-no-deprecated-models-infra/api.bicep",
        "category": "bicepOpenAIModels",
        "message": "No deprecated OpenAI models found in infra/api.bicep",
        "details": {
          "file": "infra/api.bicep"
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
        "id": "bicep-no-deprecated-models-infra/core/host/ai-environment.bicep",
        "category": "bicepOpenAIModels",
        "message": "No deprecated OpenAI models found in infra/core/host/ai-environment.bicep",
        "details": {
          "file": "infra/core/host/ai-environment.bicep"
        }
      },
      {
        "id": "bicep-no-deprecated-models-infra/core/host/container-app-upsert.bicep",
        "category": "bicepOpenAIModels",
        "message": "No deprecated OpenAI models found in infra/core/host/container-app-upsert.bicep",
        "details": {
          "file": "infra/core/host/container-app-upsert.bicep"
        }
      },
      {
        "id": "bicep-no-deprecated-models-infra/core/host/container-app.bicep",
        "category": "bicepOpenAIModels",
        "message": "No deprecated OpenAI models found in infra/core/host/container-app.bicep",
        "details": {
          "file": "infra/core/host/container-app.bicep"
        }
      },
      {
        "id": "bicep-no-deprecated-models-infra/core/host/container-apps-environment.bicep",
        "category": "bicepOpenAIModels",
        "message": "No deprecated OpenAI models found in infra/core/host/container-apps-environment.bicep",
        "details": {
          "file": "infra/core/host/container-apps-environment.bicep"
        }
      },
      {
        "id": "bicep-no-deprecated-models-infra/core/host/container-apps.bicep",
        "category": "bicepOpenAIModels",
        "message": "No deprecated OpenAI models found in infra/core/host/container-apps.bicep",
        "details": {
          "file": "infra/core/host/container-apps.bicep"
        }
      },
      {
        "id": "bicep-no-deprecated-models-infra/core/host/container-registry.bicep",
        "category": "bicepOpenAIModels",
        "message": "No deprecated OpenAI models found in infra/core/host/container-registry.bicep",
        "details": {
          "file": "infra/core/host/container-registry.bicep"
        }
      },
      {
        "id": "bicep-no-deprecated-models-infra/core/monitor/applicationinsights-dashboard.bicep",
        "category": "bicepOpenAIModels",
        "message": "No deprecated OpenAI models found in infra/core/monitor/applicationinsights-dashboard.bicep",
        "details": {
          "file": "infra/core/monitor/applicationinsights-dashboard.bicep"
        }
      },
      {
        "id": "bicep-no-deprecated-models-infra/core/monitor/applicationinsights.bicep",
        "category": "bicepOpenAIModels",
        "message": "No deprecated OpenAI models found in infra/core/monitor/applicationinsights.bicep",
        "details": {
          "file": "infra/core/monitor/applicationinsights.bicep"
        }
      },
      {
        "id": "bicep-no-deprecated-models-infra/core/monitor/loganalytics.bicep",
        "category": "bicepOpenAIModels",
        "message": "No deprecated OpenAI models found in infra/core/monitor/loganalytics.bicep",
        "details": {
          "file": "infra/core/monitor/loganalytics.bicep"
        }
      },
      {
        "id": "bicep-no-deprecated-models-infra/core/search/search-services.bicep",
        "category": "bicepOpenAIModels",
        "message": "No deprecated OpenAI models found in infra/core/search/search-services.bicep",
        "details": {
          "file": "infra/core/search/search-services.bicep"
        }
      },
      {
        "id": "bicep-no-deprecated-models-infra/core/security/appinsights-access.bicep",
        "category": "bicepOpenAIModels",
        "message": "No deprecated OpenAI models found in infra/core/security/appinsights-access.bicep",
        "details": {
          "file": "infra/core/security/appinsights-access.bicep"
        }
      },
      {
        "id": "bicep-no-deprecated-models-infra/core/security/registry-access.bicep",
        "category": "bicepOpenAIModels",
        "message": "No deprecated OpenAI models found in infra/core/security/registry-access.bicep",
        "details": {
          "file": "infra/core/security/registry-access.bicep"
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
        "id": "bicep-no-deprecated-models-infra/core/storage/storage-account.bicep",
        "category": "bicepOpenAIModels",
        "message": "No deprecated OpenAI models found in infra/core/storage/storage-account.bicep",
        "details": {
          "file": "infra/core/storage/storage-account.bicep"
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
        "message": "Compliance: 56%",
        "details": {
          "issueCount": 19,
          "compliantCount": 24,
          "totalChecks": 43,
          "percentageCompliant": 56
        }
      }
    ],
    "summary": "Issues found - Compliance: 56%"
  },
  "history": [
    {
      "timestamp": "2025-07-25T08:52:31.277Z",
      "ruleSet": "partner",
      "percentage": 56,
      "issues": 19,
      "passed": 24,
      "dashboardPath": "1753433551287-dashboard.html"
    },
    {
      "timestamp": "2025-07-25T09:38:35.472Z",
      "ruleSet": "partner",
      "percentage": 56,
      "issues": 19,
      "passed": 24,
      "dashboardPath": "1753436315476-dashboard.html"
    },
    {
      "timestamp": "2025-07-25T10:05:02.940Z",
      "ruleSet": "partner",
      "percentage": 56,
      "issues": 19,
      "passed": 24,
      "dashboardPath": "1753437902949-dashboard.html"
    }
  ]
};