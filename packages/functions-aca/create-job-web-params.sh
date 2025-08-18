#!/bin/bash

# This script creates a new job with parameters matching the test web page

# Generate a unique ID for this run
TIMESTAMP=$(date +%s000)
RUN_ID="test-run-$TIMESTAMP"
SCAN_ID="scan-$TIMESTAMP"
REPORT_ID="report-$TIMESTAMP"

# Template details 
TEMPLATE_REPO="anfibiacreativa/todo-nodejs-mongo-swa"
TEMPLATE_NAME="todo-nodejs-mongo-swa"
TEMPLATE_BRANCH="main"

# API endpoint
API_URL="https://template-doctor-standalone-nv.azurewebsites.net/api/aca-start-job"

echo "Starting a new container job with web-matched parameters..."
echo "Timestamp: $TIMESTAMP"
echo "Template: $TEMPLATE_REPO ($TEMPLATE_BRANCH)"

# Create job parameters matching the web test page
JSON_PAYLOAD=$(cat <<EOF
{
  "templateRepo": "$TEMPLATE_REPO",
  "templateName": "$TEMPLATE_NAME",
  "templateBranch": "$TEMPLATE_BRANCH",
  "runId": "$RUN_ID",
  "scanId": "$SCAN_ID",
  "reportId": "$REPORT_ID",
  "timestamp": $TIMESTAMP,
  "skipDownload": false
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

# Extract the execution name using jq if available
if command -v jq &> /dev/null; then
    EXECUTION_NAME=$(echo "$RESPONSE" | jq -r '.executionName // ""')
else
    # Fallback to pattern matching
    EXECUTION_NAME=$(echo "$RESPONSE" | grep -o 'td-[0-9]\+-[a-zA-Z0-9_-]\+')
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
else
  echo "Failed to extract execution name from response."
  echo "Please check the raw response for details."
fi
