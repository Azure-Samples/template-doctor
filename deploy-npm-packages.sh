#!/bin/bash
# This script sets up and deploys the Azure Container Apps integration for the Template Doctor

# Navigate to the functions-aca directory
cd "$(dirname "$0")/packages/functions-aca" || exit

# Make sure the packages are installed locally first in the functions-aca directory
echo "Installing packages locally..."
npm ci --no-fund --no-audit
npm list @azure/arm-appcontainers

# Clean existing deployment package if it exists
rm -rf ../bin ../obj

# Get the functions app name
echo "Getting Azure Functions app name..."
APP_NAME=$(az functionapp list --query "[?contains(name, 'template-doctor')].name" -o tsv)

if [ -z "$APP_NAME" ]; then
  echo "No template-doctor Azure Functions app found."
  echo "Please make sure you are logged into Azure CLI with 'az login'"
  exit 1
fi

echo "Found Azure Functions app: $APP_NAME"
FUNCTIONS_RESOURCE_GROUP=$(az functionapp list --query "[?name=='$APP_NAME'].resourceGroup" -o tsv)
echo "Functions Resource Group: $FUNCTIONS_RESOURCE_GROUP"

# Get Azure subscription ID
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
echo "Subscription ID: $SUBSCRIPTION_ID"

# Set Container App resource group and job name
# NOTE: These are different from the Functions resource group
CONTAINER_APP_RESOURCE_GROUP="template-doctor-rg"
CONTAINER_APP_JOB_NAME="template-doctor-aca-job"
echo "Container App Resource Group: $CONTAINER_APP_RESOURCE_GROUP (different from Functions resource group)"
echo "Container App Job Name: $CONTAINER_APP_JOB_NAME"

# Create a deployment zip file that includes node_modules
echo "Creating deployment package with node_modules included..."
ZIP_FILE="$(pwd)/function-deploy.zip"
rm -f "$ZIP_FILE"

# Create a zip file with all the function code and node_modules
# -r for recursive, -q for quiet, . to include all files in current directory
zip -r -q "$ZIP_FILE" . -x "*.git*" "*.vscode*" "*.zip"

# Deploy the zip package
echo "Deploying function app with node_modules included..."
az functionapp deployment source config-zip \
  --resource-group "$FUNCTIONS_RESOURCE_GROUP" \
  --name "$APP_NAME" \
  --src "$ZIP_FILE"

# Clean up the zip file
rm -f "$ZIP_FILE"

# Restart the function app
echo "Restarting Azure Functions app..."
az functionapp restart --name "$APP_NAME" --resource-group "$FUNCTIONS_RESOURCE_GROUP"

# Set the app settings to enable Container Apps integration
echo "Setting app settings for Container Apps integration..."
az functionapp config appsettings set --name "$APP_NAME" --resource-group "$FUNCTIONS_RESOURCE_GROUP" --settings \
  AZURE_SUBSCRIPTION_ID="$SUBSCRIPTION_ID" \
  ACA_RESOURCE_GROUP="$CONTAINER_APP_RESOURCE_GROUP" \
  ACA_JOB_NAME="$CONTAINER_APP_JOB_NAME"

# Verify settings were applied
echo "Verifying app settings..."
az functionapp config appsettings list --name "$APP_NAME" --resource-group "$FUNCTIONS_RESOURCE_GROUP" --output json

echo "Deployment complete!"
echo ""
echo "Configuration:"
echo "  - Azure Functions App: $APP_NAME"
echo "  - Functions Resource Group: $FUNCTIONS_RESOURCE_GROUP"
echo "  - Container App Job: $CONTAINER_APP_JOB_NAME"
echo "  - Container App Resource Group: $CONTAINER_APP_RESOURCE_GROUP"
echo ""
echo "Environment variables set in the function app:"
echo "  - AZURE_SUBSCRIPTION_ID: $SUBSCRIPTION_ID"
echo "  - ACA_RESOURCE_GROUP: $CONTAINER_APP_RESOURCE_GROUP (points to the Container App resource group)"
echo "  - ACA_JOB_NAME: $CONTAINER_APP_JOB_NAME"
echo ""
echo "Using existing Azure Container App job: '$CONTAINER_APP_JOB_NAME'"
echo "in the resource group: '$CONTAINER_APP_RESOURCE_GROUP'"
echo ""
echo "You can verify the job exists with:"
echo "az containerapp job show --name $CONTAINER_APP_JOB_NAME --resource-group $CONTAINER_APP_RESOURCE_GROUP --query \"name\" -o tsv"
