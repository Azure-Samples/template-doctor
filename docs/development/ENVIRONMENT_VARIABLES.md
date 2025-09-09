# Environment Variables Documentation

This document provides an overview of the environment variables used in the Template Doctor project for the legacy Static Web Apps + Azure Functions architecture. For the new unified container / Azure Container Apps deployment model, see: [`ENVIRONMENT_VARIABLES_CONTAINER.md`](./ENVIRONMENT_VARIABLES_CONTAINER.md).

We've consolidated the environment variables into a single `.env` file at the root of the project for easier management.

## Environment Variable Consolidation

Previously, environment variables were spread across multiple `.env` files:
- `/.env` (root)
- `/packages/app/.env`
- `/packages/api/.env`

These have now been consolidated into a single `.env` file at the root level. This approach simplifies setup and ensures consistency across different parts of the application.

## Available Environment Variables

### GitHub Authentication

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `GITHUB_TOKEN` | GitHub personal access token used for API calls | Yes | API, GitHub Action |
| `GH_WORKFLOW_TOKEN` | GitHub personal access token used for API calls | Yes | API, GitHub Action |

Notes:
- `GH_WORKFLOW_TOKEN` is used by server-side functions to call GitHub (e.g., repository_dispatch and centralized archive PRs). It must have the right scopes and be SSO-authorized if your org requires it.
### GitHub Action Dispatch Target

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `GITHUB_ACTION_REPO` | Target repository for saving results (format: `owner/repo`). If omitted, the server will use `GITHUB_REPOSITORY` when available, otherwise it falls back to `Template-Doctor/template-doctor`. | No | API (submit-analysis-dispatch) |

Notes:
- Set this only on the server (Functions or SWA API). The client no longer needs to know or set this value.
- If the application and action live in the same repository, you can omit this and rely on `GITHUB_REPOSITORY` or the default fallback.

| `GITHUB_CLIENT_ID` | OAuth client ID for GitHub authentication | Yes | Frontend, API |
| `GITHUB_CLIENT_SECRET` | OAuth client secret for GitHub authentication | Yes | API (github-oauth-token) |

### Centralized Archive (Optional)

These variables enable saving a metadata JSON into a centralized archive repository (separate from the results PR). There are variables set in GitHub Actions and variables set in Azure Functions.

GitHub (Repository → Settings → Secrets and variables → Actions)

| Variable | Type | Description | Required |
|----------|------|-------------|----------|
| `TD_API_BASE` | Variable/Secret | Base URL to your API endpoints that host `/archive-collection` (e.g., `https://<your-swa>.azurestaticapps.net/api` or `https://<your-functionapp>.azurewebsites.net/api`) | Yes (if archiving) |
| `TD_ARCHIVE_COLLECTION` | Variable | Default collection name to file results under (e.g., `aigallery`). Also accepts `TD_COLLECTION` as legacy alias. | No |

Azure Functions (Application Settings)

| Variable | Description | Required |
|----------|-------------|----------|
| `GH_WORKFLOW_TOKEN` | PAT used by the `archive-collection` function to create a branch/commit/PR in the central archive repo. Must have Contents: Read/Write and Pull requests: Read/Write permissions on that repo (enable SSO if needed). | Yes (if archiving) |
| `ARCHIVE_REPO_SLUG` | Override central archive repo slug in `owner/repo` form (defaults to `Template-Doctor/centralized-collections-archive`). | No |

Client/runtime flags

| Field | Source | Description |
|-------|--------|-------------|
| `archiveEnabled` | runtime-config (server → client) | If true, every analysis triggers central archive. If false, users can opt-in per-run via a toggle in the modal. |
| `archiveCollection` | runtime-config (server → client) | Default collection used when archiving. |

### Azure Configuration

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID | Yes | API, Functions |
| `AZURE_TENANT_ID` | Azure tenant ID | Yes | API, Functions |
| `AZURE_CLIENT_ID` | Azure managed identity client ID | For managed identity | Functions |
| `AZURE_RESOURCE_GROUP` | Azure resource group | For managed identity  | Scripts |

### Azure Static Web Apps Deployment

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `SWA_CLI_DEPLOYMENT_TOKEN` | Static Web Apps deployment token used by the nightly/manual deploy workflow to publish the site via SWA CLI. Obtain from your SWA resource in Azure Portal. | Yes (for nightly/manual deploy) | GitHub Actions (nightly-swa-deploy.yml) |


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

## Security Considerations

- Never commit your `.env` file to version control
- Use secrets management for production deployments
- Rotate credentials regularly
- Consider using managed identities in Azure where possible