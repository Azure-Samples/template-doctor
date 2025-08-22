#!/bin/bash

# Script to create a new container job with proper environment variables and stream logs
# Using correct resource groups and resource names as per DEPLOYMENT_REFERENCE.md

# Color codes for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================================${NC}"
echo -e "${GREEN}Template Doctor Container App Job Creation and Log Streaming${NC}"
echo -e "${BLUE}======================================================${NC}"

# Correct resource information
RESOURCE_GROUP="template-doctor-rg"
CONTAINER_APP_NAME="template-doctor-aca-job"
FUNCTION_APP_NAME="template-doctor-standalone-nv"
FUNCTION_RESOURCE_GROUP="template-doctor-rg"

# Resolve API base from environment or .env file; fallback to production host
DEFAULT_API_BASE="https://template-doctor-standalone-nv.azurewebsites.net"
if [ -f "$(dirname "$0")/../.env" ]; then
  # shellcheck disable=SC2046
  export $(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$(dirname "$0")/../.env" | xargs -I{} echo {}) >/dev/null 2>&1 || true
fi
API_BASE=${API_BASE:-$DEFAULT_API_BASE}

# Test template values - modify as needed
TEMPLATE_REPO_URL="https://github.com/anfibiacreativa/todo-nodejs-mongo-swa"
AZD_TEMPLATE_NAME="todo-nodejs-mongo-swa"

# Create a new job using the function app's API endpoint
echo -e "${YELLOW}Creating a new container job through the function app...${NC}"

# Get the function app URL
FUNCTION_URL=$(az functionapp show \
  --resource-group "$FUNCTION_RESOURCE_GROUP" \
  --name "$FUNCTION_APP_NAME" \
  --query "defaultHostName" \
  --output tsv)

if [ -z "$FUNCTION_URL" ]; then
  echo -e "${RED}Error: Could not retrieve the function app URL${NC}"
  exit 1
fi

# Call the function app to create a job
echo -e "${YELLOW}Calling function to create container job...${NC}"
curl -X POST "https://$FUNCTION_URL/api/aca-start-job" \
  -H "Content-Type: application/json" \
  -d '{
    "templateRepoUrl": "'"$TEMPLATE_REPO_URL"'",
    "azdTemplateName": "'"$AZD_TEMPLATE_NAME"'"
  }'

echo ""
echo -e "${GREEN}Job creation requested.${NC}"
echo -e "${YELLOW}Waiting 10 seconds for job to start...${NC}"
sleep 10

# Get the most recent job
echo -e "${YELLOW}Fetching the most recent container job...${NC}"
JOBS=$(az containerapp job execution list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$CONTAINER_APP_NAME" \
  --output json)

if [ -z "$JOBS" ]; then
  echo -e "${RED}Error: No jobs found for $CONTAINER_APP_NAME${NC}"
  exit 1
fi

# Get the most recent job ID
LATEST_JOB=$(echo $JOBS | jq -r '[.[] | select(.properties.status != null)] | sort_by(.properties.startTime) | reverse | .[0]')
JOB_ID=$(echo $LATEST_JOB | jq -r '.name')
JOB_STATUS=$(echo $LATEST_JOB | jq -r '.properties.status')

echo -e "${GREEN}Latest job found:${NC}"
echo -e "  ID: ${BLUE}$JOB_ID${NC}"
echo -e "  Status: ${BLUE}$JOB_STATUS${NC}"

# Stream logs
echo -e "${YELLOW}Streaming logs for job $JOB_ID...${NC}"
echo -e "${BLUE}======================================================${NC}"

# The correct command for streaming logs
az containerapp job logs show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$CONTAINER_APP_NAME" \
  --execution "$JOB_ID" \
  --container "$CONTAINER_APP_NAME" \
  --follow

echo -e "${BLUE}======================================================${NC}"
echo -e "${GREEN}Log streaming completed${NC}"
