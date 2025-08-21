#!/usr/bin/env bash
set -euo pipefail

# Run an execution of the new ACA app job with optional env overrides and stream logs
# Usage examples:
#   ./scripts/run-app-job-and-stream.sh
#   ./scripts/run-app-job-and-stream.sh TEMPLATE_REPO_URL=https://github.com/... TD_RUN_ID=run-123 APP_MODE=list

RG="template-doctor-rg"
JOB_NAME="template-doctor-aca-job-app"
CONTAINER_NAME="app-runner"

# Collect key=value args as --env-vars list
ENV_ARGS=()
if [[ $# -gt 0 ]]; then
  ENV_JOINED=$(printf "%s " "$@")
  ENV_ARGS=(--env-vars ${ENV_JOINED})
fi

echo "[run-app-job] Starting job execution for ${JOB_NAME} in ${RG}..."
EXEC_JSON=$(az containerapp job start -g "$RG" -n "$JOB_NAME" "${ENV_ARGS[@]}" -o json)
EXEC_NAME=$(echo "$EXEC_JSON" | jq -r .name)
echo "[run-app-job] Execution started: $EXEC_NAME"

echo "[run-app-job] Streaming logs... (Ctrl+C to stop)"
az containerapp job logs show -g "$RG" -n "$JOB_NAME" \
  --execution "$EXEC_NAME" \
  --container "$CONTAINER_NAME" \
  --follow \
  --tail 100

echo "[run-app-job] Done"
