#!/bin/bash
set -e

# Script to build and test the improved container locally

# Color codes for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================================${NC}"
echo -e "${GREEN}Building and Testing Improved Template Doctor Container${NC}"
echo -e "${BLUE}======================================================${NC}"

# Define variables
CONTAINER_NAME="template-doctor-test"
IMAGE_NAME="app-runner-improved:local"
INFRA_DIR="./containers/app-runner"

# Check if improved files exist
echo -e "${YELLOW}Using Dockerfile at $INFRA_DIR/Dockerfile${NC}"

# Rename improved files to replace the originals (create backups)
echo -e "${YELLOW}Creating backups of original files...${NC}"
for file in "Dockerfile" "entrypoint-wrapper.sh" "start-azd-job.sh"; do
  if [[ -f "$INFRA_DIR/$file" ]]; then
    cp "$INFRA_DIR/$file" "$INFRA_DIR/$file.backup"
    echo -e "${GREEN}Created backup: $INFRA_DIR/$file.backup${NC}"
  fi
done

echo -e "${YELLOW}Building using existing container sources...${NC}"

# Build the Docker image
echo -e "${YELLOW}Building Docker image...${NC}"
docker build -t "$IMAGE_NAME" "$INFRA_DIR"
BUILD_RESULT=$?

if [ $BUILD_RESULT -ne 0 ]; then
  echo -e "${RED}Error: Docker build failed${NC}"
  exit 1
fi

echo -e "${GREEN}Docker image built successfully: $IMAGE_NAME${NC}"

# Test the container with just basic environment
echo -e "${YELLOW}Testing container startup without template (should stay alive)...${NC}"
docker run --name "$CONTAINER_NAME-basic" -d "$IMAGE_NAME"
sleep 5
CONTAINER_STATUS=$(docker inspect --format='{{.State.Status}}' "$CONTAINER_NAME-basic")
echo -e "${BLUE}Container status: $CONTAINER_STATUS${NC}"
docker logs "$CONTAINER_NAME-basic"
docker rm -f "$CONTAINER_NAME-basic"

# Test with a template repository
echo -e "${YELLOW}Testing container with TEMPLATE_REPO_URL...${NC}"
docker run --name "$CONTAINER_NAME-repo" \
  -e TEMPLATE_REPO_URL="https://github.com/anfibiacreativa/todo-nodejs-mongo-swa" \
  -e TD_RUN_ID="local-test" \
  -d "$IMAGE_NAME"
sleep 5
echo -e "${BLUE}Container logs:${NC}"
docker logs "$CONTAINER_NAME-repo"

# Wait for container to exit or timeout after 30 seconds
echo -e "${YELLOW}Waiting for container to complete (max 30 seconds)...${NC}"
TIMEOUT=30
while [ $TIMEOUT -gt 0 ]; do
  CONTAINER_STATUS=$(docker inspect --format='{{.State.Status}}' "$CONTAINER_NAME-repo" 2>/dev/null || echo "removed")
  if [ "$CONTAINER_STATUS" != "running" ]; then
    break
  fi
  sleep 1
  TIMEOUT=$((TIMEOUT-1))
done

if [ $TIMEOUT -eq 0 ]; then
  echo -e "${YELLOW}Container still running after 30 seconds, checking logs...${NC}"
  docker logs "$CONTAINER_NAME-repo"
  docker rm -f "$CONTAINER_NAME-repo"
else
  EXIT_CODE=$(docker inspect --format='{{.State.ExitCode}}' "$CONTAINER_NAME-repo" 2>/dev/null || echo "unknown")
  echo -e "${BLUE}Container exited with code: $EXIT_CODE${NC}"
  docker logs "$CONTAINER_NAME-repo"
  docker rm -f "$CONTAINER_NAME-repo" 2>/dev/null || true
fi

# Report results
echo -e "${BLUE}======================================================${NC}"
echo -e "${GREEN}Test completed${NC}"
echo -e "${YELLOW}If the tests look good, you can:${NC}"
echo -e "1. Use these improved files for the container"
echo -e "2. Build and deploy the container to Azure Container Registry"
echo -e "3. Update the Azure Container App Job to use the new image"
echo -e "${BLUE}======================================================${NC}"

# Ask if user wants to keep the improved files
echo -e "${GREEN}Done${NC}"
