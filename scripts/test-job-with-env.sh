#!/bin/bash

# Generate a unique ID for this run
TIMESTAMP=$(date +%s000)
RUN_ID="test-run-$TIMESTAMP"
SCAN_ID="scan-$TIMESTAMP"
REPORT_ID="report-$TIMESTAMP"

# Try a different template this time
TEMPLATE_REPO="anfibiacreativa/todo-nodejs-mongo-swa"
TEMPLATE_NAME="todo-nodejs-mongo-swa"
TEMPLATE_BRANCH="main"

# API endpoint
API_URL="https://template-doctor-standalone-nv.azurewebsites.net/api/aca-start-job"

echo "Starting a new container job with more detailed parameters..."
echo "Timestamp: $TIMESTAMP"
echo "Template: $TEMPLATE_REPO ($TEMPLATE_BRANCH)"

# Create the JSON payload with enhanced parameters
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
  "debug": true,
  "action": "init",
  "environment": {
    "AZURE_CLIENT_ID": "client_id_placeholder",
    "AZURE_TENANT_ID": "tenant_id_placeholder",
    "AZURE_SUBSCRIPTION_ID": "subscription_id_placeholder",
    "AZURE_LOCATION": "eastus",
    "GITHUB_TOKEN": "github_token_placeholder"
  }
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
  echo ""
  echo "To check status:"
  echo "curl https://template-doctor-standalone-nv.azurewebsites.net/api/aca-job-status?executionName=$EXECUTION_NAME"
  echo ""
  echo "To stream logs:"
  echo "curl -N -H \"Accept: text/event-stream\" https://template-doctor-standalone-nv.azurewebsites.net/api/aca-job-logs/$EXECUTION_NAME"
  echo ""
  echo "To fetch logs directly:"
  echo "curl -H \"Accept: application/json\" https://template-doctor-standalone-nv.azurewebsites.net/api/aca-job-logs/$EXECUTION_NAME"
else
  echo "Failed to start job or get execution name."
  echo "Please check the response for details."
fi
