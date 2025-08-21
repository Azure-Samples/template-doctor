#!/bin/bash
echo "[DEPRECATED] Use ./scripts/run-app-job-and-stream.sh or ./scripts/inspect-app-runner.sh." >&2
exit 1
#!/bin/bash

# Script to test if we can get more information about container crashes
# This will start a job with a debug flag to capture more information

# Configuration
API_BASE="https://template-doctor-standalone-nv.azurewebsites.net"
TEMPLATE_NAME="Azure-Samples/openai-langchainjs"
DEBUG_FLAG="true"

echo "========================================================"
echo "Starting a debug job for template: $TEMPLATE_NAME"
echo "========================================================"

# Send a POST request to start the job with debug flags
curl -s -X POST "$API_BASE/api/aca-start-job" \
  -H "Content-Type: application/json" \
  -d '{
    "template": "'"$TEMPLATE_NAME"'",
    "mode": "debug",
    "debug": true
  }' | jq .

echo "========================================================"
echo "Job started. Check the logs in a few moments."
echo "========================================================"
