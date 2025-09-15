window.templateData = {
  "compliance": {
    "categories": {
      "ai": {
        "compliant": [],
        "enabled": true,
        "issues": [],
        "percentage": 0,
        "summary": "No checks in this category"
      },
      "deployment": {
        "compliant": [
          {
            "category": "bicepFiles",
            "details": {
              "count": 21,
              "files": [
                "infra/app/ai.bicep",
                "infra/app/database.bicep",
                "infra/app/identity.bicep",
                "infra/app/security.bicep",
                "infra/app/web.bicep",
                "infra/core/ai/cognitive-services/account.bicep",
                "infra/core/ai/cognitive-services/deployment.bicep",
                "infra/core/database/cosmos-db/account.bicep",
                "infra/core/database/cosmos-db/nosql/account.bicep",
                "infra/core/database/cosmos-db/nosql/container.bicep",
                "infra/core/database/cosmos-db/nosql/database.bicep",
                "infra/core/database/cosmos-db/nosql/role/assignment.bicep",
                "infra/core/database/cosmos-db/nosql/role/definition.bicep",
                "infra/core/host/app-service/config.bicep",
                "infra/core/host/app-service/plan.bicep",
                "infra/core/host/app-service/site.bicep",
                "infra/core/security/identity/user-assigned.bicep",
                "infra/core/security/role/assignment.bicep",
                "infra/core/security/role/definition.bicep",
                "infra/main.bicep",
                "infra/main.test.bicep"
              ]
            },
            "id": "bicep-files-exist",
            "message": "Bicep files found in infra/ directory: 21 files"
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
          }
        ],
        "enabled": true,
        "issues": [
          {
            "error": "File infra/app/ai.bicep does not contain required resource Microsoft.Resources/resourceGroups",
            "id": "bicep-missing-microsoft.resources/resourcegroups",
            "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/app/ai.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/app/ai.bicep does not contain required resource Microsoft.KeyVault/vaults",
            "id": "bicep-missing-microsoft.keyvault/vaults",
            "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/app/ai.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/app/database.bicep does not contain required resource Microsoft.Resources/resourceGroups",
            "id": "bicep-missing-microsoft.resources/resourcegroups",
            "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/app/database.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/app/database.bicep does not contain required resource Microsoft.KeyVault/vaults",
            "id": "bicep-missing-microsoft.keyvault/vaults",
            "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/app/database.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/app/identity.bicep does not contain required resource Microsoft.Resources/resourceGroups",
            "id": "bicep-missing-microsoft.resources/resourcegroups",
            "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/app/identity.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/app/identity.bicep does not contain required resource Microsoft.KeyVault/vaults",
            "id": "bicep-missing-microsoft.keyvault/vaults",
            "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/app/identity.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/app/security.bicep does not contain required resource Microsoft.Resources/resourceGroups",
            "id": "bicep-missing-microsoft.resources/resourcegroups",
            "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/app/security.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/app/security.bicep does not contain required resource Microsoft.KeyVault/vaults",
            "id": "bicep-missing-microsoft.keyvault/vaults",
            "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/app/security.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/app/web.bicep does not contain required resource Microsoft.Resources/resourceGroups",
            "id": "bicep-missing-microsoft.resources/resourcegroups",
            "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/app/web.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/app/web.bicep does not contain required resource Microsoft.KeyVault/vaults",
            "id": "bicep-missing-microsoft.keyvault/vaults",
            "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/app/web.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/core/ai/cognitive-services/account.bicep does not contain required resource Microsoft.Resources/resourceGroups",
            "id": "bicep-missing-microsoft.resources/resourcegroups",
            "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/ai/cognitive-services/account.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/core/ai/cognitive-services/account.bicep does not contain required resource Microsoft.KeyVault/vaults",
            "id": "bicep-missing-microsoft.keyvault/vaults",
            "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/ai/cognitive-services/account.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/core/ai/cognitive-services/deployment.bicep does not contain required resource Microsoft.Resources/resourceGroups",
            "id": "bicep-missing-microsoft.resources/resourcegroups",
            "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/ai/cognitive-services/deployment.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/core/ai/cognitive-services/deployment.bicep does not contain required resource Microsoft.KeyVault/vaults",
            "id": "bicep-missing-microsoft.keyvault/vaults",
            "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/ai/cognitive-services/deployment.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/core/database/cosmos-db/account.bicep does not contain required resource Microsoft.Resources/resourceGroups",
            "id": "bicep-missing-microsoft.resources/resourcegroups",
            "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/database/cosmos-db/account.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/core/database/cosmos-db/account.bicep does not contain required resource Microsoft.KeyVault/vaults",
            "id": "bicep-missing-microsoft.keyvault/vaults",
            "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/database/cosmos-db/account.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/core/database/cosmos-db/nosql/account.bicep does not contain required resource Microsoft.Resources/resourceGroups",
            "id": "bicep-missing-microsoft.resources/resourcegroups",
            "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/database/cosmos-db/nosql/account.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/core/database/cosmos-db/nosql/account.bicep does not contain required resource Microsoft.KeyVault/vaults",
            "id": "bicep-missing-microsoft.keyvault/vaults",
            "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/database/cosmos-db/nosql/account.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/core/database/cosmos-db/nosql/container.bicep does not contain required resource Microsoft.Resources/resourceGroups",
            "id": "bicep-missing-microsoft.resources/resourcegroups",
            "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/database/cosmos-db/nosql/container.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/core/database/cosmos-db/nosql/container.bicep does not contain required resource Microsoft.KeyVault/vaults",
            "id": "bicep-missing-microsoft.keyvault/vaults",
            "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/database/cosmos-db/nosql/container.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/core/database/cosmos-db/nosql/database.bicep does not contain required resource Microsoft.Resources/resourceGroups",
            "id": "bicep-missing-microsoft.resources/resourcegroups",
            "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/database/cosmos-db/nosql/database.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/core/database/cosmos-db/nosql/database.bicep does not contain required resource Microsoft.KeyVault/vaults",
            "id": "bicep-missing-microsoft.keyvault/vaults",
            "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/database/cosmos-db/nosql/database.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/core/database/cosmos-db/nosql/role/assignment.bicep does not contain required resource Microsoft.Resources/resourceGroups",
            "id": "bicep-missing-microsoft.resources/resourcegroups",
            "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/database/cosmos-db/nosql/role/assignment.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/core/database/cosmos-db/nosql/role/assignment.bicep does not contain required resource Microsoft.KeyVault/vaults",
            "id": "bicep-missing-microsoft.keyvault/vaults",
            "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/database/cosmos-db/nosql/role/assignment.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/core/database/cosmos-db/nosql/role/definition.bicep does not contain required resource Microsoft.Resources/resourceGroups",
            "id": "bicep-missing-microsoft.resources/resourcegroups",
            "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/database/cosmos-db/nosql/role/definition.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/core/database/cosmos-db/nosql/role/definition.bicep does not contain required resource Microsoft.KeyVault/vaults",
            "id": "bicep-missing-microsoft.keyvault/vaults",
            "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/database/cosmos-db/nosql/role/definition.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/core/host/app-service/config.bicep does not contain required resource Microsoft.Resources/resourceGroups",
            "id": "bicep-missing-microsoft.resources/resourcegroups",
            "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/host/app-service/config.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/core/host/app-service/config.bicep does not contain required resource Microsoft.KeyVault/vaults",
            "id": "bicep-missing-microsoft.keyvault/vaults",
            "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/host/app-service/config.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/core/host/app-service/plan.bicep does not contain required resource Microsoft.Resources/resourceGroups",
            "id": "bicep-missing-microsoft.resources/resourcegroups",
            "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/host/app-service/plan.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/core/host/app-service/plan.bicep does not contain required resource Microsoft.KeyVault/vaults",
            "id": "bicep-missing-microsoft.keyvault/vaults",
            "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/host/app-service/plan.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/core/host/app-service/site.bicep does not contain required resource Microsoft.Resources/resourceGroups",
            "id": "bicep-missing-microsoft.resources/resourcegroups",
            "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/host/app-service/site.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/core/host/app-service/site.bicep does not contain required resource Microsoft.KeyVault/vaults",
            "id": "bicep-missing-microsoft.keyvault/vaults",
            "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/host/app-service/site.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/core/security/identity/user-assigned.bicep does not contain required resource Microsoft.Resources/resourceGroups",
            "id": "bicep-missing-microsoft.resources/resourcegroups",
            "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/security/identity/user-assigned.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/core/security/identity/user-assigned.bicep does not contain required resource Microsoft.KeyVault/vaults",
            "id": "bicep-missing-microsoft.keyvault/vaults",
            "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/security/identity/user-assigned.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/core/security/role/assignment.bicep does not contain required resource Microsoft.Resources/resourceGroups",
            "id": "bicep-missing-microsoft.resources/resourcegroups",
            "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/security/role/assignment.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/core/security/role/assignment.bicep does not contain required resource Microsoft.KeyVault/vaults",
            "id": "bicep-missing-microsoft.keyvault/vaults",
            "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/security/role/assignment.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/core/security/role/definition.bicep does not contain required resource Microsoft.Resources/resourceGroups",
            "id": "bicep-missing-microsoft.resources/resourcegroups",
            "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/security/role/definition.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/core/security/role/definition.bicep does not contain required resource Microsoft.KeyVault/vaults",
            "id": "bicep-missing-microsoft.keyvault/vaults",
            "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/security/role/definition.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/main.bicep does not contain required resource Microsoft.KeyVault/vaults",
            "id": "bicep-missing-microsoft.keyvault/vaults",
            "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/main.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/main.test.bicep does not contain required resource Microsoft.Resources/resourceGroups",
            "id": "bicep-missing-microsoft.resources/resourcegroups",
            "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/main.test.bicep",
            "severity": "error"
          },
          {
            "error": "File infra/main.test.bicep does not contain required resource Microsoft.KeyVault/vaults",
            "id": "bicep-missing-microsoft.keyvault/vaults",
            "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/main.test.bicep",
            "severity": "error"
          }
        ],
        "percentage": 9,
        "summary": "9% compliant"
      },
      "functionalRequirements": {
        "compliant": [],
        "enabled": true,
        "issues": [],
        "percentage": 0,
        "summary": "No checks in this category"
      },
      "repositoryManagement": {
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
            "category": "requiredFile",
            "details": {
              "fileName": "LICENSE"
            },
            "id": "file-LICENSE",
            "message": "Required file found: LICENSE"
          },
          {
            "category": "requiredFolder",
            "details": {
              "fileCount": 26,
              "folderPath": "infra"
            },
            "id": "folder-infra",
            "message": "Required folder found: infra/"
          },
          {
            "category": "requiredFolder",
            "details": {
              "fileCount": 2,
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
          }
        ],
        "enabled": true,
        "issues": [
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
          }
        ],
        "percentage": 67,
        "summary": "67% compliant"
      },
      "security": {
        "compliant": [],
        "enabled": true,
        "issues": [
          {
            "error": "File infra/app/security.bicep may have resources (Cosmos DB) with anonymous access or missing authentication",
            "id": "bicep-missing-auth-infra/app/security.bicep",
            "message": "Security recommendation: Add Managed Identity for Cosmos DB in infra/app/security.bicep",
            "recommendation": "Configure Managed Identity for secure access to these resources.",
            "severity": "warning"
          },
          {
            "error": "File infra/core/ai/cognitive-services/account.bicep may have resources (Cognitive Services) with anonymous access or missing authentication",
            "id": "bicep-missing-auth-infra/core/ai/cognitive-services/account.bicep",
            "message": "Security recommendation: Add Managed Identity for Cognitive Services in infra/core/ai/cognitive-services/account.bicep",
            "recommendation": "Configure Managed Identity for secure access to these resources.",
            "severity": "warning"
          },
          {
            "error": "File infra/core/ai/cognitive-services/deployment.bicep may have resources (Cognitive Services) with anonymous access or missing authentication",
            "id": "bicep-missing-auth-infra/core/ai/cognitive-services/deployment.bicep",
            "message": "Security recommendation: Add Managed Identity for Cognitive Services in infra/core/ai/cognitive-services/deployment.bicep",
            "recommendation": "Configure Managed Identity for secure access to these resources.",
            "severity": "warning"
          },
          {
            "error": "File infra/core/database/cosmos-db/account.bicep may have resources (Cosmos DB) with anonymous access or missing authentication",
            "id": "bicep-missing-auth-infra/core/database/cosmos-db/account.bicep",
            "message": "Security recommendation: Add Managed Identity for Cosmos DB in infra/core/database/cosmos-db/account.bicep",
            "recommendation": "Configure Managed Identity for secure access to these resources.",
            "severity": "warning"
          },
          {
            "error": "File infra/core/database/cosmos-db/nosql/container.bicep may have resources (Cosmos DB) with anonymous access or missing authentication",
            "id": "bicep-missing-auth-infra/core/database/cosmos-db/nosql/container.bicep",
            "message": "Security recommendation: Add Managed Identity for Cosmos DB in infra/core/database/cosmos-db/nosql/container.bicep",
            "recommendation": "Configure Managed Identity for secure access to these resources.",
            "severity": "warning"
          },
          {
            "error": "File infra/core/database/cosmos-db/nosql/database.bicep may have resources (Cosmos DB) with anonymous access or missing authentication",
            "id": "bicep-missing-auth-infra/core/database/cosmos-db/nosql/database.bicep",
            "message": "Security recommendation: Add Managed Identity for Cosmos DB in infra/core/database/cosmos-db/nosql/database.bicep",
            "recommendation": "Configure Managed Identity for secure access to these resources.",
            "severity": "warning"
          },
          {
            "error": "File infra/core/database/cosmos-db/nosql/role/assignment.bicep may have resources (Cosmos DB) with anonymous access or missing authentication",
            "id": "bicep-missing-auth-infra/core/database/cosmos-db/nosql/role/assignment.bicep",
            "message": "Security recommendation: Add Managed Identity for Cosmos DB in infra/core/database/cosmos-db/nosql/role/assignment.bicep",
            "recommendation": "Configure Managed Identity for secure access to these resources.",
            "severity": "warning"
          },
          {
            "error": "File infra/core/database/cosmos-db/nosql/role/definition.bicep may have resources (Cosmos DB) with anonymous access or missing authentication",
            "id": "bicep-missing-auth-infra/core/database/cosmos-db/nosql/role/definition.bicep",
            "message": "Security recommendation: Add Managed Identity for Cosmos DB in infra/core/database/cosmos-db/nosql/role/definition.bicep",
            "recommendation": "Configure Managed Identity for secure access to these resources.",
            "severity": "warning"
          },
          {
            "error": "File infra/core/host/app-service/config.bicep may have resources (App Service) with anonymous access or missing authentication",
            "id": "bicep-missing-auth-infra/core/host/app-service/config.bicep",
            "message": "Security recommendation: Add Managed Identity for App Service in infra/core/host/app-service/config.bicep",
            "recommendation": "Configure Managed Identity for secure access to these resources.",
            "severity": "warning"
          },
          {
            "error": "File infra/core/host/app-service/site.bicep may have resources (App Service) with anonymous access or missing authentication",
            "id": "bicep-missing-auth-infra/core/host/app-service/site.bicep",
            "message": "Security recommendation: Add Managed Identity for App Service in infra/core/host/app-service/site.bicep",
            "recommendation": "Configure Managed Identity for secure access to these resources.",
            "severity": "warning"
          }
        ],
        "percentage": 0,
        "summary": "0% compliant"
      },
      "testing": {
        "compliant": [],
        "enabled": false,
        "issues": [],
        "percentage": 0,
        "summary": "No checks in this category"
      }
    },
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
        "category": "requiredFile",
        "details": {
          "fileName": "LICENSE"
        },
        "id": "file-LICENSE",
        "message": "Required file found: LICENSE"
      },
      {
        "category": "requiredFolder",
        "details": {
          "fileCount": 26,
          "folderPath": "infra"
        },
        "id": "folder-infra",
        "message": "Required folder found: infra/"
      },
      {
        "category": "requiredFolder",
        "details": {
          "fileCount": 2,
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
          "count": 21,
          "files": [
            "infra/app/ai.bicep",
            "infra/app/database.bicep",
            "infra/app/identity.bicep",
            "infra/app/security.bicep",
            "infra/app/web.bicep",
            "infra/core/ai/cognitive-services/account.bicep",
            "infra/core/ai/cognitive-services/deployment.bicep",
            "infra/core/database/cosmos-db/account.bicep",
            "infra/core/database/cosmos-db/nosql/account.bicep",
            "infra/core/database/cosmos-db/nosql/container.bicep",
            "infra/core/database/cosmos-db/nosql/database.bicep",
            "infra/core/database/cosmos-db/nosql/role/assignment.bicep",
            "infra/core/database/cosmos-db/nosql/role/definition.bicep",
            "infra/core/host/app-service/config.bicep",
            "infra/core/host/app-service/plan.bicep",
            "infra/core/host/app-service/site.bicep",
            "infra/core/security/identity/user-assigned.bicep",
            "infra/core/security/role/assignment.bicep",
            "infra/core/security/role/definition.bicep",
            "infra/main.bicep",
            "infra/main.test.bicep"
          ]
        },
        "id": "bicep-files-exist",
        "message": "Bicep files found in infra/ directory: 21 files"
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
          "issueCount": 54,
          "percentageCompliant": 16,
          "totalChecks": 64
        },
        "id": "compliance-summary",
        "message": "Compliance: 16%"
      }
    ],
    "globalChecks": [],
    "issues": [
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
        "error": "File infra/app/ai.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/app/ai.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/app/ai.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/app/ai.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/app/database.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/app/database.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/app/database.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/app/database.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/app/identity.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/app/identity.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/app/identity.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/app/identity.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/app/security.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/app/security.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/app/security.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/app/security.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/app/web.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/app/web.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/app/web.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/app/web.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/ai/cognitive-services/account.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/ai/cognitive-services/account.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/ai/cognitive-services/account.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/ai/cognitive-services/account.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/ai/cognitive-services/deployment.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/ai/cognitive-services/deployment.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/ai/cognitive-services/deployment.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/ai/cognitive-services/deployment.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/database/cosmos-db/account.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/database/cosmos-db/account.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/database/cosmos-db/account.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/database/cosmos-db/account.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/database/cosmos-db/nosql/account.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/database/cosmos-db/nosql/account.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/database/cosmos-db/nosql/account.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/database/cosmos-db/nosql/account.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/database/cosmos-db/nosql/container.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/database/cosmos-db/nosql/container.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/database/cosmos-db/nosql/container.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/database/cosmos-db/nosql/container.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/database/cosmos-db/nosql/database.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/database/cosmos-db/nosql/database.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/database/cosmos-db/nosql/database.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/database/cosmos-db/nosql/database.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/database/cosmos-db/nosql/role/assignment.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/database/cosmos-db/nosql/role/assignment.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/database/cosmos-db/nosql/role/assignment.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/database/cosmos-db/nosql/role/assignment.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/database/cosmos-db/nosql/role/definition.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/database/cosmos-db/nosql/role/definition.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/database/cosmos-db/nosql/role/definition.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/database/cosmos-db/nosql/role/definition.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/host/app-service/config.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/host/app-service/config.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/host/app-service/config.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/host/app-service/config.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/host/app-service/plan.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/host/app-service/plan.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/host/app-service/plan.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/host/app-service/plan.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/host/app-service/site.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/host/app-service/site.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/host/app-service/site.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/host/app-service/site.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/security/identity/user-assigned.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/security/identity/user-assigned.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/security/identity/user-assigned.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/security/identity/user-assigned.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/security/role/assignment.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/security/role/assignment.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/security/role/assignment.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/security/role/assignment.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/security/role/definition.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/core/security/role/definition.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/core/security/role/definition.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/core/security/role/definition.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/main.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/main.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/main.test.bicep does not contain required resource Microsoft.Resources/resourceGroups",
        "id": "bicep-missing-microsoft.resources/resourcegroups",
        "message": "Missing resource \"Microsoft.Resources/resourceGroups\" in infra/main.test.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/main.test.bicep does not contain required resource Microsoft.KeyVault/vaults",
        "id": "bicep-missing-microsoft.keyvault/vaults",
        "message": "Missing resource \"Microsoft.KeyVault/vaults\" in infra/main.test.bicep",
        "severity": "error"
      },
      {
        "error": "File infra/app/security.bicep may have resources (Cosmos DB) with anonymous access or missing authentication",
        "id": "bicep-missing-auth-infra/app/security.bicep",
        "message": "Security recommendation: Add Managed Identity for Cosmos DB in infra/app/security.bicep",
        "recommendation": "Configure Managed Identity for secure access to these resources.",
        "severity": "warning"
      },
      {
        "error": "File infra/core/ai/cognitive-services/account.bicep may have resources (Cognitive Services) with anonymous access or missing authentication",
        "id": "bicep-missing-auth-infra/core/ai/cognitive-services/account.bicep",
        "message": "Security recommendation: Add Managed Identity for Cognitive Services in infra/core/ai/cognitive-services/account.bicep",
        "recommendation": "Configure Managed Identity for secure access to these resources.",
        "severity": "warning"
      },
      {
        "error": "File infra/core/ai/cognitive-services/deployment.bicep may have resources (Cognitive Services) with anonymous access or missing authentication",
        "id": "bicep-missing-auth-infra/core/ai/cognitive-services/deployment.bicep",
        "message": "Security recommendation: Add Managed Identity for Cognitive Services in infra/core/ai/cognitive-services/deployment.bicep",
        "recommendation": "Configure Managed Identity for secure access to these resources.",
        "severity": "warning"
      },
      {
        "error": "File infra/core/database/cosmos-db/account.bicep may have resources (Cosmos DB) with anonymous access or missing authentication",
        "id": "bicep-missing-auth-infra/core/database/cosmos-db/account.bicep",
        "message": "Security recommendation: Add Managed Identity for Cosmos DB in infra/core/database/cosmos-db/account.bicep",
        "recommendation": "Configure Managed Identity for secure access to these resources.",
        "severity": "warning"
      },
      {
        "error": "File infra/core/database/cosmos-db/nosql/container.bicep may have resources (Cosmos DB) with anonymous access or missing authentication",
        "id": "bicep-missing-auth-infra/core/database/cosmos-db/nosql/container.bicep",
        "message": "Security recommendation: Add Managed Identity for Cosmos DB in infra/core/database/cosmos-db/nosql/container.bicep",
        "recommendation": "Configure Managed Identity for secure access to these resources.",
        "severity": "warning"
      },
      {
        "error": "File infra/core/database/cosmos-db/nosql/database.bicep may have resources (Cosmos DB) with anonymous access or missing authentication",
        "id": "bicep-missing-auth-infra/core/database/cosmos-db/nosql/database.bicep",
        "message": "Security recommendation: Add Managed Identity for Cosmos DB in infra/core/database/cosmos-db/nosql/database.bicep",
        "recommendation": "Configure Managed Identity for secure access to these resources.",
        "severity": "warning"
      },
      {
        "error": "File infra/core/database/cosmos-db/nosql/role/assignment.bicep may have resources (Cosmos DB) with anonymous access or missing authentication",
        "id": "bicep-missing-auth-infra/core/database/cosmos-db/nosql/role/assignment.bicep",
        "message": "Security recommendation: Add Managed Identity for Cosmos DB in infra/core/database/cosmos-db/nosql/role/assignment.bicep",
        "recommendation": "Configure Managed Identity for secure access to these resources.",
        "severity": "warning"
      },
      {
        "error": "File infra/core/database/cosmos-db/nosql/role/definition.bicep may have resources (Cosmos DB) with anonymous access or missing authentication",
        "id": "bicep-missing-auth-infra/core/database/cosmos-db/nosql/role/definition.bicep",
        "message": "Security recommendation: Add Managed Identity for Cosmos DB in infra/core/database/cosmos-db/nosql/role/definition.bicep",
        "recommendation": "Configure Managed Identity for secure access to these resources.",
        "severity": "warning"
      },
      {
        "error": "File infra/core/host/app-service/config.bicep may have resources (App Service) with anonymous access or missing authentication",
        "id": "bicep-missing-auth-infra/core/host/app-service/config.bicep",
        "message": "Security recommendation: Add Managed Identity for App Service in infra/core/host/app-service/config.bicep",
        "recommendation": "Configure Managed Identity for secure access to these resources.",
        "severity": "warning"
      },
      {
        "error": "File infra/core/host/app-service/site.bicep may have resources (App Service) with anonymous access or missing authentication",
        "id": "bicep-missing-auth-infra/core/host/app-service/site.bicep",
        "message": "Security recommendation: Add Managed Identity for App Service in infra/core/host/app-service/site.bicep",
        "recommendation": "Configure Managed Identity for secure access to these resources.",
        "severity": "warning"
      }
    ],
    "percentage": 16,
    "summary": "Issues found - Compliance: 16%"
  },
  "repoUrl": "https://github.com/anfibiacreativa/cosmosdb-nosql-copilot",
  "ruleSet": "dod",
  "timestamp": "2025-09-15T15:46:35.648Z"
};