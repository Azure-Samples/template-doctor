#!/bin/bash

# Generate a unique ID for this run
TIMESTAMP=$(date +%s000)
RUN_ID="test-run-$TIMESTAMP"
SCAN_ID="scan-$TIMESTAMP"
REPORT_ID="report-$TIMESTAMP"

# Try a different template this time
TEMPLATE_REPO="anfibiacreativa/todo-csharp-sql-swa-func"
TEMPLATE_NAME="todo-csharp-sql-swa-func"
TEMPLATE_BRANCH="main"

# API endpoint
# Resolve API base via .env or environment, default to prod host
DEFAULT_API_BASE="https://template-doctor-standalone-nv.azurewebsites.net"
if [ -f "$(dirname "$0")/../.env" ]; then
  # shellcheck disable=SC2046
  export $(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$(dirname "$0")/../.env" | xargs -I{} echo {}) >/dev/null 2>&1 || true
fi
API_BASE=${API_BASE:-$DEFAULT_API_BASE}
API_URL="$API_BASE/api/aca-start-job"

echo "Starting a new container job with full parameters..."
echo "Timestamp: $TIMESTAMP"
echo "Template: $TEMPLATE_REPO ($TEMPLATE_BRANCH)"

# Create the JSON payload
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

# Extract the correlation ID
CORRELATION_ID=$(echo "$RESPONSE" | grep -o '"correlationId":"[^"]*"' | cut -d '"' -f 4)

if [ -n "$CORRELATION_ID" ]; then
  echo "Job started successfully!"
  echo "Execution Name (correlation ID): $CORRELATION_ID"
  echo ""
  echo "To check status:"
  echo "curl $API_BASE/api/aca-job-status?executionName=$CORRELATION_ID"
  echo ""
  echo "To stream logs:"
  echo "curl -N -H \"Accept: text/event-stream\" $API_BASE/api/aca-job-logs/$CORRELATION_ID"
  echo ""
  echo "To fetch logs directly:"
  echo "curl -H \"Accept: application/json\" $API_BASE/api/aca-job-logs/$CORRELATION_ID"
else
  echo "Failed to start job or get correlation ID."
  echo "Please check the response for details."
fi
