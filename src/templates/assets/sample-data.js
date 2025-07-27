window.reportData = {
  "repoUrl": "https://github.com/username/sample-azd-template",
  "timestamp": "2023-11-01T12:00:00Z",
  "compliance": {
    "summary": "Template is 70% compliant",
    "issues": [
      {
        "id": "missing-file-infra/main.bicep",
        "category": "infra",
        "message": "Missing required file: infra/main.bicep",
        "error": "This file is required for infrastructure deployment"
      },
      {
        "id": "missing-workflow-test-azd",
        "category": "workflows",
        "message": "Missing GitHub workflow: test-azd",
        "error": "This workflow is required to test template provisioning"
      },
      {
        "id": "readme-missing-section-prerequisites",
        "category": "documentation",
        "message": "README.md missing required section: Prerequisites",
        "error": "The Prerequisites section should list all requirements for using the template"
      }
    ],
    "compliant": [
      {
        "id": "file-present-azure-yaml",
        "category": "files",
        "message": "Required file present: azure.yaml",
        "details": {
          "path": "azure.yaml",
          "size": "341 bytes"
        }
      },
      {
        "id": "file-present-readme",
        "category": "files",
        "message": "Required file present: README.md",
        "details": {
          "path": "README.md",
          "size": "1243 bytes"
        }
      },
      {
        "id": "folder-present-infra",
        "category": "folders",
        "message": "Required folder present: infra/",
        "details": {
          "path": "infra/",
          "items": 3
        }
      },
      {
        "id": "readme-section-present-overview",
        "category": "documentation",
        "message": "README.md has required section: Overview",
        "details": {
          "section": "Overview",
          "lines": 15
        }
      },
      {
        "id": "meta",
        "category": "meta",
        "message": "Overall compliance status",
        "details": {
          "percentageCompliant": 70,
          "totalIssues": 3,
          "totalPassed": 7
        }
      }
    ]
  },
  "history": [
    {
      "timestamp": "2023-10-01T12:00:00Z",
      "percentage": 50,
      "issues": 5,
      "passed": 5
    },
    {
      "timestamp": "2023-10-15T12:00:00Z",
      "percentage": 60,
      "issues": 4,
      "passed": 6
    },
    {
      "timestamp": "2023-11-01T12:00:00Z",
      "percentage": 70,
      "issues": 3,
      "passed": 7
    }
  ]
};
