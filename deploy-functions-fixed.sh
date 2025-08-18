#!/bin/bash

# Script to deploy updated Azure Functions to Azure
# Using actual Azure resources
FUNCTION_APP_NAME="template-doctor-standalone-nv"
RESOURCE_GROUP="templatedoctorstandalone"

# Navigate to the functions-aca directory
cd "$(dirname "$0")/packages/functions-aca"

echo "Building and deploying functions-aca..."

# Ensure dependencies are installed - force a clean installation
echo "Installing dependencies..."
rm -rf node_modules
npm install --no-workspaces

# Create a deployment package with all dependencies
echo "Creating deployment package..."
# Create a temp directory for packaging
mkdir -p ./temp-deploy

# Copy all necessary files INCLUDING node_modules
cp -r host.json local.settings.json package.json node_modules lib aca-* ./temp-deploy/

# Remove any previous zip
rm -f functions-aca.zip

# Create the zip package
cd temp-deploy
zip -r ../functions-aca.zip ./*
cd ..

# Deploy using the ZIP deployment method which preserves the exact package content
echo "Deploying to Azure Function App: $FUNCTION_APP_NAME"
az functionapp deployment source config-zip \
  -g $RESOURCE_GROUP \
  -n $FUNCTION_APP_NAME \
  --src functions-aca.zip

# Clean up
rm -rf ./temp-deploy
rm functions-aca.zip

echo "Deployment complete!"
