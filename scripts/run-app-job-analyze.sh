#!/usr/bin/env bash
set -euo pipefail

# Convenience wrapper to run the ACA app job in analyze mode and stream logs
# Usage:
#   ./scripts/run-app-job-analyze.sh OWNER/REPO [TD_RUN_ID]

if [[ $# < 1 ]]; then
  echo "Usage: $0 <owner/repo> [td_run_id]" >&2
  exit 1
fi

REPO_NAME="$1"
TD_RUN_ID="${2:-analyze-$(date +%s)}"

RG="template-doctor-rg"
JOB_NAME="template-doctor-aca-job-app"
CONTAINER_NAME="app-runner"

REPO_URL="https://github.com/${REPO_NAME}.git"

echo "[analyze] Starting analyze run for ${REPO_NAME} (TD_RUN_ID=${TD_RUN_ID})"
EXEC_JSON=$(az containerapp job start -g "$RG" -n "$JOB_NAME" \
  --env-vars APP_MODE=analyze TEMPLATE_REPO_URL="$REPO_URL" TD_RUN_ID="$TD_RUN_ID" \
  -o json)
EXEC_NAME=$(echo "$EXEC_JSON" | jq -r .name)

echo "[analyze] Execution: $EXEC_NAME"

echo "[analyze] Streaming logs... (Ctrl+C to stop)"
az containerapp job logs show -g "$RG" -n "$JOB_NAME" \
  --execution "$EXEC_NAME" \
  --container "$CONTAINER_NAME" \
  --follow \
  --tail 200

echo "[analyze] Done"
