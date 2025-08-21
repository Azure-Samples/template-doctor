#!/bin/bash

# Script to fix the job logs endpoint URL format in all dashboard HTML files
# Changes from /api/aca-job-logs/${runId} to /api/aca-job-logs?runId=${runId}

echo "Starting fix for job logs endpoint URL format..."

# Find all dashboard HTML files
dashboard_files=$(find ./packages/app/results -name "*dashboard.html")

count_updated=0
#!/bin/bash
echo "This script is deprecated. Use ./scripts/update-all-dashboards.sh instead."
exit 1
for file in $dashboard_files; do
