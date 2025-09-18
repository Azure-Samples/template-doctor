# GitHub Workflows

This document explains how Template Doctor uses GitHub Workflows for template validation and security scanning.

## Overview

Template Doctor leverages GitHub Actions workflows to perform various validation tasks on templates. These workflows are triggered via API endpoints and execute specific validations based on the template's contents. The primary workflow types are:

1. **Template Validation** - Validates AZD templates against ruleset requirements
2. **Docker Image Security Scanning** - Scans Docker images found in templates for vulnerabilities
3. **OSSF Scorecard Analysis** - Analyzes the template's open source security health

## Workflow Architecture

The system uses a modular approach where API functions trigger workflows and process their results:

1. **Trigger Phase**: The `action-trigger` API function dispatches a workflow and obtains its run ID.
2. **Status Monitoring**: The `action-run-status` API function polls the workflow until completion.
3. **Result Gathering**: The `action-run-artifacts` API function retrieves workflow artifacts.
4. **Processing**: Specialized functions process specific validator results (e.g., `validation-docker-image`).

```
┌─────────────┐    ┌─────────────────┐    ┌──────────────────┐    ┌────────────────┐
│  API Client │───▶│  action-trigger │───▶│ action-run-status│───▶│action-run-arti-│
└─────────────┘    └─────────────────┘    └──────────────────┘    │facts           │
                                                                  └────────┬───────┘
                                                                           │
                                                                           ▼
                                                            ┌────────────────────────┐
                                                            │ Specialized Validators │
                                                            └────────────────────────┘
```

## Key Workflows

### validation-template.yml

This workflow performs Azure Developer CLI (AZD) template validation:

- **Trigger**: Dispatched via `action-trigger` API with template URL
- **Process**: Clones the repository, checks for hooks, and runs the validation
- **Output**: Produces a validation result artifact with compliance information
- **Environment**: Uses Azure authentication to validate deployability

### validate-docker-images.yml

This workflow scans Docker images found in a template repository:

- **Trigger**: Dispatched with repo owner, name, and run ID
- **Process**:
  1. Finds candidate files that might contain Docker image references
  2. Extracts image references from Dockerfiles, docker-compose files, and devcontainer configurations
  3. Deduplicates and filters image references
  4. Scans each unique image using Trivy security scanner
- **Output**: Produces scan artifacts containing vulnerability reports for each image and the repository

### validate-ossf-score.yml

This workflow evaluates a repository's security posture using OpenSSF Scorecard:

- **Trigger**: Dispatched with repository details
- **Process**: Runs the OpenSSF Scorecard Docker image on the target repository
- **Output**: Produces a JSON result with security scores across various categories

## API Integration

The API modules responsible for workflow integration are:

- **action-trigger/index.js**: Triggers workflows and retrieves run IDs
- **action-run-status/index.js**: Monitors workflow status until completion
- **action-run-artifacts/index.js**: Fetches artifacts produced by workflows

Specialized processing modules like **validation-docker-image/index.js** use these three core modules to:
1. Trigger a specific validation workflow
2. Wait for completion
3. Retrieve and process results
4. Return structured data to the client

## Authentication

Workflows require GitHub authentication for API access. The system uses:

- **GH_WORKFLOW_TOKEN**: Environment variable containing a GitHub token with workflow permissions
- **Managed Identity**: For Azure resource interaction when validating templates

## Adding New Validators

To add a new validator workflow:

1. Create the workflow YAML file in `.github/workflows/`
2. Design it to accept input parameters via `workflow_dispatch`
3. Generate artifacts with validation results
4. Create a corresponding API function to trigger and process results

## Common Issues

- **Missing GH_WORKFLOW_TOKEN**: Ensure this environment variable is set
- **Workflow Timeout**: Check if validations are taking too long (default timeout is 5 minutes)
- **Artifact Size Limits**: GitHub limits artifacts to 500MB; large scan results may be truncated

## See Also

- [DOCKER_IMAGE_CHECKS.md](./DOCKER_IMAGE_CHECKS.md) - Detailed information about Docker image security scanning
- [GitHub Actions documentation](https://docs.github.com/en/actions)