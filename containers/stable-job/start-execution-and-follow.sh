#!/usr/bin/env bash
set -euo pipefail

RG=template-doctor-rg
JOB_NAME=template-doctor-aca-job-stable

EXEC_NAME=$(az containerapp job start -g "$RG" -n "$JOB_NAME" --query name -o tsv)
echo "[RUN] execution=$EXEC_NAME"

# Try to stream logs; fallback to describing execution if no replicas
if ! az containerapp job logs show -g "$RG" -n "$JOB_NAME" --execution "$EXEC_NAME" --container "$JOB_NAME" --follow; then
  echo "[INFO] No logs yet. Showing execution details:"
  az containerapp job execution show -g "$RG" -n "$JOB_NAME" --job-execution-name "$EXEC_NAME"
fi
