#!/bin/bash
set -euo pipefail

# Packages functions-aca for deployment with production dependencies only

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/.." &> /dev/null && pwd )"
FUNC_DIR="$REPO_ROOT/packages/functions-aca"

pushd "$FUNC_DIR" > /dev/null

echo "Cleaning previous artifacts..."
rm -rf temp-deploy functions-aca.zip || true

echo "Creating deployment staging folder..."
mkdir -p temp-deploy

echo "Installing production dependencies into staging..."
cp package.json temp-deploy/
pushd temp-deploy > /dev/null
if [ -f ../package-lock.json ]; then
	cp ../package-lock.json ./
	npm ci --omit=dev
else
	NPM_CONFIG_WORKSPACES=false npm install --omit=dev
fi
popd > /dev/null

echo "Copying function assets into staging..."
cp -r host.json aca-* lib temp-deploy/

echo "Creating zip package..."
pushd temp-deploy > /dev/null
zip -r ../functions-aca.zip ./*
popd > /dev/null

echo "Package created: $FUNC_DIR/functions-aca.zip"
popd > /dev/null
