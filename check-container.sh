#!/bin/bash
# Check if the container is running and restart if needed

set -e  # Exit on any error

echo "=== Template Doctor Container Check ==="

# Check if the image exists
if ! docker images | grep -q template-doctor:local; then
  echo "Error: template-doctor:local image not found."
  echo "Please build the image first with: docker build -f packages/server/Dockerfile -t template-doctor:local ."
  exit 1
fi

# Check if container exists
if ! docker ps -a | grep -q td_local; then
  echo "Container td_local not found. Creating container..."
  docker run -d -p 4000:4000 --name td_local template-doctor:local
  echo "✅ Container created and started."
else
  # Check if container is running
  if ! docker ps | grep -q td_local; then
    echo "Container td_local exists but is not running. Starting container..."
    docker start td_local
    echo "✅ Container started."
  else
    echo "✅ Container td_local is already running."
  fi
fi

echo "Container is accessible at http://localhost:4000"
echo ""