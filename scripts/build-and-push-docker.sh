#!/bin/bash
set -euo pipefail

# This script builds and pushes the template-doctor ACA container image
# with the updated code changes to handle the template name and action.

# Navigate to the Dockerfile location
cd "$(dirname "$0")/../packages/infra/.devcontainer"
echo "Working directory: $(pwd)"

# Set variables
REGISTRY="templatedoctorregistry-c7avf0fbb6b0dcbt.azurecr.io"
IMAGE_NAME="template-doctor-aca"
TAG="latest"

echo "Building image for $REGISTRY/$IMAGE_NAME:$TAG"

# Login to Azure (needed for ACR access)
echo "Logging into Azure..."
az login --interactive

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
