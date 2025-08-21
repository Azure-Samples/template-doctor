#!/bin/bash

# Script to update all dashboard HTML files to use the correct API endpoints
# This script fixes the mismatch between frontend code and backend endpoints

echo "Starting update process for all dashboard HTML files..."

# Find all dashboard HTML files that need to be updated
dashboard_files=$(find ./packages/app/results -name "*dashboard.html")

count_updated=0
count_already_updated=0

# Process each file
for file in $dashboard_files; do
  echo "Processing $file..."
  
  # Check if the file contains the outdated provision URL
  if grep -q "const provisionUrl = \`\${baseUrl}/api/provision\`;" "$file"; then
    # Replace /api/provision with /api/aca-start-job?mode=azd
    sed -i '' 's|const provisionUrl = `${baseUrl}/api/provision`;|const provisionUrl = `${baseUrl}/api/aca-start-job?mode=azd`;|g' "$file"
    
    count_updated=$((count_updated + 1))
    echo "  ✅ Updated provisionUrl"
  else
    echo "  ⏭️ provisionUrl already updated or has different format"
  fi
  
  # Check if the file contains the outdated status URL
  if grep -q "const statusUrl = \`\${baseUrl}/api/provision-status?runId=\${runId}\`;" "$file"; then
    # Replace /api/provision-status with /api/aca-job-logs/{runId}
    sed -i '' 's|const statusUrl = `${baseUrl}/api/provision-status?runId=${runId}`;|const statusUrl = `${baseUrl}/api/aca-job-logs/${runId}`;|g' "$file"
    
    count_updated=$((count_updated + 1))
    echo "  ✅ Updated statusUrl"
  else
    echo "  ⏭️ statusUrl already updated or has different format"
  fi
  
  # If file was not updated at all, count it as already updated
  if ! grep -q "const provisionUrl = \`\${baseUrl}/api/provision\`;" "$file" && \
     ! grep -q "const statusUrl = \`\${baseUrl}/api/provision-status?runId=\${runId}\`;" "$file"; then
    count_already_updated=$((count_already_updated + 1))
  fi
done

echo "Update complete!"
echo "Summary:"
echo "- $count_updated endpoint references updated"
echo "- $count_already_updated files were already up to date"
