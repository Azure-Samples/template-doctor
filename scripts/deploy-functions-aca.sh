#!/bin/bash
set -euo pipefail

# Deploys functions-aca.zip to the specified Function App using zip deploy

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/.." &> /dev/null && pwd )"

FUNCTION_APP_NAME=${FUNCTION_APP_NAME:-"template-doctor-standalone-nv"}
RESOURCE_GROUP=${RESOURCE_GROUP:-"template-doctor-rg"}
SUBSCRIPTION_ID=${AZURE_SUBSCRIPTION_ID:-""}

if ! az account show > /dev/null 2>&1; then
  echo "Please login to Azure (az login) before running this script."
  exit 1
fi

if [[ -n "$SUBSCRIPTION_ID" ]]; then
  az account set --subscription "$SUBSCRIPTION_ID"
fi

"$SCRIPT_DIR/package-functions-aca.sh"

ZIP_PATH="$REPO_ROOT/packages/functions-aca/functions-aca.zip"

echo "Deploying $ZIP_PATH to $FUNCTION_APP_NAME in $RESOURCE_GROUP..."
az functionapp deployment source config-zip \
  -g "$RESOURCE_GROUP" \
  -n "$FUNCTION_APP_NAME" \
  --src "$ZIP_PATH"

echo "Deployment complete."
