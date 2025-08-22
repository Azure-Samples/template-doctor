# Deployment Reference

## Azure Resources

### Container App Job
- **Name**: `template-doctor-aca-job`
- **Resource Group**: `template-doctor-rg`

### New Stable Jobs (for validation and app logic)
- Healthy baseline job
  - Name: `template-doctor-aca-job-healthy`
  - Image: `templatedoctorregistry-c7avf0fbb6b0dcbt.azurecr.io/healthy-runner:20250819`
  - Purpose: always-healthy heartbeat container to validate ACA plumbing
- App runner job
  - Name: `template-doctor-aca-job-app`
  - Image: `templatedoctorregistry-c7avf0fbb6b0dcbt.azurecr.io/app-runner:20250819`
  - Purpose: runs Template Doctor app logic (repo clone or azd init + optional up/down)

### Function App
- **Name**: `template-doctor-standalone-nv`
- **Resource Group**: `template-doctor-rg`

## Important Deployment Notes

1. **Always use the `deploy-all.sh` script** for function app deployments to ensure `node_modules` are properly included
2. Do not attempt to deploy the functions manually without this script
3. The package-for-deploy.sh script has been modified to properly include node_modules, but it should be used through the deploy-all.sh script

4. ACA Managed Environment: `/subscriptions/3bcbef31-23b0-4d82-9ee4-192d70bd4a14/resourceGroups/template-doctor-rg/providers/Microsoft.App/managedEnvironments/template-doctor-aca-env`
5. Container Registry: `templatedoctorregistry-c7avf0fbb6b0dcbt.azurecr.io` (ACR)
  - Job registry identity uses `system-environment` (environment-level identity) for pulls
  - Jobs also have system-assigned identity enabled

### Container Stability Notes

Container build context is now under `containers/app-runner`. Use `./scripts/build-and-push-docker.sh` to build and push images. The previous `packages/infra/.devcontainer` path is deprecated and should not be used.

## Environment Variables
- Ensure proper environment variables are set as per .env.example:
  - GITHUB_TOKEN
  - AZURE_SUBSCRIPTION_ID
  - AZURE_TENANT_ID
  - And any other required variables for your application

### Container Job Environment Variables
- Common for app-runner:
  - `TEMPLATE_REPO_URL`: repo to analyze (optional if using `AZD_TEMPLATE_NAME`)
  - `AZD_TEMPLATE_NAME`: azd template to init (optional alternative to `TEMPLATE_REPO_URL`)
  - `TD_RUN_ID`: run identifier (free-form)
  - `AZD_ENV_NAME`: override environment name for azd smoke
  - `APP_MODE`: `azd` (default) to run up/down, or `list` to only clone/list

### Quick usage
- Start healthy job and stream logs:
  - Start: `az containerapp job start -g template-doctor-rg -n template-doctor-aca-job-healthy -o json`
  - Logs: `az containerapp job logs show -g template-doctor-rg -n template-doctor-aca-job-healthy --execution <exec> --container healthy-runner --follow --tail 50`
- Start app job and stream logs:
  - Script: `./scripts/run-app-job-and-stream.sh TEMPLATE_REPO_URL=https://github.com/anfibiacreativa/todo-nodejs-mongo-swa APP_MODE=list TD_RUN_ID=debug-1`
    - Script (analyze mode): `./scripts/run-app-job-analyze.sh anfibiacreativa/todo-nodejs-mongo-swa`
  
### Container Job Required Environment Variables
- For container jobs to work correctly, ensure these environment variables are passed:
  - **TEMPLATE_REPO_URL**: URL of the template repository to analyze
  - **AZD_TEMPLATE_NAME**: Name of the template to analyze (alternative to TEMPLATE_REPO_URL)
  - **TD_RUN_ID**: Unique identifier for the job run
