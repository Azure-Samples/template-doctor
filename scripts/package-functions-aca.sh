#!/bin/bash
set -euo pipefail

# Packages functions-aca for deployment with production dependencies only

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/.." &> /dev/null && pwd )"
FUNC_DIR="$REPO_ROOT/packages/functions-aca"

pushd "$FUNC_DIR" > /dev/null

echo "Cleaning previous artifacts..."
rm -rf node_modules temp-deploy functions-aca.zip || true

echo "Installing production dependencies..."
npm ci --omit=dev

echo "Creating deployment package..."
mkdir -p temp-deploy
cp -r host.json package.json node_modules aca-* lib temp-deploy/

pushd temp-deploy > /dev/null
zip -r ../functions-aca.zip ./*
popd > /dev/null

echo "Package created: $FUNC_DIR/functions-aca.zip"
popd > /dev/null
