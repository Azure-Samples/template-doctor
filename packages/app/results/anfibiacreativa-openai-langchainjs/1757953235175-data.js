window.templateData = {
  "compliance": {
    "categories": {
      "ai": {
        "compliant": [
          {
            "category": "aiModel",
            "details": {
              "modelsChecked": [
                "gpt-3.5-turbo",
                "text-davinci-003"
              ]
            },
            "id": "ai-model-deprecation",
            "message": "Test AI model deprecation: No deprecated model references found"
          }
        ],
        "enabled": true,
        "issues": [],
        "percentage": 100,
        "summary": "100% compliant"
      },
      "deployment": {
        "compliant": [
          {
            "category": "bicepFiles",
            "details": {
              "count": 3,
              "files": [
                "infra/core/ai/cognitiveservices.bicep",
                "infra/core/security/role.bicep",
                "infra/main.bicep"
              ]
            },
            "id": "bicep-files-exist",
            "message": "Bicep files found in infra/ directory: 3 files"
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
          }
        ],
        "enabled": true,
        "issues": [
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
            "error": "File azure.yaml does not define required \"services:\" section",
            "id": "azure-yaml-missing-services",
            "message": "No \"services:\" defined in azure.yaml",
            "severity": "error"
          }
        ],
        "percentage": 33,
        "summary": "33% compliant"
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
              "fileCount": 5,
              "folderPath": "infra"
            },
            "id": "folder-infra",
            "message": "Required folder found: infra/"
          },
          {
            "category": "readmeHeading",
            "details": {
              "heading": "Prerequisites",
              "level": 2
            },
            "id": "readme-heading-prerequisites",
            "message": "README.md contains required h2 heading: Prerequisites"
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
            "error": "Folder .github not found in repository",
            "id": "missing-folder-.github",
            "message": "Missing required folder: .github/",
            "severity": "error"
          },
          {
            "error": "README.md does not contain required h2 heading: Getting Started",
            "id": "readme-missing-heading-getting-started",
            "message": "README.md is missing required h2 heading: Getting Started",
            "severity": "error"
          },
          {
            "error": "README.md does not contain required h2 heading: Architecture",
            "id": "readme-missing-architecture-diagram-heading",
            "message": "README.md is missing required h2 heading: Architecture",
            "severity": "error"
          }
        ],
        "percentage": 56,
        "summary": "56% compliant"
      },
      "security": {
        "compliant": [],
        "enabled": true,
        "issues": [
          {
            "error": "File infra/core/ai/cognitiveservices.bicep may have resources (Cognitive Services) with anonymous access or missing authentication",
            "id": "bicep-missing-auth-infra/core/ai/cognitiveservices.bicep",
            "message": "Security recommendation: Add Managed Identity for Cognitive Services in infra/core/ai/cognitiveservices.bicep",
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
          "fileCount": 5,
          "folderPath": "infra"
        },
        "id": "folder-infra",
        "message": "Required folder found: infra/"
      },
      {
        "category": "readmeHeading",
        "details": {
          "heading": "Prerequisites",
          "level": 2
        },
        "id": "readme-heading-prerequisites",
        "message": "README.md contains required h2 heading: Prerequisites"
      },
      {
        "category": "bicepFiles",
        "details": {
          "count": 3,
          "files": [
            "infra/core/ai/cognitiveservices.bicep",
            "infra/core/security/role.bicep",
            "infra/main.bicep"
          ]
        },
        "id": "bicep-files-exist",
        "message": "Bicep files found in infra/ directory: 3 files"
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
        "category": "aiModel",
        "details": {
          "modelsChecked": [
            "gpt-3.5-turbo",
            "text-davinci-003"
          ]
        },
        "id": "ai-model-deprecation",
        "message": "Test AI model deprecation: No deprecated model references found"
      },
      {
        "category": "meta",
        "details": {
          "compliantCount": 9,
          "issueCount": 11,
          "percentageCompliant": 45,
          "totalChecks": 20
        },
        "id": "compliance-summary",
        "message": "Compliance: 45%"
      }
    ],
    "globalChecks": [
      {
        "details": {
          "modelsChecked": [
            "gpt-3.5-turbo",
            "text-davinci-003"
          ]
        },
        "id": "ai-model-deprecation",
        "status": "passed"
      }
    ],
    "issues": [
      {
        "error": "Missing required GitHub workflow: azure-dev.yml",
        "id": "missing-workflow-.github\\/workflows\\/azure-dev.yml",
        "message": "Missing required GitHub workflow: azure-dev.yml",
        "severity": "error"
      },
      {
        "error": "Folder .github not found in repository",
        "id": "missing-folder-.github",
        "message": "Missing required folder: .github/",
        "severity": "error"
      },
      {
        "error": "README.md does not contain required h2 heading: Getting Started",
        "id": "readme-missing-heading-getting-started",
        "message": "README.md is missing required h2 heading: Getting Started",
        "severity": "error"
      },
      {
        "error": "README.md does not contain required h2 heading: Architecture",
        "id": "readme-missing-architecture-diagram-heading",
        "message": "README.md is missing required h2 heading: Architecture",
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
        "error": "File azure.yaml does not define required \"services:\" section",
        "id": "azure-yaml-missing-services",
        "message": "No \"services:\" defined in azure.yaml",
        "severity": "error"
      },
      {
        "error": "File infra/core/ai/cognitiveservices.bicep may have resources (Cognitive Services) with anonymous access or missing authentication",
        "id": "bicep-missing-auth-infra/core/ai/cognitiveservices.bicep",
        "message": "Security recommendation: Add Managed Identity for Cognitive Services in infra/core/ai/cognitiveservices.bicep",
        "recommendation": "Configure Managed Identity for secure access to these resources.",
        "severity": "warning"
      }
    ],
    "percentage": 45,
    "summary": "Issues found - Compliance: 45%"
  },
  "repoUrl": "https://github.com/anfibiacreativa/openai-langchainjs",
  "ruleSet": "dod",
  "timestamp": "2025-09-15T16:20:14.308Z"
};