<!-- prettier-ignore -->
<div align="center">

<img src="./assets/images/templatedoctor.svg" alt="template-doctor" align="center" height="128" />

# Template Doctor

[![Template Framework Documentation](https://img.shields.io/badge/TemplateFramework-008080?style=flat-square)](https://github.com/Azure-Samples/azd-template-artifacts/)
[![Template Framework MCP](https://img.shields.io/badge/TemplateFrameworkMCP-0090FF?style=flat-square)](https://github.com/Template-Doctor/template-doctor)
[![License](https://img.shields.io/badge/License-MIT-white?style=flat-square)](LICENSE)

[Overview](#overview) | [Features](#features) | [Install](#install) | [Usage](#usage)


</div>


> [!IMPORTANT]
> This app has been built with vanilla JavaScript for fast prototyping and will be migrated to TypeScript for robustness.

Template Doctor analyzes and validates samples and templates, including but not limited to Azure Developer CLI (azd) templates. It provides a web UI to view analysis results and take action, including opening GitHub issues and assigning them to GitHub copilot in one go. It also automates PR updates with scan results.

## Application details

This repository is structured as a monorepo with independent deployable packages.

## Authentication

### For GitHub OAuth authentication, you need to:

1. Create a GitHub OAuth app with appropriate callback URL
2. Configure environment variables or config.json settings
3. See [OAuth Configuration Guide](docs/development/OAUTH_CONFIGURATION.md) for detailed instructions

> [!WARNING]
> You will need different app registrations for local and prod.

## For AZD deployment on Azure, you need to:

Run `npm run setup:uami` before you get started
Make sure to create an .env file at the root, with [./.env.example](./.env.example) as guide.
[Read more](docs/development/UAMI_SETUP_INSTRUCTIONS.md)

## Monorepo layout

- packages/app — Static web app (frontend UI)
	- Serves the dashboard and loads scan results from `packages/app/results/`
- packages/api — Azure Functions v4 (TypeScript, programmatic registration, all active endpoints under `api/v4/*`)
- packages/api-legacy — (DEPRECATED / pending removal) legacy Azure Functions v3 folder retained temporarily; do not modify
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
- Run frontend tests (Playwright) from root:
	- `npm test`
	- `npm run test:ui`
	- `npm run test:debug`
- Start v4 API locally:
  - `npm run -w packages/api start`

> [!IMPORTANT]
> For now the frontend is just JavaScript. To start it
> `cd ./packages/app && python3 -m http.server 8080`
> (requires Python 3 installed in your machine. You may use a different server to your convenience)

## Deployments (CI/CD)

Workflows under `.github/workflows/`:

- Azure Static Web Apps (SWA):
	- Uses `Azure/static-web-apps-deploy@v1`
	- `app_location: /packages/app`
	- `api_location: /packages/api`

  - Nightly Static Web Apps Deploy (SWA CLI):
    - Workflow: `.github/workflows/nightly-swa-deploy.yml`
    - Runs nightly at 02:15 UTC and can be triggered manually via "Run workflow"
    - Requires repo secret `SWA_CLI_DEPLOYMENT_TOKEN` (Static Web App deployment token)
    - See details: [docs/usage/DEPLOYMENT.md](docs/usage/DEPLOYMENT.md)

- Submit Template Analysis (repository_dispatch):
  - Saves scan results and opens a PR using `peter-evans/create-pull-request`
  - See setup guide (including bot token fallback): [docs/usage/GITHUB_ACTION_SETUP.md](docs/usage/GITHUB_ACTION_SETUP.md)

Publishing results

- After “Save Results” creates a PR and the PR is merged, results appear on the site after the nightly deploy. Admins can run the deploy workflow manually to publish immediately. The UI shows a notification to inform users of this timing.

### Centralized Archive (optional)

Template Doctor can also archive a small JSON metadata file to a central repository for each analysis.

- How to enable and required variables: see
  - Env vars reference: [docs/development/ENVIRONMENT_VARIABLES.md](docs/development/ENVIRONMENT_VARIABLES.md)
  - Action setup (archive section): [docs/usage/GITHUB_ACTION_SETUP.md](docs/usage/GITHUB_ACTION_SETUP.md#6-centralized-archive-of-analysis-metadata-optional)

Quick checklist
- In GitHub repo (Settings → Secrets and variables → Actions):
  - Set `TD_API_BASE` to your API base (e.g., `https://<your-swa>.azurestaticapps.net/api`).
  - Optionally set `TD_ARCHIVE_COLLECTION` (defaults to `aigallery`).
- In Azure Functions (Application Settings):
  - Set `GH_WORKFLOW_TOKEN` with Contents & Pull requests write access to the central archive repo (authorize SSO if needed).
- Enable archiving:
  - Globally: set `archiveEnabled: true` in runtime-config, or
  - Per-run: check the “Also save metadata to the centralized archive for this analysis” box in the analyze modal when global is off.


## Local development

1) Install tools:
- Node.js and npm
- Azure Functions Core Tools (for API and functions-aca)
- Python 3 (optional static server for frontend)

2) Install dependencies and build:
```
npm ci
```

3) Run services:
   
- Start v4 API locally:
  - `npm run -w packages/api start`

> [!IMPORTANT]
> For now the frontend is just JavaScript. To start it
> `cd ./packages/app && python3 -m http.server 8080`
> (requires Python 3 installed in your machine. You may use a different server to your convenience)

Open http://localhost:8080 for the UI. The frontend expects the API at http://localhost:7071 by default.

## Origin upstream requirement

For provisioning templates with azd, the canonical upstream must be provided:


This ensures the test/provision flow uses the correct azd template (no heuristics).

## Contributing

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


```


---

For issues, please open a GitHub issue.
