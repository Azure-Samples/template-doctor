#!/bin/bash

# Script to inspect the app-runner container job configuration
# Use: ./scripts/inspect-app-runner.sh

set -e  # Exit on error

# Default values - adjust as needed
CONTAINER_APP_RG="template-doctor-rg"
JOB_NAME="template-doctor-aca-job-app"

# Check if az is installed
if ! command -v az &> /dev/null; then
    echo "❌ Error: Azure CLI is not installed"
    exit 1
fi

# Check Azure CLI login status
echo "🔍 Checking Azure CLI login status..."
if ! az account show &> /dev/null; then
  echo "⚠️ Not logged in to Azure. Please log in first."
  exit 1
fi

# Get current subscription
CURRENT_SUB=$(az account show --query id -o tsv)
echo "🔍 Using subscription: $CURRENT_SUB"

# Check if Container App Job exists
echo "🔍 Checking Container App Job '$JOB_NAME'..."
if ! az containerapp job show -g "$CONTAINER_APP_RG" -n "$JOB_NAME" &> /dev/null; then
    echo "❌ Error: Container App Job '$JOB_NAME' not found in resource group '$CONTAINER_APP_RG'"
    
    # List available jobs
    echo "📋 Available jobs in resource group '$CONTAINER_APP_RG':"
    az containerapp job list -g "$CONTAINER_APP_RG" --query "[].name" -o tsv
    
    exit 1
fi

# Get full job details
echo "📊 Container App Job Details:"
az containerapp job show -g "$CONTAINER_APP_RG" -n "$JOB_NAME" -o json > job-details.json
cat job-details.json | jq

# Display key configuration
echo ""
echo "🔑 Key Configuration:"
echo "---------------------"

# Extract image
IMAGE=$(jq -r '.properties.template.containers[0].image' job-details.json)
echo "🖼️  Image: $IMAGE"

# Extract command
COMMAND=$(jq -r '.properties.template.containers[0].command | join(" ")' job-details.json)
echo "⌨️  Command: $COMMAND"

# Extract environment variables
echo "🌐 Environment Variables:"
jq -r '.properties.template.containers[0].env[] | "    - \(.name): \(.value // "<secret>")' job-details.json

# Check recent executions
echo ""
echo "📜 Recent Executions:"
echo "---------------------"
az containerapp job execution list -g "$CONTAINER_APP_RG" --job "$JOB_NAME" --query "reverse(sort_by([].{name:name, status:properties.status, startTime:properties.startTime, endTime:properties.endTime, exitCode:properties.exitCode}, &startTime))[0:5]" -o table

echo ""
echo "✅ Inspection complete. Job details saved to job-details.json"
