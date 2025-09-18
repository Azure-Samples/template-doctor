# OpenSSF Scorecard Security Checks

This document explains how Template Doctor evaluates template repositories against the OpenSSF Scorecard to ensure security best practices.

## Overview

Template Doctor uses the OpenSSF Scorecard to assess the security health of template repositories. The OpenSSF (Open Source Security Foundation) Scorecard is an automated tool that checks for adherence to security best practices in open source projects. This assessment provides valuable insights into the security posture of templates before they're used for development.

## Workflow Integration

The OpenSSF Scorecard scanning is implemented through the GitHub Actions workflow system described in [GITHUB_WORKFLOWS.md](./GITHUB_WORKFLOWS.md). The specific workflow for OpenSSF scoring is `validate-ossf-score.yml`.

## Scoring Process

The OpenSSF Scorecard evaluation process consists of several key steps:

1. **Workflow Triggering**: The `validation-ossf` API endpoint triggers the `validate-ossf-score.yml` workflow with:
   - Repository details (owner/repo format)
   - A unique run ID for tracking
   
2. **Repository Analysis**: The workflow runs the OpenSSF Scorecard Docker image to analyze the repository across multiple security dimensions:
   - Dependency update mechanisms
   - Code review practices
   - Branch protection settings
   - Continuous integration testing
   - Vulnerability reporting process
   - Use of dangerous patterns
   - Token permissions

3. **Score Calculation**: The tool generates a composite security score (0-10) based on the repository's compliance with security best practices.

4. **Result Processing**: After the workflow completes, the system:
   - Retrieves the artifact containing the OpenSSF score
   - Parses the score from the artifact name
   - Compares against the minimum required score
   - Records compliance or issues based on the result

## Technical Implementation

### API Components

The OpenSSF scoring system comprises these API components:

- **validation-ossf/index.js**: Main API endpoint that handles requests and responses
- **validation-ossf/scorecard.js**: Core implementation with the `ScorecardClient` class and utilities

### Workflow Steps

The `validate-ossf-score.yml` workflow performs these tasks:

1. **Environment Setup**: Prepares the environment for running the OpenSSF Scorecard
2. **Container Execution**: Runs the Scorecard in a Docker container
3. **Result Extraction**: Embeds the overall score in the artifact name for efficient retrieval
4. **Artifact Upload**: Creates and uploads artifacts containing detailed results

### Results Processing

The system processes results through these steps:

1. **Workflow Polling**: After triggering the workflow, the system polls for completion with exponential backoff
2. **Artifact Retrieval**: Once completed, it locates the artifact containing the results
3. **Score Extraction**: Extracts the score from the artifact name using a pattern match
4. **Validation**: Compares the score against the minimum threshold (e.g., 7.0)
5. **Reporting**: Records either compliance or issues based on the comparison

## Resilience Features

The implementation includes several resilience mechanisms:

- **Exponential Backoff**: Polling uses increasing delays with jitter to avoid thundering herd problems
- **Timeout Handling**: Implements a 2-minute polling timeout with a 3-minute overall execution limit
- **Error Recovery**: Detailed error handling with appropriate feedback to clients
- **Retry Logic**: Built-in retry capability for transient GitHub API issues

## Example Results

A successful scan will record compliance information like:

```json
{
  "compliance": [
    {
      "id": "ossf-score-meets-minimum",
      "category": "security",
      "message": "OpenSSF Score 8.2 >= 7.0",
      "details": {
        "templateOwnerRepo": "owner/repo",
        "score": "8.2",
        "minScore": 7,
        "artifact": {
          "name": "ossf-scorecard_owner_repo_abc123_score_8_2",
          "id": 12345678,
          "url": "https://api.github.com/repos/Template-Doctor/template-doctor/actions/artifacts/12345678"
        }
      }
    }
  ]
}
```

If the score fails to meet the minimum threshold, an issue is recorded:

```json
{
  "issues": [
    {
      "id": "ossf-score-below-minimum",
      "severity": "warning",
      "message": "OSSF workflow concluded with score 5.8 < 7.0",
      "details": {
        "templateOwnerRepo": "owner/repo",
        "score": "5.8",
        "minScore": "7.0",
        "artifact": {
          "name": "ossf-scorecard_owner_repo_abc123_score_5_8",
          "id": 12345678,
          "url": "https://api.github.com/repos/Template-Doctor/template-doctor/actions/artifacts/12345678"
        }
      }
    }
  ]
}
```

## Integration with Template Doctor

The OpenSSF Scorecard results are:

1. Incorporated into the template analysis dashboard
2. Used as a key factor in the security assessment of templates
3. Displayed as compliance achievements or warnings in reports
4. Used to filter templates that don't meet minimum security standards

## Configuration

The system can be configured through environment variables:

- **GH_WORKFLOW_TOKEN**: GitHub token with workflow access permissions
- **GITHUB_REPO_OWNER**: Owner of the repository containing the workflow (default: "Template-Doctor")
- **GITHUB_REPO_NAME**: Name of the repository containing the workflow (default: "template-doctor")
- **GITHUB_WORKFLOW_FILE**: Name of the workflow file (default: "validate-ossf-score.yml")

## See Also

- [GITHUB_WORKFLOWS.md](./GITHUB_WORKFLOWS.md) - Details on the workflow system architecture
- [DOCKER_IMAGE_CHECKS.md](./DOCKER_IMAGE_CHECKS.md) - Related security scanning for Docker images
- [OpenSSF Scorecard](https://github.com/ossf/scorecard) - The original security assessment tool