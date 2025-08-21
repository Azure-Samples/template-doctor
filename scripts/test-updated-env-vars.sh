#!/bin/bash

# This script tests the updated container-app-client.js with the correct environment variables
# It calls the ACA job start endpoint

# Set the template name and execution name
TEMPLATE_NAME="anfibiacreativa-todo-nodejs-mongo-coreconf"
EXECUTION_NAME="updated-env-test-$(date +%s)"

echo "Starting job with execution name: $EXECUTION_NAME"
echo "Template name: $TEMPLATE_NAME"

# Make the request to the deployed Azure Function
curl -v -X POST \
  -H "Content-Type: application/json" \
  -d "{\"templateName\":\"$TEMPLATE_NAME\",\"executionName\":\"$EXECUTION_NAME\"}" \
  https://template-doctor-standalone-nv.azurewebsites.net/api/aca-start-job

echo -e "\n\nWaiting 5 seconds to check status..."
sleep 5

# Check the status
echo "Checking job status..."
curl -v -X GET \
  https://template-doctor-standalone-nv.azurewebsites.net/api/aca-job-status?executionName=$EXECUTION_NAME

echo -e "\n\nNow you can check logs with:"
echo "curl -N -H \"Accept: text/event-stream\" https://template-doctor-standalone-nv.azurewebsites.net/api/aca-job-logs/$EXECUTION_NAME"
