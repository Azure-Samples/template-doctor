#!/bin/bash

# This script uses Azure CLI to directly check job status and logs

# Constants
RESOURCE_GROUP="template-doctor-rg"
CONTAINER_APP_JOB="template-doctor-aca-job"
EXECUTION_NAME="template-doctor-aca-job-auto"  # We need to find the actual name

# The execution name from the API (td-timestamp-template format)
TD_EXECUTION_NAME="$1"

if [ -z "$TD_EXECUTION_NAME" ]; then
  echo "Please provide the TD execution name as argument"
  echo "Usage: $0 <td-execution-name>"
  exit 1
fi

echo "Checking status for TD execution: $TD_EXECUTION_NAME"

# First, check if we have the Azure CLI and we're logged in
if ! command -v az &> /dev/null; then
  echo "Azure CLI not found. Please install it first."
  exit 1
fi

# Check if we're logged in
ACCOUNT=$(az account show 2>/dev/null)
if [ $? -ne 0 ]; then
  echo "Not logged in to Azure. Please run 'az login' first."
  exit 1
fi

echo "Using Azure account:"
echo "$ACCOUNT" | grep -E 'name|id'

# List all job executions to find the one for our TD execution
echo "Listing recent job executions..."
JOB_EXECUTIONS=$(az containerapp job execution list -g "$RESOURCE_GROUP" -n "$CONTAINER_APP_JOB" --query '[].{name:name,status:properties.status,startTime:properties.startTime,endTime:properties.endTime}' -o json)

echo "Recent job executions:"
echo "$JOB_EXECUTIONS" | jq .

# Get the most recent job execution
LATEST_EXECUTION=$(echo "$JOB_EXECUTIONS" | jq -r '.[0].name')
echo "Latest execution: $LATEST_EXECUTION"

# Try to get logs for this execution
if [ -n "$LATEST_EXECUTION" ]; then
  echo "Checking logs for execution: $LATEST_EXECUTION"
  
  # Try to get logs
  echo "Getting logs with Azure CLI..."
  az containerapp job logs show -g "$RESOURCE_GROUP" -n "$CONTAINER_APP_JOB" --execution "$LATEST_EXECUTION" --container "$CONTAINER_APP_JOB"
else
  echo "No job executions found"
fi
