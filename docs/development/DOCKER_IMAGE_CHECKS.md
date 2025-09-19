# Docker Image Security Checks

This document explains how Template Doctor validates Docker images in templates for security vulnerabilities.

## Overview

When analyzing templates, Template Doctor scans any Docker images referenced in the template for security vulnerabilities and configuration issues. This is a critical security measure as templates may include Docker images that could have known vulnerabilities, license issues, or misconfigurations.

## Workflow Integration

The Docker image scanning is implemented through the GitHub Actions workflow system described in [GITHUB_WORKFLOWS.md](./GITHUB_WORKFLOWS.md). The specific workflow for Docker image scanning is `validate-docker-images.yml`.

## Scanning Process

The Docker image scanning process consists of several key steps:

1. **Image Discovery**: Searches a repository for Docker image references in:
   - Dockerfiles (`FROM` statements)
   - Docker Compose files (`image:` entries)
   - Devcontainer configuration files (`image:` property)
   - Infrastructure as Code files (Bicep, Terraform)
   - Generic files that might contain image references

2. **Image Filtering**: Deduplicates found images and filters out non-scannable references:
   - Removes development container features (not actual images)
   - Filters out patterns that don't represent valid Docker images
   - Normalizes image references

3. **Security Scanning**: Uses Trivy, a comprehensive vulnerability scanner to check each image for:
   - OS and package vulnerabilities
   - Application dependencies vulnerabilities
   - Secret detection
   - License violations
   - Misconfigurations

4. **Repository Scanning**: In addition to scanning individual images, the entire repository is scanned for:
   - Secrets in code
   - Misconfigurations in IaC files
   - License issues

## Technical Implementation

### API Components

The Docker image scanning system comprises several API components:

- **validation-docker-image/index.js**: Main API endpoint that orchestrates the scanning process
- **trivy-utils.js**: Utility functions for processing Trivy scan results
- **zip-utils.js**: Helper for extracting scan artifacts

The system uses the following shared action API components:
- **action-trigger/index.js**: Triggers GitHub workflows and retrieves run IDs
- **action-run-status/index.js**: Monitors workflow execution status
- **action-run-artifacts/index.js**: Retrieves workflow artifacts with results

### Workflow Steps

The `validate-docker-images.yml` workflow performs these tasks:

1. **find-images**: Locates all Docker images referenced in the repository
2. **scan-repo**: Scans the entire repository for vulnerabilities and misconfigurations
3. **scan-images**: Creates a dynamic matrix of images to scan
4. **scan-each-image**: Scans each individual Docker image in parallel

### Results Processing

When scan results are available, the system:

1. Processes artifact ZIP files containing Trivy JSON results
2. Extracts vulnerability details, categorizing by severity (critical, high, medium, low)
3. Compiles statistics on vulnerabilities, misconfigurations, secrets, and license issues
4. Returns structured data to the client

## Security Considerations

The Docker image scanning implementation has these security aspects:

- **No Private Image Support**: Cannot scan private images (would need authentication)
- **Devcontainer Features**: Filters out devcontainer features as they aren't real images
- **Artifact Size Limits**: Large scan results are truncated to meet GitHub's artifact size limits
- **Filename Sanitization**: Image names are sanitized for safe artifact storage

## Example Results

A successful scan produces JSON results with this structure:

```json
{
  "repositoryScan": {
    "totalMisconfigurations": 3,
    "criticalMisconfigurations": 0,
    "highMisconfigurations": 1,
    "mediumMisconfigurations": 2,
    "totalVulnerabilities": 12,
    "criticalVulns": 0,
    "highVulns": 3,
    "mediumVulns": 5,
    "lowVulns": 4,
    "secretsFound": 0,
    "licenseIssues": 0
  },
  "imageScans": [
    {
      "artifactName": "mcr.microsoft.com/devcontainers/javascript-node:0-18",
      "totalVulnerabilities": 54,
      "criticalVulns": 2,
      "highVulns": 14,
      "mediumVulns": 23,
      "lowVulns": 15,
      "secretsFound": 0,
      "licenseIssues": 0,
      "repository": "mcr.microsoft.com/devcontainers/javascript-node",
      "tag": "0-18"
    }
  ]
}
```

### API Response Structure

The Docker image validation API follows a standardized response format that's shared with other validation APIs like the OSSF Scorecard API. A successful API response has this structure:

```json
{
  "templateUrl": "owner/repo",
  "runId": "abc123-unique-identifier",
  "githubRunId": 1234567890,
  "githubRunUrl": "https://github.com/Template-Doctor/template-doctor/actions/runs/1234567890",
  "message": "validate-docker-images.yml workflow triggered; abc123 run completed",
  "details": {
    "complianceResults": {
      "repositoryScan": { ... },
      "imageScans": [ ... ]
    },
    "artifacts": [ ... ]
  },
  "issues": [
    {
      "id": "docker-image-0-critical-vulnerabilities",
      "severity": "error",
      "message": "Docker image contains 2 critical vulnerabilities",
      "details": { ... }
    }
  ],
  "compliance": [
    {
      "id": "docker-repo-no-critical-misconfigurations",
      "category": "security",
      "message": "Repository contains no critical misconfigurations",
      "details": { ... }
    }
  ]
}
```

Key fields in the shared response structure:
- **templateUrl**: The repository being analyzed (owner/repo format)
- **runId**: Unique identifier for this validation run
- **githubRunId**: GitHub Actions workflow run ID
- **githubRunUrl**: URL to view the workflow run on GitHub
- **message**: Summary message about the validation
- **details**: Validator-specific details (varies by validator type)
- **issues**: Array of issues found during validation (each with id, severity, message, and details)
- **compliance**: Array of compliance validations passed (each with id, category, message, and details)

## Integration with Template Doctor

The Docker image security scan results are:

1. Incorporated into the template analysis dashboard
2. Highlighted in the security section of the template report
3. Used to calculate the security score for the template
4. Flagged in the template metadata for filtering/searching

## See Also

- [GITHUB_WORKFLOWS.md](./GITHUB_WORKFLOWS.md) - Details on the workflow system architecture
- [Trivy Documentation](https://aquasecurity.github.io/trivy/) - The security scanner used