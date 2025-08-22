#!/bin/bash

# This script creates a new job with clearer parameters and then checks it directly

# Generate a unique ID for this run
TIMESTAMP=$(date +%s000)
RUN_ID="test-run-$TIMESTAMP"
SCAN_ID="scan-$TIMESTAMP"
REPORT_ID="report-$TIMESTAMP"

# Template details 
TEMPLATE_REPO="anfibiacreativa/todo-nodejs-mongo-swa"
TEMPLATE_NAME="todo-nodejs-mongo-swa"
TEMPLATE_BRANCH="main"

# Constants for checking job status
RESOURCE_GROUP="template-doctor-rg"
CONTAINER_APP_JOB="template-doctor-aca-job"

# API endpoint
# Resolve API base from environment or .env, with production fallback
DEFAULT_API_BASE="https://template-doctor-standalone-nv.azurewebsites.net"
if [ -f "$(dirname "$0")/../.env" ]; then
  # shellcheck disable=SC2046
  export $(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$(dirname "$0")/../.env" | xargs -I{} echo {}) >/dev/null 2>&1 || true
fi
API_BASE=${API_BASE:-$DEFAULT_API_BASE}
API_URL="$API_BASE/api/aca-start-job"

echo "Starting a new container job with minimal parameters..."
echo "Timestamp: $TIMESTAMP"
echo "Template: $TEMPLATE_REPO ($TEMPLATE_BRANCH)"

# Create a simpler JSON payload
JSON_PAYLOAD=$(cat <<EOF
{
  "templateRepo": "$TEMPLATE_REPO",
  "templateName": "$TEMPLATE_NAME",
  "templateBranch": "$TEMPLATE_BRANCH",
  "runId": "$RUN_ID",
  "scanId": "$SCAN_ID",
  "reportId": "$REPORT_ID",
  "timestamp": $TIMESTAMP,
  "skipDownload": false,
  "debug": true
}
EOF
)

echo "Request payload:"
echo "$JSON_PAYLOAD"
echo ""

# Make the API call
echo "Sending request to $API_URL..."
RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD" \
  "$API_URL")

echo "Response:"
echo "$RESPONSE"
echo ""

# Extract the execution name directly
EXECUTION_NAME=$(echo "$RESPONSE" | grep -o '"executionName":"[^"]*"' | cut -d '"' -f 4)

if [ -n "$EXECUTION_NAME" ]; then
  echo "Job started successfully!"
  echo "Execution Name: $EXECUTION_NAME"
  
  # Wait a bit for the job to start
  echo "Waiting 5 seconds for job to start..."
  sleep 5
  
  # Check status
  echo "Checking status..."
  STATUS_RESPONSE=$(curl -s "$API_BASE/api/aca-job-status?executionName=$EXECUTION_NAME")
  echo "Status response:"
  echo "$STATUS_RESPONSE"
  echo ""
  
  # Check logs
  echo "Checking logs..."
  LOGS_RESPONSE=$(curl -s -H "Accept: application/json" "$API_BASE/api/aca-job-logs/$EXECUTION_NAME")
  echo "Logs response:"
  echo "$LOGS_RESPONSE"
  echo ""
  
  # Try Azure CLI to check job
  if command -v az &> /dev/null; then
    # Check if we're logged in
    ACCOUNT=$(az account show 2>/dev/null)
    if [ $? -eq 0 ]; then
      echo "Using Azure CLI to check jobs..."
      
      # List recent job executions
      echo "Listing recent job executions..."
      JOB_EXECUTIONS=$(az containerapp job execution list -g "$RESOURCE_GROUP" -n "$CONTAINER_APP_JOB" --query "[?contains(properties.startTime, '$(date +%Y-%m-%d)')].{name:name,status:properties.status,startTime:properties.startTime,endTime:properties.endTime}" -o json)
      
      echo "Today's job executions:"
      echo "$JOB_EXECUTIONS" | jq .
      
      # Try to get execution details
      echo "Getting execution details from Azure CLI..."
      az containerapp job execution show -g "$RESOURCE_GROUP" -n "$CONTAINER_APP_JOB" --execution "${CONTAINER_APP_JOB}-auto" 2>/dev/null || echo "Could not find specific execution"
    else
      echo "Not logged in to Azure. Skipping Azure CLI checks."
    fi
  else
    echo "Azure CLI not found. Skipping Azure CLI checks."
  fi
else
  echo "Failed to start job or get execution name."
  echo "Please check the response for details."
fi
