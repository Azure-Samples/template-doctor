App Runner Container

Purpose: Runs Template Doctor job logic with a robust entrypoint and app flow. Accepts either TEMPLATE_REPO_URL or AZD_TEMPLATE_NAME. Optional APP_MODE=azd will run azd up/down smoke.

Env vars:
- TEMPLATE_REPO_URL (optional)
- AZD_TEMPLATE_NAME (optional)
- TEMPLATE_NAME (optional, from Functions) — if set, infers both AZD_TEMPLATE_NAME and TEMPLATE_REPO_URL
- TD_RUN_ID (optional) or EXECUTION_ID / TD_EXECUTION_NAME (from Functions) — used for correlation
- AZD_ENV_NAME (optional)
- AZD_ACTION (optional, from Functions) — maps to APP_MODE when APP_MODE not provided (init->list, up->azd, down->azd-down)
- APP_MODE (default: azd) — supported: "list" | "analyze" | "azd" | "azd-down"

Build & Push via ACR Build:
- az acr build -r templatedoctorregistry -t app-runner:20250819 containers/app-runner

Create ACA Job (example):
- az containerapp job create -g template-doctor-rg -n template-doctor-aca-job-app \
  --environment "/subscriptions/<sub>/resourceGroups/template-doctor-rg/providers/Microsoft.App/managedEnvironments/template-doctor-aca-env" \
  --trigger-type Manual \
  --image templatedoctorregistry-c7avf0fbb6b0dcbt.azurecr.io/app-runner:20250819 \
  --registry-server templatedoctorregistry-c7avf0fbb6b0dcbt.azurecr.io \
  --registry-identity system-environment \
  --mi-system-assigned \
  --cpu 0.5 --memory 1Gi \
  --container-name app-runner \
  --env-vars CONTAINER_ROLE=app-runner APP_MODE=azd

Modes:
- list: clone/init then list contents
- analyze: run a lightweight analyzer (no Node) and emit summary + issues to /workspace/analysis.json and logs
- azd: run azd up/down smoke
- azd-down: run azd down only
