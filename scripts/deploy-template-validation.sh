#!/bin/bash
# Deploy template validation functions to Azure
# 
# This script:
# 1. Installs dependencies for functions-aca
# 2. Packages the functions app 
# 3. Deploys to the Azure Function App
#
# Usage: ./deploy-template-validation.sh

set -e  # Exit on error

# Configuration
FUNCTIONS_DIR="packages/functions-aca"
FUNCTION_APP_NAME="template-doctor-standalone-nv"
RESOURCE_GROUP="template-doctor-rg"

# Display info
echo "🚀 Deploying template validation functions to $FUNCTION_APP_NAME"
echo "Working directory: $FUNCTIONS_DIR"

# Install dependencies
echo "📦 Installing dependencies..."
npm install --prefix $FUNCTIONS_DIR
npm install --prefix $FUNCTIONS_DIR node-fetch@2

# Create package
echo "📦 Creating function package..."
pushd $FUNCTIONS_DIR > /dev/null
npm prune --production
popd > /dev/null

# Deploy to Azure
echo "🚀 Deploying to Azure..."
func azure functionapp publish $FUNCTION_APP_NAME \
  --javascript \
  --no-build \
  --resource-group $RESOURCE_GROUP \
  --path $FUNCTIONS_DIR

echo "✅ Deployment complete!"
echo "You can now use the template validation API at:"
echo "- POST https://$FUNCTION_APP_NAME.azurewebsites.net/api/template-validation"
echo "- GET https://$FUNCTION_APP_NAME.azurewebsites.net/api/template-validation-status?id={correlationId}"
