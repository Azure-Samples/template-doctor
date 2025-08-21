#!/usr/bin/env bash
set -euo pipefail

# Build and push stable image to existing ACR used by current job
ACR=templatedoctorregistry-c7avf0fbb6b0dcbt.azurecr.io
IMAGE_NAME=stable-job
TAG=${1:-v1}
FULL_IMAGE="$ACR/$IMAGE_NAME:$TAG"

echo "[BUILD] $FULL_IMAGE"
az acr login --name "${ACR%%.*}"
docker build -t "$FULL_IMAGE" .
docker push "$FULL_IMAGE"
echo "[DONE] pushed $FULL_IMAGE"
