#!/bin/bash

# Script to revert the URL format in all dashboard HTML files
# Changes from /api/aca-job-logs?runId=${runId} to /api/aca-job-logs/${runId}

RESULTS_DIR="./packages/app/results"

echo "========================================================"
echo "Starting revert for job logs endpoint URL format..."
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
#!/bin/bash
echo "This script is deprecated. Use ./scripts/update-all-dashboards.sh instead."
exit 1
# Process each file
