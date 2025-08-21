#!/bin/bash

# This script applies the endpoint URL fixes and deploys the changes

echo "🔧 Applying dashboard endpoint fixes..."
chmod +x ./scripts/update-dashboard-endpoints.sh
./scripts/update-dashboard-endpoints.sh

echo "🚀 Deploying updated functions..."
# Using the deploy-all.sh script with options to skip container and SWA deployments
./deploy-all.sh --skip-container --skip-swa

echo "✅ Deployment complete!"
