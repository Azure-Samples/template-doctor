# Environment Variables Documentation

This document provides an overview of the environment variables used in the Template Doctor project. We've consolidated the environment variables into a single `.env` file at the root of the project for easier management.

## Environment Variable Consolidation

Previously, environment variables were spread across multiple `.env` files:
- `/.env` (root)
- `/packages/app/.env`
- `/packages/api/.env`
- `/packages/functions-aca/.env`

These have now been consolidated into a single `.env` file at the root level. This approach simplifies setup and ensures consistency across different parts of the application.

## Available Environment Variables

### GitHub Authentication

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `GITHUB_TOKEN` | GitHub personal access token used for API calls | Yes | API, GitHub Action |
| `GITHUB_CLIENT_ID` | OAuth client ID for GitHub authentication | Yes | Frontend, API |
| `GITHUB_CLIENT_SECRET` | OAuth client secret for GitHub authentication | Yes | API (github-oauth-token) |

### Azure Configuration

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID | Yes | API, Functions |
| `AZURE_TENANT_ID` | Azure tenant ID | Yes | API, Functions |
| `AZURE_CLIENT_ID` | Azure managed identity client ID | For ACA | Functions |

### Container Registry

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `ACR_NAME` | Azure Container Registry name | For ACA | Deploy scripts |

### Azure Container Apps

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `ACA_RESOURCE_GROUP` | Resource group for Azure Container Apps | For ACA | Functions, Deploy scripts |
| `ACA_JOB_NAME` | Name of the ACA job | For ACA | Functions |
| `ACA_JOB_IMAGE` | Docker image for the ACA job | For ACA | Functions |

### Log Analytics

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `LOG_ANALYTICS_WORKSPACE` | Log Analytics workspace name | For monitoring | Functions |
| `LOG_ANALYTICS_WORKSPACE_ID` | Log Analytics workspace ID | For monitoring | Functions |

### Backend Configuration

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `TD_BACKEND_BASE_URL` | Base URL for the backend API | No | Frontend |
| `TD_BACKEND_FUNCTION_KEY` | Function key for the backend API | No | Frontend |
| `BACKEND_BASE_URL` | Legacy version of TD_BACKEND_BASE_URL | No | Frontend |
| `BACKEND_FUNCTION_KEY` | Legacy version of TD_BACKEND_FUNCTION_KEY | No | Frontend |

### Azure Functions Configuration (Local Development)

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `AzureWebJobsStorage` | Storage connection string for Azure Functions | For local dev | Functions |
| `FUNCTIONS_WORKER_RUNTIME` | Runtime for Azure Functions (node) | For Functions | Functions |

## Setup Instructions

1. Copy the `.env.example` file to `.env` at the root of your project:
   ```bash
   cp .env.example .env
   ```

2. Fill in the values for the environment variables in the `.env` file.

3. For local development of Azure Functions, you'll need the Azure Functions Core Tools installed and running with the storage emulator:
   ```bash
   npm install -g azure-functions-core-tools@4
   ```

## GitHub OAuth Configuration

For the OAuth flow to work correctly, you need to:

1. Create a GitHub OAuth App in your GitHub Developer Settings
2. Set the Authorization callback URL to match your deployment URL + `/callback.html`
3. Fill in the `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in your `.env` file

See the [OAuth Setup Guide](./oauth-setup.md) for more detailed instructions.

## Environment-Specific Configuration

For production deployments, configure the environment variables in your hosting environment:

- **Azure Static Web Apps**: Configure Application Settings in the Azure Portal
- **GitHub Pages**: Set Repository Secrets for GitHub Actions
- **Other Hosting**: Refer to your hosting provider's documentation for environment variable configuration

## Security Considerations

- Never commit your `.env` file to version control
- Use secrets management for production deployments
- Rotate credentials regularly
- Consider using managed identities in Azure where possible