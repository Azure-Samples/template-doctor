#!/usr/bin/env bash
set -euo pipefail

RG=template-doctor-rg
ENV_NAME=template-doctor-aca-env
JOB_NAME=template-doctor-aca-job-stable
ACR=templatedoctorregistry-c7avf0fbb6b0dcbt.azurecr.io
IMAGE=${1:-$ACR/stable-job:v1}

# Create job using same environment and identity model
az containerapp job create \
  -g "$RG" -n "$JOB_NAME" \
  --environment "$ENV_NAME" \
  --trigger-type Manual \
  --replica-timeout 1800 \
  --replica-retry-limit 0 \
  --parallelism 1 \
  --replica-completion-count 1 \
  --workload-profile-name Consumption \
  --image "$IMAGE" \
  --cpu 0.5 --memory 1Gi \
  --system-assigned \
  --registry-server "$ACR" \
  --registry-identity system-environment \
  --env-vars TEMPLATE_DOCTOR_MODE=stable

echo "[DONE] Job $JOB_NAME created"
