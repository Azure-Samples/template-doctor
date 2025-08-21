#!/bin/bash

# This script tests the updated container-app-client.js with the correct environment variables
# It calls the ACA job start endpoint and checks job status with Azure CLI

# Set the template name and execution name
TEMPLATE_NAME="anfibiacreativa-todo-nodejs-mongo-coreconf"
EXECUTION_NAME="updated-env-test-$(date +%s)"
ACA_RESOURCE_GROUP="template-doctor-rg"
ACA_JOB_NAME="template-doctor-aca-job"  # Corrected job name

echo "Starting job with execution name: $EXECUTION_NAME"
echo "Template name: $TEMPLATE_NAME"

# Make the request to the deployed Azure Function
RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{\"templateName\":\"$TEMPLATE_NAME\",\"executionName\":\"$EXECUTION_NAME\"}" \
  https://template-doctor-standalone-nv.azurewebsites.net/api/aca-start-job)

echo "Response from job start endpoint:"
echo "$RESPONSE"

# Extract the correlation ID from the response (X-Correlation-Id header)
CORRELATION_ID=$(echo "$RESPONSE" | grep -o '"correlationId": "[^"]*"' | cut -d'"' -f4)
echo "Correlation ID: $CORRELATION_ID"

# Wait a bit for the job to start
echo -e "\nWaiting 5 seconds for job to start..."
sleep 5

# Get the list of job executions using Azure CLI
echo -e "\nFetching job executions from Azure CLI..."
az containerapp job execution list \
  --resource-group $ACA_RESOURCE_GROUP \
  --name $ACA_JOB_NAME \
  --output json

# Try to extract the specific job execution name from the correlation ID
echo -e "\nWaiting 5 more seconds..."
sleep 5

# Get detailed logs for this job
echo -e "\nFetching logs for the most recent job execution..."
# Get the most recent job execution
RECENT_EXECUTION=$(az containerapp job execution list \
  --resource-group $ACA_RESOURCE_GROUP \
  --name $ACA_JOB_NAME \
  --output json | jq -r '[.[] | select(.properties.status != null)] | sort_by(.properties.startTime) | reverse | .[0].name')

echo "Most recent job execution: $RECENT_EXECUTION"

if [ -n "$RECENT_EXECUTION" ]; then
  echo -e "\nFetching logs for job execution: $RECENT_EXECUTION"
  az containerapp job logs show \
    --resource-group $ACA_RESOURCE_GROUP \
    --name $ACA_JOB_NAME \
    --execution $RECENT_EXECUTION \
    --container template-doctor-aca-job
fi

echo -e "\nNow you can check logs with:"
echo "curl -N -H \"Accept: text/event-stream\" https://template-doctor-standalone-nv.azurewebsites.net/api/aca-job-logs/$CORRELATION_ID"
