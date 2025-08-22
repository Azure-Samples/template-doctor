# Functions (ACA Orchestration)

This Azure Functions app starts and monitors Azure Container Apps Jobs to run `azd` workflows for templates.

## Required app settings
Set these on the Function App (Configuration) or in `local.settings.json` for local dev:

- AZURE_SUBSCRIPTION_ID: Subscription GUID
- ACA_RESOURCE_GROUP: Resource group of the Container Apps Job
- ACA_JOB_NAME: Name of the Container Apps Job
- ACA_JOB_IMAGE: Container image used for the job runner (must include azd and Azure CLI)
- LOG_ANALYTICS_WORKSPACE (preferred) or LOG_ANALYTICS_WORKSPACE_ID: Log Analytics customerId GUID for the workspace connected to your Container Apps environment
- AZURE_CLIENT_ID: Optional. If using a user-assigned managed identity, set this to the clientId

## Identity/RBAC
Assign the Function App's managed identity these roles:

- Log Analytics Reader on the target Log Analytics workspace
- Azure Container Apps Job Executor (or Contributor) on the job or resource group

Changes to roles can take 5–15 minutes to propagate. Restart the Function App after updating app settings.

## Endpoints
- POST /api/aca-start-job: { templateName: "owner/repo", action?: "init" | "up" | "down" | "list", mode?: "list" | "azd" }
- GET /api/aca-job-logs/{executionName}: SSE stream or polling JSON (add `?mode=poll` for JSON)
- POST /api/aca-stop-job: { executionName, originalExecutionName? }
- POST /api/template-validation: { templateName: "owner/repo", repoUrl?: "https://github.com/owner/repo", branch?: "main", callbackUrl?: "https://your-callback-url" }
- GET /api/template-validation-status?id={correlationId}: Returns the status and results of a template validation job

## Notes
- `start-job` now tolerates missing environmentId on the job resource and proceeds without it.
- Both `LOG_ANALYTICS_WORKSPACE` and `LOG_ANALYTICS_WORKSPACE_ID` are accepted for compatibility; prefer the former.
