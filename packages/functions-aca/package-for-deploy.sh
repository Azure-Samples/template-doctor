#!/bin/bash

# Package functions-aca for deployment
set -e

# Make sure we're in the functions-aca directory
if [[ $(basename "$PWD") != "functions-aca" ]]; then
  echo "⚠️ This script must be run from the functions-aca directory"
  exit 1
fi

echo "🔧 Installing dependencies..."
npm install

echo "🔧 Pruning dev dependencies..."
npm prune --production

echo "📦 Creating deployment package..."
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

echo "✅ Package created: functions-aca.zip"
echo "Run 'az functionapp deployment source config-zip' to deploy this package"
