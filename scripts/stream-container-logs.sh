#!/bin/bash

# Script to stream logs from the Template Doctor Container App Job
# Using correct resource groups and resource names as per DEPLOYMENT_REFERENCE.md

# Color codes for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================================${NC}"
echo -e "${GREEN}Template Doctor Container App Log Streaming${NC}"
echo -e "${BLUE}======================================================${NC}"

# Correct resource information
RESOURCE_GROUP="template-doctor-rg"
CONTAINER_APP_NAME="template-doctor-aca-job"

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
