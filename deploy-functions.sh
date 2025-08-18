#!/bin/bash

# Script to deploy updated Azure Functions to Azure
# Using actual Azure resources
FUNCTION_APP_NAME="template-doctor-standalone-nv"
RESOURCE_GROUP="templatedoctorstandalone"

echo "Building and deploying functions-aca..."
cd "$(dirname "$0")/packages/functions-aca"

# Ensure dependencies are installed
npm install

# Deploy to Azure
echo "Deploying to Azure Function App: $FUNCTION_APP_NAME"
func azure functionapp publish $FUNCTION_APP_NAME

echo "Deployment complete!"
