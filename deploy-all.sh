#!/bin/bash

# Consolidated deployment script for Template Doctor
# Deploys:
# 1. Container App + Job (template-doctor-rg)
# 2. Function App (templatedoctorstandalone)
# 3. Static Web App (SWA)

set -e  # Exit on error

# Display help
show_help() {
  echo "Template Doctor Deployment Script"
  echo "================================="
  echo "This script deploys all components of Template Doctor:"
  echo "  - Container App Job for running AZD commands"
  echo "  - Azure Functions for backend API"
  echo "  - Static Web App for frontend UI"
  echo ""
  echo "Usage: $0 [options]"
  echo ""
  echo "Options:"
  echo "  -h, --help                  Show this help message"
  echo "  -s, --subscription ID       Azure Subscription ID"
  echo "  -t, --tenant ID             Azure Tenant ID"
  echo "  -l, --location LOCATION     Azure region (default: eastus)"
  echo "  -c, --container-rg NAME     Container App resource group (default: template-doctor-rg)"
  echo "  -f, --function-rg NAME      Function App resource group (default: templatedoctorstandalone)"
  echo "  -n, --function-name NAME    Function App name (default: template-doctor-standalone-nv)"
  echo "  -j, --job-name NAME         Container App Job name (default: template-doctor-aca-job)"
  echo "  --skip-container            Skip Container App deployment"
  echo "  --skip-function             Skip Function App deployment"
  echo "  --skip-swa                  Skip Static Web App deployment"
  echo ""
}

# Default values
LOCATION="eastus"
CONTAINER_APP_RG="template-doctor-rg"
FUNCTION_APP_RG="templatedoctorstandalone"
FUNCTION_APP_NAME="template-doctor-standalone-nv"
CONTAINER_APP_JOB_NAME="template-doctor-aca-job"
SKIP_CONTAINER=false
SKIP_FUNCTION=false
SKIP_SWA=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      show_help
      exit 0
      ;;
    -s|--subscription)
      export AZURE_SUBSCRIPTION_ID="$2"
      shift 2
      ;;
    -t|--tenant)
      export AZURE_TENANT_ID="$2"
      shift 2
      ;;
    -l|--location)
      LOCATION="$2"
      shift 2
      ;;
    -c|--container-rg)
      CONTAINER_APP_RG="$2"
      shift 2
      ;;
    -f|--function-rg)
      FUNCTION_APP_RG="$2"
      shift 2
      ;;
    -n|--function-name)
      FUNCTION_APP_NAME="$2"
      shift 2
      ;;
    -j|--job-name)
      CONTAINER_APP_JOB_NAME="$2"
      shift 2
      ;;
    --skip-container)
      SKIP_CONTAINER=true
      shift
      ;;
    --skip-function)
      SKIP_FUNCTION=true
      shift
      ;;
    --skip-swa)
      SKIP_SWA=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
done

# Check required environment variables
if [[ -z "${AZURE_SUBSCRIPTION_ID}" ]]; then
  # Try to load from .env file if it exists
  if [[ -f .env ]]; then
    echo "🔍 Loading environment variables from .env file..."
    source .env
  fi
  
  # If still not set, prompt the user
  if [[ -z "${AZURE_SUBSCRIPTION_ID}" ]]; then
    echo "⚠️ AZURE_SUBSCRIPTION_ID is not set. Please set it using the -s option or in .env file."
    exit 1
  fi
fi

echo "� Starting consolidated deployment of Template Doctor components..."
echo "📋 Deployment configuration:"
echo "  - Subscription ID: $AZURE_SUBSCRIPTION_ID"
echo "  - Location: $LOCATION"
echo "  - Container App RG: $CONTAINER_APP_RG"
echo "  - Function App RG: $FUNCTION_APP_RG"
echo "  - Function App Name: $FUNCTION_APP_NAME"
echo "  - Container App Job Name: $CONTAINER_APP_JOB_NAME"

# Check Azure CLI login status
echo "�🔍 Checking Azure CLI login status..."
if ! az account show &> /dev/null; then
  echo "⚠️ Not logged in to Azure. Logging in..."
  if [[ -n "${AZURE_TENANT_ID}" ]]; then
    az login --tenant "$AZURE_TENANT_ID"
  else
    az login
  fi
fi

echo "🔍 Setting subscription..."
az account set --subscription "$AZURE_SUBSCRIPTION_ID"

# Validate subscription is set correctly
CURRENT_SUB=$(az account show --query id -o tsv)
if [[ "$CURRENT_SUB" != "$AZURE_SUBSCRIPTION_ID" ]]; then
  echo "⚠️ Failed to set subscription to $AZURE_SUBSCRIPTION_ID"
  exit 1
fi

# Step 1: Deploy the Function App (functions-aca)
if [[ "$SKIP_FUNCTION" != "true" ]]; then
  echo "🔄 Deploying Function App (functions-aca) to $FUNCTION_APP_NAME..."
  
  # Check if Function App exists
  if ! az functionapp show --name "$FUNCTION_APP_NAME" --resource-group "$FUNCTION_APP_RG" &> /dev/null; then
    echo "⚠️ Function App $FUNCTION_APP_NAME does not exist in resource group $FUNCTION_APP_RG"
    echo "   Please create the Function App first."
    exit 1
  fi
  
  # Package the Function App
  echo "🔧 Building functions-aca package..."
  cd packages/functions-aca
  
  # Check if package-for-deploy.sh exists and is executable
  if [[ -x "./package-for-deploy.sh" ]]; then
    echo "📦 Running package script..."
    ./package-for-deploy.sh
  else
    echo "📦 Creating package manually..."
    npm install
    npm prune --production
    
    # Create a temp directory for packaging
    mkdir -p ./temp-deploy
    
    # Copy all necessary files
    cp -r host.json local.settings.json package.json lib aca-* ./temp-deploy/
    
    # Remove any previous zip
    rm -f functions-aca.zip
    
    # Create the zip package
    cd temp-deploy
    zip -r ../functions-aca.zip ./*
    cd ..
    
    # Clean up the temp directory
    rm -rf ./temp-deploy
  fi
  
  # Check if the zip file was created
  if [[ ! -f "./functions-aca.zip" ]]; then
    echo "⚠️ Failed to create functions-aca.zip package"
    exit 1
  fi
  
  echo "🚀 Deploying to Function App..."
  az functionapp deployment source config-zip \
    --resource-group "$FUNCTION_APP_RG" \
    --name "$FUNCTION_APP_NAME" \
    --src "./functions-aca.zip" \
    --verbose
  
  deployment_status=$?
  
  # Return to root directory
  cd ../..
  
  if [[ $deployment_status -ne 0 ]]; then
    echo "⚠️ Function App deployment failed"
    exit 1
  fi
  
  echo "✅ Function App deployment completed"
else
  echo "⏩ Skipping Function App deployment as requested"
fi

# Step 2: Deploy Container App and Job
if [[ "$SKIP_CONTAINER" != "true" ]]; then
  echo "🔄 Deploying Container App + Job to $CONTAINER_APP_RG..."
  
  # Check if the resource group exists
  if ! az group show -n "$CONTAINER_APP_RG" &> /dev/null; then
    echo "⚠️ Resource group $CONTAINER_APP_RG doesn't exist. Creating..."
    az group create --name "$CONTAINER_APP_RG" --location "$LOCATION"
  fi
  
  # Get the Container App configuration
  echo "🔍 Checking if Container App Job $CONTAINER_APP_JOB_NAME exists..."
  
  if az containerapp job show -g "$CONTAINER_APP_RG" -n "$CONTAINER_APP_JOB_NAME" &> /dev/null; then
    echo "✅ Container App Job exists, updating..."
    
    # Update the Container App Job
    az containerapp job update \
      -g "$CONTAINER_APP_RG" \
      -n "$CONTAINER_APP_JOB_NAME" \
      --image "mcr.microsoft.com/azure-cli:latest" \
      --command "sh,-c,apt-get update && apt-get install -y curl unzip && curl -fsSL https://aka.ms/install-azd.sh | bash && azd version && tail -f /dev/null" \
      --set-env-vars AZURE_SUBSCRIPTION_ID="$AZURE_SUBSCRIPTION_ID" TEMPLATE_DOCTOR_MODE="azd"
  else
    echo "⚠️ Container App Job doesn't exist. Creating..."
    
    # Create the Container App Job
    az containerapp job create \
      -g "$CONTAINER_APP_RG" \
      -n "$CONTAINER_APP_JOB_NAME" \
      --image "mcr.microsoft.com/azure-cli:latest" \
      --command "sh,-c,apt-get update && apt-get install -y curl unzip && curl -fsSL https://aka.ms/install-azd.sh | bash && azd version && tail -f /dev/null" \
      --trigger-type Manual \
      --replica-timeout 1800 \
      --replica-retry-limit 1 \
      --replica-completion-count 1 \
      --parallelism 1 \
      --cpu 1.0 \
      --memory 2.0Gi \
      --env-vars "AZURE_SUBSCRIPTION_ID=$AZURE_SUBSCRIPTION_ID" "TEMPLATE_DOCTOR_MODE=azd" \
      --location "$LOCATION"
  fi
  
  echo "✅ Container App Job deployment completed"
else
  echo "⏩ Skipping Container App deployment as requested"
fi

# Step 3: Update Function App settings to point to Container App
if [[ "$SKIP_FUNCTION" != "true" && "$SKIP_CONTAINER" != "true" ]]; then
  echo "🔧 Updating Function App environment variables..."
  az functionapp config appsettings set \
    --resource-group "$FUNCTION_APP_RG" \
    --name "$FUNCTION_APP_NAME" \
    --settings \
    "AZURE_SUBSCRIPTION_ID=$AZURE_SUBSCRIPTION_ID" \
    "ACA_RESOURCE_GROUP=$CONTAINER_APP_RG" \
    "ACA_JOB_NAME=$CONTAINER_APP_JOB_NAME"
    
  echo "✅ Function App settings updated"
fi

# Step 4: Deploy Static Web App using SWA CLI
if [[ "$SKIP_SWA" != "true" ]]; then
  echo "🔄 Deploying Static Web App using SWA CLI..."
  
  # Check if SWA CLI is installed
  if ! command -v swa &> /dev/null; then
    echo "⚠️ SWA CLI is not installed. Installing..."
    npm install -g @azure/static-web-apps-cli
  fi
  
  # Check if swa-cli.config.json exists
  if [[ ! -f "swa-cli.config.json" ]]; then
    echo "⚠️ swa-cli.config.json not found. Cannot deploy SWA."
    exit 1
  fi
  
  # Deploy the SWA using the config
  echo "🚀 Deploying SWA application..."
  swa deploy --env production
  
  echo "✅ Static Web App deployment completed"
else
  echo "⏩ Skipping Static Web App deployment as requested"
fi

echo "✅ Consolidated deployment completed successfully!"
echo "🔗 Function App: https://$FUNCTION_APP_NAME.azurewebsites.net"
echo "🔗 Static Web App: Check the SWA deployment output for the URL"
echo "🔗 Container App Job: Available in Azure Portal in resource group $CONTAINER_APP_RG"

# Print verification steps
echo ""
echo "🔍 Verification Steps:"
echo "1. Check the Function App status:"
echo "   az functionapp show --name $FUNCTION_APP_NAME --resource-group $FUNCTION_APP_RG --query state"
echo ""
echo "2. Check the Container App Job status:"
echo "   az containerapp job show -g $CONTAINER_APP_RG -n $CONTAINER_APP_JOB_NAME --query properties.provisioningState"
echo ""
echo "3. Test the Function App endpoints:"
echo "   - Health Check: curl https://$FUNCTION_APP_NAME.azurewebsites.net/api/health-check"
echo "   - Job Status: curl https://$FUNCTION_APP_NAME.azurewebsites.net/api/aca-job-status?name=test"
echo ""
echo "4. Test the Static Web App by visiting its URL in a browser"
