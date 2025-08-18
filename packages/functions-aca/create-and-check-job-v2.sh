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
API_URL="https://template-doctor-standalone-nv.azurewebsites.net/api/aca-start-job"

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

# Print the raw response to help with debugging
echo "Raw response content for debugging:"
echo "$RESPONSE"
echo ""

# Extract the execution name using different methods
EXECUTION_NAME_GREP=$(echo "$RESPONSE" | grep -o '"executionName":"[^"]*"' | cut -d '"' -f 4)
echo "Grep execution name: $EXECUTION_NAME_GREP"

# Try using jq if available
if command -v jq &> /dev/null; then
    EXECUTION_NAME_JQ=$(echo "$RESPONSE" | jq -r '.executionName // "not_found"')
    echo "JQ execution name: $EXECUTION_NAME_JQ"
    
    if [ "$EXECUTION_NAME_JQ" != "not_found" ]; then
        EXECUTION_NAME="$EXECUTION_NAME_JQ"
    fi
else
    echo "jq not found, using grep method"
    EXECUTION_NAME="$EXECUTION_NAME_GREP"
fi

# Try a more direct approach if the above methods fail
if [ -z "$EXECUTION_NAME" ]; then
    # Look for td-TIMESTAMP-template pattern in the response
    TD_PATTERN=$(echo "$RESPONSE" | grep -o 'td-[0-9]\+-[a-zA-Z0-9_-]\+')
    if [ -n "$TD_PATTERN" ]; then
        echo "Found TD pattern: $TD_PATTERN"
        EXECUTION_NAME="$TD_PATTERN"
    fi
fi

if [ -n "$EXECUTION_NAME" ]; then
  echo "Job started successfully!"
  echo "Execution Name: $EXECUTION_NAME"
  
  # Wait a bit for the job to start
  echo "Waiting 5 seconds for job to start..."
  sleep 5
  
  # Check status
  echo "Checking status..."
  STATUS_RESPONSE=$(curl -s "https://template-doctor-standalone-nv.azurewebsites.net/api/aca-job-status?executionName=$EXECUTION_NAME")
  echo "Status response:"
  echo "$STATUS_RESPONSE"
  echo ""
  
  # Check logs
  echo "Checking logs..."
  LOGS_RESPONSE=$(curl -s -H "Accept: application/json" "https://template-doctor-standalone-nv.azurewebsites.net/api/aca-job-logs/$EXECUTION_NAME")
  echo "Logs response:"
  echo "$LOGS_RESPONSE"
  echo ""
  
  # Wait a bit more to see if logs appear
  echo "Waiting 5 more seconds to see if logs appear..."
  sleep 5
  
  # Check logs again
  echo "Checking logs again..."
  LOGS_RESPONSE=$(curl -s -H "Accept: application/json" "https://template-doctor-standalone-nv.azurewebsites.net/api/aca-job-logs/$EXECUTION_NAME")
  echo "Logs response (2nd attempt):"
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
      echo "$JOB_EXECUTIONS"
    else
      echo "Not logged in to Azure. Skipping Azure CLI checks."
    fi
  else
    echo "Azure CLI not found. Skipping Azure CLI checks."
  fi
else
  echo "Failed to extract execution name from response."
  echo "Please check the raw response for details."
fi
