#!/bin/bash
# Template Doctor Fix-All Script
# This script will automatically fix all issues with the Template Doctor container

set -e  # Exit on any error

# Check if container is running
if ! docker ps | grep -q td_local; then
  echo "Error: Container td_local is not running"
  echo "Please start the container with: docker run -d -p 4000:4000 --name td_local template-doctor:local"
  exit 1
fi

echo "=== Template Doctor Fix Script ==="
echo "This script will automatically fix all issues with the Template Doctor container"
echo ""

# 1. Copy dashboard.css to container
echo "Copying dashboard.css to container..."
docker cp /Users/nvenditto/Projects/Microsoft/Agents/template-doctor/dashboard.css td_local:/app/public/css/dashboard.css
echo "✅ dashboard.css copied successfully"

# 2. Copy the fix script to the container
echo "Creating template-doctor-fix.js in container..."
# First ensure the js directory exists
docker exec td_local mkdir -p /app/public/js
docker cp /Users/nvenditto/Projects/Microsoft/Agents/template-doctor/template-doctor-fix.js td_local:/app/public/js/template-doctor-fix.js
echo "✅ template-doctor-fix.js copied successfully"

# 3. Modify the index.html to include our fix script
echo "Injecting fix script into index.html..."
# First, extract the index.html from the container
docker cp td_local:/app/public/index.html /tmp/index.html

# Check if the fix script is already included
if grep -q "template-doctor-fix.js" /tmp/index.html; then
  echo "Fix script already included in index.html"
else
  # Append the script tag before the closing body tag
  sed -i '' 's|</body>|<script src="/js/template-doctor-fix.js"></script></body>|' /tmp/index.html
  
  # Copy the modified index.html back to the container
  docker cp /tmp/index.html td_local:/app/public/index.html
  echo "✅ Fix script injected into index.html"
fi

# 4. Check if results/index-data.js exists, and if not, create a placeholder
echo "Checking for results/index-data.js..."
if ! docker exec td_local ls -la /app/public/results/index-data.js &>/dev/null; then
  echo "Creating placeholder index-data.js..."
  
  # Create a placeholder file
  cat > /tmp/index-data.js << 'EOF'
// Template Doctor Data - Placeholder
window.templatesData = [
  {
    "name": "Azure Functions TypeScript",
    "repoUrl": "https://github.com/Azure-Samples/azure-functions-typescript",
    "description": "Azure Functions sample with TypeScript",
    "languages": ["TypeScript", "JavaScript"],
    "tags": ["azure", "functions", "serverless"]
  },
  {
    "name": "React Web App",
    "repoUrl": "https://github.com/microsoft/frontend-template",
    "description": "React web application template",
    "languages": ["JavaScript", "TypeScript", "CSS"],
    "tags": ["react", "web", "frontend"]
  }
];
EOF
  
  # Create the results directory if it doesn't exist
  docker exec td_local mkdir -p /app/public/results
  
  # Copy the placeholder file to the container
  docker cp /tmp/index-data.js td_local:/app/public/results/index-data.js
  echo "✅ Created placeholder index-data.js"
fi

echo ""
echo "=== All fixes applied successfully! ==="
echo "Template Doctor should now be working properly."
echo "Visit http://localhost:4000 in your browser to see the fixed application."
echo ""