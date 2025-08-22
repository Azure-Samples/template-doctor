#!/bin/bash

# Set your execution name here (from previous tests)
EXECUTION_NAME="start-1755538421717-xkv1vx"
# Resolve API base via .env or environment, default to prod host
DEFAULT_API_BASE="https://template-doctor-standalone-nv.azurewebsites.net"
if [ -f "$(dirname "$0")/../.env" ]; then
	# shellcheck disable=SC2046
	export $(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$(dirname "$0")/../.env" | xargs -I{} echo {}) >/dev/null 2>&1 || true
fi
BASE_URL=${API_BASE:-$DEFAULT_API_BASE}

echo "Testing job status..."
curl -s "${BASE_URL}/api/aca-job-status?executionName=${EXECUTION_NAME}" | jq .

echo -e "\nAttempting to stream logs with cURL..."
echo "This will hang until logs are received or timeout occurs. Press Ctrl+C to stop."
curl -N -H "Accept: text/event-stream" "${BASE_URL}/api/aca-job-logs/${EXECUTION_NAME}"

# Use this command to test direct fetching without streaming
# echo -e "\nFetching logs directly (non-streaming)..."
# curl -s -H "Accept: application/json" "${BASE_URL}/api/aca-job-logs/${EXECUTION_NAME}" 

# Uncomment to test starting a new job
# echo -e "\nStarting a new job..."
# curl -s -X POST -H "Content-Type: application/json" \
#   -d '{"templateRepo":"anfibiacreativa/todo-nodejs-mongo-swa", "runId":"test-run-'$(date +%s)'"}' \
#   "${BASE_URL}/api/aca-start-job" | jq .
