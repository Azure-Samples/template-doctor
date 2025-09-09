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

Environment variables:
- Legacy / SWA + Functions reference: [docs/development/ENVIRONMENT_VARIABLES.md](docs/development/ENVIRONMENT_VARIABLES.md)
- Container / ACA deployment reference (single Express server + optional static UI): [docs/development/ENVIRONMENT_VARIABLES_CONTAINER.md](docs/development/ENVIRONMENT_VARIABLES_CONTAINER.md)

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

> [!NOTE]
> Migrating to the container architecture? See `docs/development/ENVIRONMENT_VARIABLES_CONTAINER.md` and `.env.container.example` for consolidated settings (single process serving API + frontend when `SERVE_FRONTEND=true`).

## Running the unified container locally

The repository includes a multi‑stage Dockerfile (`packages/server/Dockerfile`) that builds:
1. The frontend (Vite) into `packages/app/dist`
2. The server (Express / compiled TS) into `packages/server/dist`
3. A minimal runtime image that serves both API + static UI when `SERVE_FRONTEND=true` (default)

### 1. Create a container env file (recommended)

Copy the provided example and adjust values (only the public GitHub OAuth client id is required for login):

```bash
cp .env.container.example .env.container
# edit .env.container and set at least:
#   GITHUB_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx
```

All available variables are documented in: `docs/development/ENVIRONMENT_VARIABLES_CONTAINER.md`.

### 2. Build the image

From the repo root:

```bash
docker build -f packages/server/Dockerfile -t template-doctor:local .
```

### 3. Run the container

```bash
docker run --rm -it \
  --env-file ./.env.container \
  -p 4000:4000 \
  --name td_local \
  template-doctor:local
```

Then open: http://localhost:4000

Health endpoints:
- `GET /health` – liveness
- `GET /v4/health/env` – redacted env diagnostics

### 4. Hot‑updating just the frontend (optional)

When you change frontend code you can rebuild and copy the new static assets into the running container (avoids full rebuild):

```bash
npm run deploy:frontend:container
```

This script:
- Builds the frontend (`packages/app/dist`)
- Copies `dist/index.html` and `dist/assets/*` into the running container named `td_local`

If you used a different container name, either rename it to `td_local` or manually copy:

```bash
docker cp packages/app/dist/index.html <your_container>:/app/public/index.html
docker cp packages/app/dist/assets/. <your_container>:/app/public/assets
```

### 5. Rebuilding everything

If backend code or shared types changed, stop the container and repeat steps 2–3.

### 6. Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Login button shows but clicking returns missing client id | `GITHUB_CLIENT_ID` not present in container env | Add to `.env.container`, restart container |
| UI shows old markup (e.g., analysis section visible while logged out) | Stale `index.html` not overwritten | Run `npm run deploy:frontend:container` or rebuild image |
| 404 for assets under `/assets/...` | Frontend not copied / build failed | Check Docker build logs for Vite build step |
| `/v4/client-settings` 404 | Misconfigured path or env missing | Ensure server started with `SERVE_FRONTEND=true` and env file mounted |
| Name conflict `/td_local is already in use` | Stale container with same name exists (stopped or exited) | `docker rm -f td_local` then `docker compose up` (or remove `container_name` from compose) |

### 7. Minimal one‑liner (no env file)

Use only for quick experiments (you will not be able to authenticate without a real client id):

```bash
docker run --rm -it -p 4000:4000 --name td_local template-doctor:local
```

### 8. Using Docker Compose

The repository provides a `docker-compose.yml` for a single-service local stack.

1. Ensure you have an env file:
```bash
cp .env.container.example .env.container
```
2. Bring the stack up (build + run):
```bash
docker compose up --build
```
3. Open http://localhost:4000

Container name is set to `td_local`, so the hot‑reload script still works:
```bash
npm run deploy:frontend:container
```

Shut down:
```bash
docker compose down
```

If you change backend/server code, run again with `--build`.

---

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
