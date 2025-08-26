# Template Doctor (Monorepo)

Template Doctor analyzes and validates Azure Developer CLI (azd) templates## Contributing

- Add/update tests for features and fixes. Frontend E2E tests live in the app package; run from root via `npm test`.
- Avoid native browser dialogs; use notifications to keep tests stable.
- Format code before committing (packages may include prettier configs and scripts).
- Don't commit generated artifacts like `node_modules/` or large reports.
- Update docs and workflows when changing paths or behavior.

## Security Analysis Features

Template Doctor now includes enhanced security analysis for Bicep files:

1. **Managed Identity Detection**: Identifies when Managed Identity is properly used in Azure resources.
2. **Insecure Authentication Detection**: Identifies and flags insecure authentication methods like:
   - Connection strings with embedded credentials
   - Access keys
   - SAS tokens
   - Storage account keys
   - KeyVault secrets accessed without Managed Identity

3. **Anonymous Access Detection**: Identifies Azure resources that typically require authentication but may be configured for anonymous access.

These security checks can be enabled/disabled in each rule set configuration by setting the `bicepChecks.securityBestPractices` properties:

```json
"bicepChecks": {
  "requiredResources": [...],
  "securityBestPractices": {
    "preferManagedIdentity": true,
    "detectInsecureAuth": true,
    "checkAnonymousAccess": true
  }
}
```

## Documentations a web UI, and automates PR updates with scan results. This repository is structured as a monorepo with independent deployable packages.

## Monorepo layout

- packages/app — Static web app (frontend UI)
	- Serves the dashboard and loads scan results from `packages/app/results/`
- packages/api — Azure Functions (PR creation, OAuth helpers)
- packages/functions-aca — Azure Functions to orchestrate Azure Container Apps (ACA) Jobs (start/stop/query logs)
- packages/infra — Infrastructure (placeholder for Bicep/Terraform)
- docs — Documentation for GitHub Action/App and usage

Results live under `packages/app/results/`:
- `packages/app/results/index-data.js` — master list of scanned templates (window.templatesData)
- `packages/app/results/<owner-repo>/<timestamp>-data.js` — per-scan data (window.reportData)
- `packages/app/results/<owner-repo>/<timestamp>-dashboard.html` — per-scan dashboard

## Requirements and conventions

- Canonical upstream is required to provision with azd: the repository dispatch and GitHub Action take `originUpstream` (preferred) or `upstream` in the format `owner/repo`. This is used for `azd init -t <owner/repo>`.
- New scan PRs write to `packages/app/results` and update `packages/app/results/index-data.js`.
- Each package is deployable independently via dedicated workflows.

## Workspaces and root scripts

This repo uses npm workspaces.

- Install deps (root + packages):
	- `npm ci`
- Build all packages:
	- `npm run build:all`
- Run frontend tests (Playwright) from root:
	- `npm test`
	- `npm run test:ui`
	- `npm run test:debug`
- Start API locally:
	- `npm run -w packages/api start`
- Start ACA orchestrator locally:
	- `npm run -w packages/functions-aca start`
- Start frontend locally (simple static server):
	- `npm run -w packages/app start` (serves on http://localhost:8080)

## Deployments (CI/CD)

Workflows under `.github/workflows/`:

- Azure Static Web Apps (SWA):
	- Uses `Azure/static-web-apps-deploy@v1`
	- `app_location: /packages/app`
	- `api_location: /packages/api`
- Deploy Azure Functions API:
	- `.github/workflows/azure-functions.yml`
	- Triggers on `packages/api/**`
	- Zips and deploys with `azure/functions-action@v1`
- Deploy Functions (ACA Orchestrator):
	- `.github/workflows/functions-aca-deploy.yml`
	- Triggers on `packages/functions-aca/**`
	- Zips and deploys with `azure/functions-action@v1`
- Submit Template Analysis:
	- `.github/workflows/submit-analysis.yml`
	- Triggered by `repository_dispatch (template-analysis-completed)`
	- Requires `originUpstream` (or `upstream`) in `client_payload`
	- Invokes local action to update `packages/app/results/index-data.js` and add per-scan files
- Template Doctor (manual scan):
	- `.github/workflows/template-doctor.yml`
	- Runs CLI to analyze a repo and updates results under `packages/app/results`

## Local development

1) Install tools:
- Node.js and npm
- Azure Functions Core Tools (for API and functions-aca)
- Python 3 (optional static server for frontend)

2) Install dependencies and build:
```
npm ci
npm run build:all
```

3) Run services:
```
# Frontend
npm run -w packages/app start

# API (Functions)
npm run -w packages/api start

# ACA Orchestrator (Functions)
npm run -w packages/functions-aca start
```

Open http://localhost:8080 for the UI. The frontend expects the API at http://localhost:7071 by default.

## Origin upstream requirement

For provisioning templates with azd, the canonical upstream must be provided:

- Repository dispatch payload must include `originUpstream` (preferred) or `upstream` as `owner/repo`.
- The GitHub Action input `origin-upstream` is required and will fail fast if missing.

This ensures the test/provision flow uses the correct azd template (no heuristics).

## Contributing

- Add/update tests for features and fixes. Frontend E2E tests live in the app package; run from root via `npm test`.
- Avoid native browser dialogs; use notifications to keep tests stable.
- Format code before committing (packages may include prettier configs and scripts).
- Don’t commit generated artifacts like `node_modules/` or large reports.
- Update docs and workflows when changing paths or behavior.

## Documentation

- [GitHub Action Setup](docs/GITHUB_ACTION_SETUP.md)
- [GitHub Action](docs/GITHUB_ACTION.md)
- [GitHub App](docs/GITHUB_APP.md)
- [GitHub Pages Implementation](docs/github-pages-implementation.md)
- [Security Analysis Features](docs/SECURITY_ANALYSIS.md)

---

For issues, please open a GitHub issue.
