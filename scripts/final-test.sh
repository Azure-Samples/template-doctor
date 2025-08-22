#!/bin/bash

# This script tests the updated container-app-client.js with the correct environment variables
# It calls the ACA job start endpoint and then immediately checks logs

# Set the template name and execution name
TEMPLATE_NAME="anfibiacreativa-todo-nodejs-mongo-coreconf"
EXECUTION_NAME="final-test-$(date +%s)"

echo "Starting job with execution name: $EXECUTION_NAME"
echo "Template name: $TEMPLATE_NAME"

# Make the request to the deployed Azure Function
RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{\"templateName\":\"$TEMPLATE_NAME\",\"executionName\":\"$EXECUTION_NAME\"}" \
  # Resolve API base via .env or environment, default to prod host
  DEFAULT_API_BASE="https://template-doctor-standalone-nv.azurewebsites.net"
  if [ -f "$(dirname "$0")/../.env" ]; then
    # shellcheck disable=SC2046
    export $(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$(dirname "$0")/../.env" | xargs -I{} echo {}) >/dev/null 2>&1 || true
  fi
  API_BASE=${API_BASE:-$DEFAULT_API_BASE}
  $API_BASE/api/aca-start-job)

echo "Response from job start endpoint:"
echo "$RESPONSE"

# Extract the correlation ID from the response
CORRELATION_ID=$(echo "$RESPONSE" | grep -o '"correlationId": "[^"]*"' | cut -d'"' -f4)
echo "Correlation ID: $CORRELATION_ID"

# Immediately check logs
echo -e "\nImmediately checking logs..."
curl -N -H "Accept: text/event-stream" "$API_BASE/api/aca-job-logs/$CORRELATION_ID" &
LOG_PID=$!

# Let it run for a few seconds
sleep 10
kill $LOG_PID

# Check job status
echo -e "\nChecking job status..."
curl -s "$API_BASE/api/aca-job-status?executionName=$CORRELATION_ID"
