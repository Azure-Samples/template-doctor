#!/bin/bash

# Script to test both streaming and polling mechanisms for the job logs API
# This will help diagnose any issues with the API

# Configuration
API_BASE="https://template-doctor-standalone-nv.azurewebsites.net"
JOB_ID="td-1755680798110-openai-langchainjs"  # Use a recent job ID for testing

echo "========================================================"
echo "Testing logs API for job: $JOB_ID"
echo "========================================================"

# Test 1: Test path parameter format (direct)
echo "Test 1: Testing direct API call with path parameter format..."
PATH_URL="$API_BASE/api/aca-job-logs/$JOB_ID"
echo "URL: $PATH_URL"
echo "Response:"
curl -s "$PATH_URL" | head -n 15
echo

# Test 2: Test polling with path parameter format
echo "========================================================"
echo "Test 2: Testing polling with path parameter format..."
POLL_URL="$API_BASE/api/aca-job-logs/$JOB_ID?mode=poll"
echo "URL: $POLL_URL"
echo "Response:"
curl -s "$POLL_URL" | head -n 15
echo

# Test 3: Test path parameter format with since parameter
echo "========================================================"
echo "Test 3: Testing with path parameter format and 'since' parameter..."
SINCE_URL="$API_BASE/api/aca-job-logs/$JOB_ID?mode=poll&since=2025-08-20T09:00:00.000Z"
echo "URL: $SINCE_URL"
echo "Response:"
curl -s "$SINCE_URL" | head -n 15
echo

echo "========================================================"
echo "All tests completed."
echo "========================================================"
