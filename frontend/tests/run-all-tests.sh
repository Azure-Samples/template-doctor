#!/bin/bash

# Navigate to the frontend directory if not already there
cd "$(dirname "$0")/.." || exit

# Check if we have npm installed
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed or not found in PATH"
    exit 1
fi

# Run tests with verbose output
echo "Running Playwright tests..."
npx playwright test --reporter=list

# Check the exit code
if [ $? -eq 0 ]; then
    echo "✅ All tests passed successfully!"
else
    echo "❌ Some tests failed. Check the output above for details."
fi
