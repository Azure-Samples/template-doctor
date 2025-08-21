#!/bin/bash
set -euo pipefail
# Deprecated wrapper. Please use the dashboard updater under ./scripts
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
echo "[DEPRECATED] Use ./scripts/update-dashboard-endpoints.sh (it also fixes job logs URLs)." >&2
exec "$SCRIPT_DIR/scripts/update-dashboard-endpoints.sh" "$@"
#!/bin/bash

# Script to update the URL format in all dashboard HTML files
# Changes from /api/aca-job-logs?runId=${runId} to /api/aca-job-logs/${runId}

RESULTS_DIR="./packages/app/results"

echo "========================================================"
echo "Starting update for job logs endpoint URL format..."
echo "Searching in: $RESULTS_DIR"
echo "========================================================"

# Verify the directory exists
if [ ! -d "$RESULTS_DIR" ]; then
    echo "Error: Results directory $RESULTS_DIR not found!"
    exit 1
fi

# Find all dashboard HTML files in the results directory
dashboard_files=$(find "$RESULTS_DIR" -name "*dashboard.html")

count_updated=0
count_already_correct=0
count_not_matching=0

# Process each file
for file in $dashboard_files; do
  echo "Processing $file..."
  
  # Check if the file contains the query parameter format
  if grep -q "const statusUrl = \`\${baseUrl}/api/aca-job-logs?runId=\${runId}\`;" "$file"; then
    # Replace with the path parameter format
    sed -i '' 's|const statusUrl = `${baseUrl}/api/aca-job-logs?runId=${runId}`;|const statusUrl = `${baseUrl}/api/aca-job-logs/${runId}`;|g' "$file"
    
    count_updated=$((count_updated + 1))
    echo "  ✅ Updated statusUrl format to path parameter"
  else
    # Check if it's already in the correct format
    if grep -q "const statusUrl = \`\${baseUrl}/api/aca-job-logs/\${runId}\`;" "$file"; then
      count_already_correct=$((count_already_correct + 1))
      echo "  ⏭️ statusUrl already in correct format"
    else
      count_not_matching=$((count_not_matching + 1))
      echo "  ⚠️ No matching statusUrl pattern found"
    fi
  fi
done

total_files=$((count_updated + count_already_correct + count_not_matching))

echo "========================================================"
echo "Update complete!"
echo "========================================================"
echo "Summary:"
echo "- Total dashboard files examined: $total_files"
echo "- Files updated to use path parameter format: $count_updated"
echo "- Files already in correct format: $count_already_correct"
echo "- Files with no matching pattern: $count_not_matching"
echo "========================================================"

if [ $count_updated -gt 0 ]; then
  echo "Some files were updated. Consider deploying the changes."
  echo "You can use: swa deploy --env production"
else
  echo "No files needed updating."
fi
