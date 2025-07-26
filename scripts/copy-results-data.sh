#!/bin/bash

# This script is temporary for development purposes only.
# In the final implementation, a GitHub Action will handle adding template scan results
# directly to the frontend/results directory when a PR is created.

echo "⚠️ WARNING: This script is for development purposes only."
echo "In production, template scan results will be added directly to the frontend/results"
echo "directory through a GitHub Action when a developer scans a template."
echo ""
echo "The GitHub Action would:"
echo "1. Create a branch"
echo "2. Add scan results directly to frontend/results"
echo "3. Update frontend/results/index-data.js with the new template metadata" 
echo "4. Create a PR for review"
echo ""
echo "For now, we'll temporarily copy files to simulate this process."
echo ""

# Get the project root directory (where the script is located)
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"

# Ensure frontend/results directory exists
mkdir -p "$PROJECT_DIR/frontend/results"

# For development only: Temporarily copy index-data.js
cp "$PROJECT_DIR/results/index-data.js" "$PROJECT_DIR/frontend/results/"

# For development only: Temporarily copy dashboard files
echo "Development only: Copying dashboard files..."

# Create a .gitkeep file to ensure the directory is committed
touch "$PROJECT_DIR/frontend/results/.gitkeep"

# Get the list of repository directories in results
for repo_dir in "$PROJECT_DIR/results/"*-*/; do
  if [ -d "$repo_dir" ]; then
    repo_name=$(basename "$repo_dir")
    echo "  - Processing $repo_name"
    
    # Create the corresponding directory in frontend/results
    mkdir -p "$PROJECT_DIR/frontend/results/$repo_name"
    
    # Copy latest dashboard HTML and data JS files (or whichever files are referenced in index-data.js)
    cp "$repo_dir"*-dashboard.html "$PROJECT_DIR/frontend/results/$repo_name/" 2>/dev/null || true
    cp "$repo_dir"*-data.js "$PROJECT_DIR/frontend/results/$repo_name/" 2>/dev/null || true
  fi
done

echo "✅ Development only: Copied results to frontend/results directory"
echo "In production, these files would be added directly through a GitHub Action."
