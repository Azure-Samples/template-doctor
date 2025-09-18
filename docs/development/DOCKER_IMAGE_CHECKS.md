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

## Integration with Template Doctor

The Docker image security scan results are:

1. Incorporated into the template analysis dashboard
2. Highlighted in the security section of the template report
3. Used to calculate the security score for the template
4. Flagged in the template metadata for filtering/searching

## See Also

- [GITHUB_WORKFLOWS.md](./GITHUB_WORKFLOWS.md) - Details on the workflow system architecture
- [SECURITY_ANALYSIS.md](../usage/SECURITY_ANALYSIS.md) - Broader security analysis features
- [Trivy Documentation](https://aquasecurity.github.io/trivy/) - The security scanner used