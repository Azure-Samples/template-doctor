# Template Doctor: GitHub Pages Implementation

## Overview

This document outlines the architecture and workflow for the GitHub Pages-based Template Doctor implementation, focusing on how template scan results are stored and managed.

## Architecture

In the GitHub Pages implementation, all template scan data and reports are stored directly in the `frontend/results` directory structure:

```
frontend/
  ├── results/
  │   ├── index-data.js         # Central source of truth - metadata for all scanned templates
  │   ├── owner-repo-name/      # One directory per scanned repository
  │   │   ├── timestamp-dashboard.html   # HTML report for this scan
  │   │   └── timestamp-data.js          # Data file for this scan
  │   └── another-repo-name/
  │       ├── timestamp-dashboard.html
  │       └── timestamp-data.js
```

## Workflow

### 1. Developer Authentication

- User authenticates with GitHub OAuth
- Authentication provides necessary permissions for:
  - Reading repositories
  - Creating branches and PRs

### 2. Template Scanning Process

When a developer scans a template through the web interface:

1. The scan is performed client-side or via a serverless function
2. Results are generated (HTML report and data files)
3. A GitHub Action is triggered that:
   - Creates a new branch
   - Adds the scan results to the `frontend/results` directory
   - Updates `index-data.js` to include metadata for the new scan
   - Creates a Pull Request for review

### 3. Pull Request Review

- Maintainers review the PR to ensure quality
- Once approved, the PR is merged into the main branch
- GitHub Pages automatically deploys the updated site with the new scan results

## Implementation Details

### index-data.js Structure

```javascript
window.templatesData = [
  {
    "timestamp": "2025-07-25T10:14:02.435Z",
    "repoUrl": "https://github.com/owner/repo-name",
    "relativePath": "owner-repo-name/timestamp-dashboard.html",
    "compliance": {
      "percentage": 85,
      "issues": 5,
      "passed": 25
    }
  },
  // Additional template entries...
];
```

### GitHub Action Configuration

The GitHub Action will be configured to:

- Run when triggered through the web UI
- Use GitHub API to create branches and PRs
- Update files in the repository
- Add appropriate labels and reviewers to the PR

## Development vs. Production

During development:

- A temporary script (`scripts/copy-results-data.sh`) simulates this process
- Template data is copied from a development location to the frontend directory

In production:

- All data is stored directly in the frontend directory
- No copying is needed as the GitHub Action adds files directly to the right location
- `index-data.js` is the single source of truth

## Benefits

This approach provides several benefits:

1. **Decentralized**: No central server needed, all processing happens client-side
2. **Transparent**: All template scan data is publicly visible in the repository
3. **Versioned**: All changes to scan data are tracked through Git
4. **Quality Control**: PR review process ensures quality of added templates
5. **Automatic Deployment**: GitHub Pages handles deployment automatically
