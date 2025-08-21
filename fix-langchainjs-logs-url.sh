#!/bin/bash
set -euo pipefail
# Deprecated wrapper: use the consolidated updater in ./scripts
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
echo "[DEPRECATED] Use ./scripts/update-dashboard-endpoints.sh instead." >&2
exec "$SCRIPT_DIR/scripts/update-dashboard-endpoints.sh" "$@"
#!/bin/bash

# Script to fix the job logs endpoint URL format in anfibiacreativa-openai-langchainjs dashboard HTML files
# Changes from /api/aca-job-logs/${runId} to /api/aca-job-logs?runId=${runId}

TARGET_DIR="./packages/app/results/anfibiacreativa-openai-langchainjs"

echo "Starting fix for job logs endpoint URL format in anfibiacreativa-openai-langchainjs files..."
echo "Target directory: $TARGET_DIR"

# Verify the directory exists
if [ ! -d "$TARGET_DIR" ]; then
    echo "Error: Directory $TARGET_DIR not found!"
    exit 1
fi

# Find all dashboard HTML files in the specified directory
dashboard_files=$(find "$TARGET_DIR" -name "*dashboard.html")

count_updated=0
#!/bin/bash
echo "This script is deprecated. Use ./scripts/update-all-dashboards.sh instead."
exit 1
for file in $dashboard_files; do
