#!/bin/bash

# Azure Container Apps Deployment Script
# This script deploys Template Doctor to Azure Container Apps with EasyAuth

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    print_error "Azure CLI is not installed. Please install it from https://docs.microsoft.com/cli/azure/install-azure-cli"
    exit 1
fi

# Check if logged in to Azure
if ! az account show &> /dev/null; then
    print_error "Not logged in to Azure. Please run 'az login' first."
    exit 1
fi

# Default values
RESOURCE_GROUP="${RESOURCE_GROUP:-template-doctor-rg}"
LOCATION="${LOCATION:-eastus}"
PARAMETERS_FILE="${PARAMETERS_FILE:-infra/main.parameters.json}"

print_info "Starting deployment of Template Doctor to Azure Container Apps"
print_info "Resource Group: $RESOURCE_GROUP"
print_info "Location: $LOCATION"
print_info "Parameters File: $PARAMETERS_FILE"

# Check if parameters file exists
if [ ! -f "$PARAMETERS_FILE" ]; then
    print_error "Parameters file not found: $PARAMETERS_FILE"
    print_info "Please copy infra/main.parameters.json.example to $PARAMETERS_FILE and fill in your values"
    exit 1
fi

# Confirm deployment
read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Deployment cancelled"
    exit 0
fi

# Create resource group if it doesn't exist
print_info "Creating resource group..."
az group create \
    --name "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --output none

print_info "Resource group created/verified"

# Deploy the Bicep template
print_info "Deploying Bicep template..."
DEPLOYMENT_OUTPUT=$(az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --template-file infra/main.bicep \
    --parameters "@$PARAMETERS_FILE" \
    --output json)

if [ $? -ne 0 ]; then
    print_error "Deployment failed"
    exit 1
fi

print_info "Deployment completed successfully!"

# Extract outputs
APP_URL=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.containerAppUrl.value')
APP_FQDN=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.containerAppFQDN.value')

print_info "Application deployed to: $APP_URL"
print_info "Application FQDN: $APP_FQDN"

# Reminder about GitHub OAuth configuration
print_warn "IMPORTANT: Update your GitHub OAuth App settings:"
print_warn "  - Homepage URL: $APP_URL"
print_warn "  - Authorization callback URL: $APP_URL/.auth/login/github/callback"

print_info "Deployment complete! Visit $APP_URL to access the application."
