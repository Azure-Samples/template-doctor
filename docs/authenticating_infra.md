# Authenticating the Infrastructure Calls

This document describes how the standalone Azure Function App authenticates to Azure to start ACA Jobs and query logs, and what to configure before deployment.

## Managed Identity (who runs the operations)

The standalone Function App (azurewebsites.net) calls ARM and Azure Monitor. Assign it a managed identity and grant roles:

- Choose identity type
  - System-assigned managed identity: turn On in Function App > Identity.
  - User-assigned managed identity (UAMI): create a UAMI and assign it to the Function App.
    - Set AZURE_CLIENT_ID app setting on the Function App to the UAMI’s Client ID (GUID).

## Required role assignments

Assign these roles to the Function App’s managed identity, ideally at the Resource Group containing the ACA Job and the Log Analytics workspace (or at the specific resource):

- Azure Container Apps Job Executor (or Contributor)
  - Scope: Resource group that contains the ACA Job (or the ACA Job resource).
  - Purpose: Start the job execution.
- Log Analytics Reader
  - Scope: The Log Analytics workspace used by your Container Apps Environment.
  - Purpose: Read logs for streaming to the UI.

## Application settings (environment variables) on the Function App

Set in Azure Portal > Function App > Settings > Configuration > Application settings:

- AZURE_SUBSCRIPTION_ID: Subscription GUID.
- ACA_RESOURCE_GROUP: Resource group name that contains the ACA Job.
- ACA_JOB_NAME: The ACA Job’s name.
- LOG_ANALYTICS_WORKSPACE_ID: Workspace ID (GUID) from the Log Analytics workspace properties.
- AZURE_CLIENT_ID: Only when using a UAMI; set to that UAMI’s Client ID.

Save and Restart the Function App after changes.

## CORS

The Function App should allow the SWA origin (or use permissive headers). The endpoints are anonymous for this flow:
- POST /api/start-job
- GET /api/job-logs/{executionName}

## Deployment order

1) Enable identity (system or user-assigned) on the Function App.
2) Assign roles on the correct scopes (RG/ACA Job/Workspace).
3) Add application settings and Save.
4) Restart the Function App.
5) Deploy functions-aca code and then the SWA frontend.

## Notes

- The UI tries SSE first, then falls back to JSON polling automatically if SSE fails.
- The Stop button stops local streaming, not the job; a stop endpoint can be added later.
