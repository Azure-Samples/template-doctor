window.templateData = {
  "compliance": {
    "compliant": [
      {
        "category": "requiredFile",
        "details": {
          "fileName": "README.md"
        },
        "id": "file-README.md",
        "message": "Required file found: README.md"
      },
      {
        "category": "requiredFile",
        "details": {
          "fileName": "azure.yaml"
        },
        "id": "file-azure.yaml",
        "message": "Required file found: azure.yaml"
      },
      {
        "category": "requiredFolder",
        "details": {
          "fileCount": 17,
          "folderPath": "infra"
        },
        "id": "folder-infra",
        "message": "Required folder found: infra/"
      },
      {
        "category": "requiredFolder",
        "details": {
          "fileCount": 12,
          "folderPath": ".github"
        },
        "id": "folder-.github",
        "message": "Required folder found: .github/"
      },
      {
        "category": "readmeHeading",
        "details": {
          "heading": "Getting Started",
          "level": 2
        },
        "id": "readme-heading-getting-started",
        "message": "README.md contains required h2 heading: Getting Started"
      },
      {
        "category": "bicepFiles",
        "details": {
          "count": 16,
          "files": [
            "infra/backend-dashboard.bicep",
            "infra/core/ai/ai-foundry.bicep",
            "infra/core/ai/cognitiveservices.bicep",
            "infra/core/database/postgresql/flexibleserver.bicep",
            "infra/core/host/container-app-upsert.bicep",
            "infra/core/host/container-app.bicep",
            "infra/core/host/container-apps-environment.bicep",
            "infra/core/host/container-apps.bicep",
            "infra/core/host/container-registry.bicep",
            "infra/core/monitor/applicationinsights.bicep",
            "infra/core/monitor/loganalytics.bicep",
            "infra/core/monitor/monitoring.bicep",
            "infra/core/security/registry-access.bicep",
            "infra/core/security/role.bicep",
            "infra/main.bicep",
            "infra/web.bicep"
          ]
        },
        "id": "bicep-files-exist",
        "message": "Bicep files found in infra/ directory: 16 files"
      },
      {
        "category": "bicepSecurity",
        "details": {
          "authMethod": "ManagedIdentity",
          "file": "infra/core/ai/ai-foundry.bicep"
        },
        "id": "bicep-uses-managed-identity-infra/core/ai/ai-foundry.bicep",
        "message": "Good practice: infra/core/ai/ai-foundry.bicep uses Managed Identity for Azure authentication"
      },
      {
        "category": "bicepResource",
        "details": {
          "file": "infra/main.bicep",
          "resource": "Microsoft.Resources/resourceGroups"
        },
        "id": "bicep-resource-microsoft.resources/resourcegroups-infra/main.bicep",
        "message": "Found required resource \"Microsoft.Resources/resourceGroups\" in infra/main.bicep"
      },
      {
        "category": "azureYaml",
        "details": {
          "fileName": "azure.yaml"
        },
        "id": "azure-yaml-exists",
        "message": "Found azure.yaml file: azure.yaml"
      },
      {
        "category": "azureYaml",
        "details": {
          "fileName": "azure.yaml"
        },
        "id": "azure-yaml-services-defined",
        "message": "\"services:\" section found in azure.yaml"
      },
      {
        "category": "meta",
        "details": {
          "compliantCount": 10,
          "issueCount": 43,
          "percentageCompliant": 19,
          "totalChecks": 53
        },
        "id": "compliance-summary",
        "message": "Compliance: 19%"
      }
    ],
    "issues": [
      {
        "error": "File LICENSE not found in repository",
        "id": "missing-LICENSE",
        "message": "Missing required file: LICENSE",
        "severity": "error"
      },
      {
        "error": "Missing required GitHub workflow: azure-dev.yml",
        "id": "missing-workflow-.github\\/workflows\\/azure-dev.yml",
        "message": "Missing required GitHub workflow: azure-dev.yml",
        "severity": "error"
      },
      {
        "error": "README.md does not contain required h2 heading: Prerequisites",
        "id": "readme-missing-heading-prerequisites",
        "message": "README.md is missing required h2 heading: Prerequisites",
        "severity": "error"
      },
      {
        "error": "README.md does not contain required h2 heading: Architecture",
        "id": "readme-missing-architecture-diagram-heading",
        "message": "README.md is missing required h2 heading: Architecture",
        "severity": "error"
      },
      {
        "error": "File infra/backend-dashboard.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/backend-dashboard.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/backend-dashboard.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/backend-dashboard.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/ai/ai-foundry.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/ai/ai-foundry.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/ai/ai-foundry.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/ai/ai-foundry.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/ai/cognitiveservices.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/ai/cognitiveservices.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/ai/cognitiveservices.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/ai/cognitiveservices.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/ai/cognitiveservices.bicep may have resources (Cognitive Services) with anonymous access or missing authentication",
        "id": "bicep-missing-auth-infra/core/ai/cognitiveservices.bicep",
        "message": "Security recommendation: Add Managed Identity for Cognitive Services in infra/core/ai/cognitiveservices.bicep",
        "recommendation": "Configure Managed Identity for secure access to these resources.",
        "severity": "warning"
      },
      {
        "error": "File infra/core/database/postgresql/flexibleserver.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/database/postgresql/flexibleserver.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/database/postgresql/flexibleserver.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/database/postgresql/flexibleserver.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/host/container-app-upsert.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/host/container-app-upsert.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/host/container-app-upsert.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/host/container-app-upsert.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/host/container-app.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/host/container-app.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/host/container-app.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/host/container-app.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/host/container-apps-environment.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/host/container-apps-environment.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/host/container-apps-environment.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/host/container-apps-environment.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/host/container-apps-environment.bicep may have resources (Log Analytics) with anonymous access or missing authentication",
        "id": "bicep-missing-auth-infra/core/host/container-apps-environment.bicep",
        "message": "Security recommendation: Add Managed Identity for Log Analytics in infra/core/host/container-apps-environment.bicep",
        "recommendation": "Configure Managed Identity for secure access to these resources.",
        "severity": "warning"
      },
      {
        "error": "File infra/core/host/container-apps.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/host/container-apps.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/host/container-apps.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/host/container-apps.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/host/container-registry.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/host/container-registry.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/host/container-registry.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/host/container-registry.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/host/container-registry.bicep may have resources (Container Registry) with anonymous access or missing authentication",
        "id": "bicep-missing-auth-infra/core/host/container-registry.bicep",
        "message": "Security recommendation: Add Managed Identity for Container Registry in infra/core/host/container-registry.bicep",
        "recommendation": "Configure Managed Identity for secure access to these resources.",
        "severity": "warning"
      },
      {
        "error": "File infra/core/monitor/applicationinsights.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/monitor/applicationinsights.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/monitor/applicationinsights.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/monitor/applicationinsights.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/monitor/applicationinsights.bicep uses Connection String for authentication instead of Managed Identity",
        "id": "bicep-alternative-auth-infra/core/monitor/applicationinsights.bicep",
        "message": "Security recommendation: Replace Connection String with Managed Identity in infra/core/monitor/applicationinsights.bicep",
        "recommendation": "Consider replacing Connection String with Managed Identity for better security.",
        "severity": "warning"
      },
      {
        "error": "File infra/core/monitor/loganalytics.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/monitor/loganalytics.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/monitor/loganalytics.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/monitor/loganalytics.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/monitor/loganalytics.bicep may have resources (Log Analytics) with anonymous access or missing authentication",
        "id": "bicep-missing-auth-infra/core/monitor/loganalytics.bicep",
        "message": "Security recommendation: Add Managed Identity for Log Analytics in infra/core/monitor/loganalytics.bicep",
        "recommendation": "Configure Managed Identity for secure access to these resources.",
        "severity": "warning"
      },
      {
        "error": "File infra/core/monitor/monitoring.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/monitor/monitoring.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/monitor/monitoring.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/monitor/monitoring.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/monitor/monitoring.bicep uses Connection String for authentication instead of Managed Identity",
        "id": "bicep-alternative-auth-infra/core/monitor/monitoring.bicep",
        "message": "Security recommendation: Replace Connection String with Managed Identity in infra/core/monitor/monitoring.bicep",
        "recommendation": "Consider replacing Connection String with Managed Identity for better security.",
        "severity": "warning"
      },
      {
        "error": "File infra/core/security/registry-access.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/security/registry-access.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/security/registry-access.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/security/registry-access.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/security/registry-access.bicep may have resources (Container Registry) with anonymous access or missing authentication",
        "id": "bicep-missing-auth-infra/core/security/registry-access.bicep",
        "message": "Security recommendation: Add Managed Identity for Container Registry in infra/core/security/registry-access.bicep",
        "recommendation": "Configure Managed Identity for secure access to these resources.",
        "severity": "warning"
      },
      {
        "error": "File infra/core/security/role.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/security/role.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/security/role.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/security/role.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/main.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/main.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/main.bicep uses Connection String for authentication instead of Managed Identity",
        "id": "bicep-alternative-auth-infra/main.bicep",
        "message": "Security recommendation: Replace Connection String with Managed Identity in infra/main.bicep",
        "recommendation": "Consider replacing Connection String with Managed Identity for better security.",
        "severity": "warning"
      },
      {
        "error": "File infra/web.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/web.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/web.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/web.bicep",
        "severity": "error"
      }
    ],
    "summary": "Issues found - Compliance: 19%"
  },
  "repoUrl": "https://github.com/anfibiacreativa/rag-postgres-openai-python",
  "ruleSet": "dod",
  "timestamp": "2025-09-01T12:54:12.843Z"
};