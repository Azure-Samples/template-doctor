#!/bin/bash
set -euo pipefail

# This script runs an azd test job for a template and streams logs

# Get the current directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/.." &> /dev/null && pwd )"

# Source the environment variables from .env file if it exists
if [[ -f "$REPO_ROOT/.env" ]]; then
  echo "Loading environment variables from .env file"
  source "$REPO_ROOT/.env"
fi

# Azure Container Registry details
ACA_RESOURCE_GROUP=${ACA_RESOURCE_GROUP:-""}
ACA_JOB_NAME=${ACA_JOB_NAME:-"template-doctor-job"}
AZURE_SUBSCRIPTION_ID=${AZURE_SUBSCRIPTION_ID:-""}

# Template to test
TEMPLATE_NAME=${1:-"Azure-Samples/todo-nodejs-mongo-aca"}

# Check if required variables are set
if [[ -z "$ACA_RESOURCE_GROUP" || -z "$AZURE_SUBSCRIPTION_ID" ]]; then
  echo "Error: Missing required environment variables."
  echo "Please set ACA_RESOURCE_GROUP and AZURE_SUBSCRIPTION_ID."
  echo "You can set them in a .env file in the repository root."
  exit 1
fi

# Generate a unique run ID
TD_RUN_ID="test-$(date +%s)"

echo "Starting AZD test job for template: $TEMPLATE_NAME"
echo "Run ID: $TD_RUN_ID"

# Start the job
az containerapp job start \
  --name "$ACA_JOB_NAME" \
  --resource-group "$ACA_RESOURCE_GROUP" \
  --subscription "$AZURE_SUBSCRIPTION_ID" \
  --container-name "app-runner" \
  --env-vars \
    "TEMPLATE_NAME=$TEMPLATE_NAME" \
    "AZD_TEMPLATE_NAME=$TEMPLATE_NAME" \
    "APP_MODE=azd" \
    "TD_RUN_ID=$TD_RUN_ID"

echo "Job started. Streaming logs..."

# Get the job execution name
sleep 5
EXECUTION_NAME=$(az containerapp job execution list \
  --name "$ACA_JOB_NAME" \
  --resource-group "$ACA_RESOURCE_GROUP" \
  --subscription "$AZURE_SUBSCRIPTION_ID" \
  --query "reverse(sort_by([].{name:name,startTime:properties.startTime}, &startTime))[0].name" \
  -o tsv)

if [[ -z "$EXECUTION_NAME" ]]; then
  echo "Error: Could not determine job execution name. Cannot stream logs."
  exit 1
fi

echo "Job execution name: $EXECUTION_NAME"

# Stream logs
az containerapp job logs show \
  --name "$ACA_JOB_NAME" \
  --resource-group "$ACA_RESOURCE_GROUP" \
  --subscription "$AZURE_SUBSCRIPTION_ID" \
  --execution "$EXECUTION_NAME" \
  --container "app-runner" \
  --follow
