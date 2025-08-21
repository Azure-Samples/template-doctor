#!/bin/bash
set -euo pipefail

# This script builds and pushes the app-runner container image to ACR

# Navigate to the Dockerfile location in containers/app-runner
cd "$(dirname "$0")/../containers/app-runner"
echo "Working directory: $(pwd)"

# Set variables (can be overridden via env)
REGISTRY=${REGISTRY:-"templatedoctorregistry-c7avf0fbb6b0dcbt.azurecr.io"}
IMAGE_NAME=${IMAGE_NAME:-"app-runner"}
TAG=${TAG:-"latest"}

echo "Building image for $REGISTRY/$IMAGE_NAME:$TAG"

# Ensure Azure CLI is logged in
if ! az account show > /dev/null 2>&1; then
	echo "Please login to Azure (az login) before running this script."
	exit 1
fi

# Login to ACR
echo "Logging into ACR..."
az acr login --name $(echo $REGISTRY | cut -d'.' -f1)

# Build the Docker image
echo "Building Docker image..."
docker build -t "$REGISTRY/$IMAGE_NAME:$TAG" .

# Push the Docker image
echo "Pushing Docker image to ACR..."
docker push "$REGISTRY/$IMAGE_NAME:$TAG"

echo "Build and push completed successfully!"
echo "Image: $REGISTRY/$IMAGE_NAME:$TAG"
