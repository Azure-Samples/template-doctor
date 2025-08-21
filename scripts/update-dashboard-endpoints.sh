#!/bin/bash

# Script to update all dashboard HTML files to use the correct API endpoints
# This script fixes the mismatch between frontend code and backend endpoints

# Find all dashboard HTML files
dashboard_files=$(find ./packages/app/results -name "*dashboard.html")

# Process each file
for file in $dashboard_files; do
  echo "Processing $file..."
  
  # Check if the file needs to be updated
  if grep -q "const provisionUrl = \`\${baseUrl}/api/provision\`;" "$file"; then
    # Replace /api/provision with /api/aca-start-job?mode=azd
    sed -i '' 's|const provisionUrl = `${baseUrl}/api/provision`;|const provisionUrl = `${baseUrl}/api/aca-start-job?mode=azd`;|g' "$file"
    
    # Replace /api/provision-status with /api/aca-job-logs/{runId}
    sed -i '' 's|const statusUrl = `${baseUrl}/api/provision-status?runId=${runId}`;|const statusUrl = `${baseUrl}/api/aca-job-logs/${runId}`;|g' "$file"
    
    echo "✅ Updated $file"
  else
    echo "⏭️ File already updated or has different format, skipping"
  fi
 done

 echo "All dashboard files have been updated!"
