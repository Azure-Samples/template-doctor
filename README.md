<!-- prettier-ignore -->
<div align="center">

<img src="./assets/images/templatedoctor.svg" alt="template-doctor" align="center" height="128" />

# Template Doctor

[![Template Framework Documentation](https://img.shields.io/badge/TemplateFramework-008080?style=flat-square)](https://github.com/Azure-Samples/azd-template-artifacts/)
[![Template Framework MCP](https://img.shields.io/badge/TemplateFrameworkMCP-0090FF?style=flat-square)](https://github.com/Template-Doctor/template-doctor)
[![License](https://img.shields.io/badge/License-MIT-white?style=flat-square)](LICENSE)
[![API Smoke](https://github.com/Template-Doctor/template-doctor/actions/workflows/smoke-api.yml/badge.svg)](.github/workflows/smoke-api.yml)

[Overview](#overview) | [Features](#features) | [Install](#installation-and-setup) | [Usage](#usage)

</div>

Template Doctor analyzes and validates samples and templates, including but not limited to Azure Developer CLI (azd) templates. It provides a web UI to view analysis results and take action, including opening GitHub issues and assigning them to GitHub copilot in one go. It also automates PR updates with scan results.

# Overview

Template Doctor is a containerized application that analyzes and validates samples and templates, with a focus on Azure Developer CLI (azd) templates. It provides:

- **Web UI**: TypeScript-based Vite SPA for viewing analysis results and managing templates
- **REST API**: Express backend for validation, OAuth, and GitHub integration
- **Containerized Deployment**: Docker-based architecture for consistent development and production environments
- **One-Click Actions**: GitHub issue creation with AI-powered suggestions and automated PR updates

## Features

- **Template Analysis**: Validate templates against organization standards and best practices
- **Interactive Web UI**: TypeScript-based Vite SPA for viewing and managing analysis results
- **Security Analysis**: Bicep security checks for Managed Identity, insecure auth patterns, and anonymous access
- **AI Integration**: One-click GitHub issue creation with AI-powered suggestions
- **Automated Workflows**: PR updates with scan results and deployment testing
- **Azure Developer CLI (azd)**: AZD deployment validation and testing
- **AI Model Checks**: Automated deprecation checking for AI models
- **Centralized Archive**: Metadata storage for analysis results
- **CI/CD Integration**: Automated API smoke tests and deployment workflows

## Architecture

Template Doctor is a **containerized monorepo** with independently deployable packages:

### Current Architecture (Express-based)

- **packages/app**: Vite SPA (TypeScript frontend)
    - Built with Vite for fast development and optimized production builds
    - Serves dashboard at http://localhost:3000 (preview/production)
    - Development server at http://localhost:4000 with HMR
    - Loads scan results from `packages/app/results/`

- **packages/server**: Express backend (TypeScript REST API)
    - RESTful API at http://localhost:3001
    - Handles OAuth token exchange, template validation, and GitHub integration
    - CORS-enabled for frontend communication
    - Serves static frontend assets in production

- **packages/analyzer-core**: Core analyzer functionality (shared library)
    - Shared validation logic used by both server and legacy API
    - Bundled into dependent packages during build

- **Docker**: Containerized deployment
    - `docker-compose.yml`: Multi-container development setup
    - `Dockerfile.combined`: Single-container production build
    - Includes all services (frontend + backend) in one deployable unit

### Legacy Architecture (Azure Functions)

- **packages/api**: Azure Functions (maintained in `legacy/azure-functions` branch)
    - Original serverless implementation
    - Preserved for reference and migration comparison
    - Optional build with `--if-present` flag

### Results Storage

Results live under `packages/app/results/`:

- `packages/app/results/index-data.js` — Master list of scanned templates (window.templatesData)
- `packages/app/results/<owner-repo>/<timestamp>-data.js` — Per-scan data (window.reportData)
- `packages/app/results/<owner-repo>/<timestamp>-dashboard.html` — Per-scan dashboard

# Installation and Setup

## Prerequisites

- **Node.js LTS** (v20.x, enforced by guard script)
- **npm** (for dependency management)
- **Docker & Docker Compose** (recommended for local development)
- **GitHub account** with appropriate permissions

> [!NOTE]
> The project enforces Node.js LTS range: >=20 <23. A guard script (`scripts/ensure-node-version.js`) will fail fast if you use an unsupported version. Use `nvm install 20 && nvm use 20` if needed.

## Quick Start (Docker - Recommended)

1. **Clone the repository**:
    ```bash
    git clone https://github.com/Template-Doctor/template-doctor.git
    cd template-doctor
    ```

2. **Install dependencies**:
    ```bash
    npm ci
    ```

3. **Configure environment**:
    ```bash
    cp .env.example .env
    ```
    
    Edit `.env` with your values (see [Environment Variables](#environment-variables) below)

4. **Start with Docker Compose**:
    ```bash
    docker-compose up
    ```

5. **Access the application**:
    - Frontend: http://localhost:3000
    - Backend API: http://localhost:3001

## Manual Development Setup

If you prefer running services without Docker:

1. **Follow steps 1-3 from Quick Start above**

2. **Build packages**:
    ```bash
    npm run build -w packages/server
    npm run build -w packages/app
    ```

3. **Start services in SEPARATE terminals**:

    **Terminal 1 - Express Backend (port 3001)**:
    ```bash
    cd packages/server
    npm run dev
    ```

    **Terminal 2 - Vite Dev Server (port 4000)**:
    ```bash
    cd packages/app
    npm run dev
    ```

4. **Access the application**: http://localhost:4000

> [!IMPORTANT]
> The Express backend MUST be running before using OAuth login or analysis features.
> Hard refresh (Cmd+Shift+R / Ctrl+Shift+R) required after config changes.

### Port Allocation

| Service          | Development | Preview | Docker |
|------------------|-------------|---------|--------|
| Vite Dev Server  | 4000        | -       | -      |
| Vite Preview     | -           | 3000    | 3000   |
| Express Backend  | 3001        | 3001    | 3001   |

## Authentication Setup

### GitHub OAuth Authentication

1. Create a GitHub OAuth app with appropriate callback URL
2. Configure environment variables or config.json settings
3. See [OAuth Configuration Guide](docs/development/OAUTH_CONFIGURATION.md) for detailed instructions

> [!WARNING]
> You will need different app registrations for local and production environments.

### Azure Managed Identity Setup (for AZD deployment)

1. Run `npm run setup:uami` before you get started
2. Create an `.env` file at the root, using [./.env.example](./.env.example) as a guide
3. See [UAMI Setup Instructions](docs/development/UAMI_SETUP_INSTRUCTIONS.md) for detailed steps

## Environment Variables

Template Doctor uses a consolidated approach to environment variables. All variables are defined in a single `.env` file at the root of the project.

1. **Copy the example file**:
    ```bash
    cp .env.example .env
    ```

2. **Required variables**:
    - `GITHUB_CLIENT_ID`: OAuth app client ID (required for authentication)
    - `GITHUB_CLIENT_SECRET`: OAuth app client secret (required for authentication)
    - `GH_WORKFLOW_TOKEN`: GitHub token with workflow permissions

3. **Configuration layers**:
    - **Backend** (`packages/server/.env`): Copied from root during Docker build
    - **Frontend** (`packages/app/config.json`): Client configuration with backend URLs
    - **Environment** (`.env` at repo root): Single source of truth for shared config

See the [Environment Variables Documentation](docs/development/ENVIRONMENT_VARIABLES.md) for a complete reference of all available variables.

# Usage

## Local Development

### With Docker (Recommended)

1. **Install dependencies**:
    ```bash
    npm ci
    ```

2. **Start all services**:
    ```bash
    docker-compose up
    ```

3. **Access the application**:
    - Frontend: http://localhost:3000
    - Backend API: http://localhost:3001

### Manual Development (Two-Terminal Approach)

1. **Install dependencies**:
    ```bash
    npm ci
    ```

2. **Build packages**:
    ```bash
    npm run build:analyzer-core
    npm run build -w packages/server
    npm run build -w packages/app
    ```

3. **Terminal 1 - Start Express backend**:
    ```bash
    cd packages/server
    npm run dev
    ```

4. **Terminal 2 - Start Vite dev server**:
    ```bash
    cd packages/app
    npm run dev
    ```

5. **Open browser**: http://localhost:4000

> [!NOTE]
> The Vite dev server provides hot module replacement (HMR) for fast TypeScript development.
> The Express backend must be running before using OAuth or analysis features.

## Testing

### Run All Tests

From the project root:

```bash
npm test           # Run all tests
npm run test:ui    # Run tests with UI
npm run test:debug # Run tests in debug mode
```

### Run Specific Tests

```bash
npm run test -- "-g" "should handle search functionality" packages/app/tests/app.spec.js
```

### API Smoke Tests

For quick end-to-end verification of Express endpoints:

```bash
./scripts/smoke-api.sh                           # Default (http://localhost:3001)
BASE=http://localhost:3001 ./scripts/smoke-api.sh # Override base URL
DRY_RUN=1 ./scripts/smoke-api.sh                 # Print commands only
```

The smoke script verifies:
- Config endpoint (`/api/v4/client-settings`)
- Validation endpoints
- Analysis endpoints
- OAuth flow (if `GITHUB_TOKEN` present)

> [!NOTE]
> Test files use Playwright for E2E testing. Avoid native browser dialogs in code (use notifications) to keep tests stable.

## Build and Deployment

### Build All Packages

```bash
npm run build:all
```

This builds packages in the correct dependency order:
1. `analyzer-core` (shared library)
2. `server` (Express backend)
3. `app` (Vite frontend)

### Docker Deployment

#### Single-Container Production Build

```bash
# Build the combined image
docker build -f Dockerfile.combined -t template-doctor .

# Run the container
docker run -p 3000:3000 --env-file .env template-doctor
```

The combined Dockerfile:
- Builds all packages (analyzer-core → server → app)
- Serves frontend and API from single Express process
- Optimized for production deployment

#### Multi-Container Development

```bash
# Start all services
docker-compose up

# Rebuild and restart
docker-compose up --build

# Stop services
docker-compose down
```

### Azure Container Apps Deployment (with EasyAuth)

Deploy to Azure Container Apps with built-in GitHub authentication:

```bash
# 1. Build and push container image
docker build -t template-doctor:latest -f Dockerfile.combined .
docker tag template-doctor:latest YOUR_REGISTRY.azurecr.io/template-doctor:latest
docker push YOUR_REGISTRY.azurecr.io/template-doctor:latest

# 2. Configure parameters
cp infra/main.parameters.json.example infra/main.parameters.json
# Edit main.parameters.json with your values

# 3. Deploy
./infra/deploy.sh
```

**Features**:
- ✅ Automatic GitHub OAuth integration
- ✅ Protected resources (tiles, leaderboards, setup)
- ✅ No code changes needed for authentication
- ✅ Managed identity for Azure services
- ✅ Auto-scaling (1-3 replicas)

See [EasyAuth Integration Guide](EASYAUTH.md) and [Deployment Documentation](docs/usage/CONTAINER_APPS_EASYAUTH.md) for details.

### Preview Build Locally

```bash
# Build all packages
npm run build:all

# Start preview server (port 3000)
npm run preview -w packages/server
```

Access at http://localhost:3000

## Requirements and Conventions

- **Origin Upstream Requirement**: For provisioning templates with azd, the canonical upstream must be provided in the format `owner/repo`. This is used for `azd init -t <owner/repo>` and ensures the test/provision flow uses the correct azd template.
- **Results Storage**: New scan PRs write to `packages/app/results/` and update `packages/app/results/index-data.js`.
- **Independent Deployment**: Each package is deployable independently via dedicated workflows.
- **TypeScript-First**: All new code should be TypeScript with proper type definitions.
- **No Mocks in Production**: All implementations must be complete and production-ready (see `.github/instructions/copilot-instructions.md`).

## Troubleshooting

### Common Issues

- **OAuth redirect issues**: Ensure ports match between GitHub OAuth app settings and local server
  - Development: Frontend 4000, Backend 3001
  - Preview/Docker: Frontend 3000, Backend 3001

- **Express server not starting**: 
  - Check `.env` file exists with required variables
  - Verify port 3001 is not in use: `lsof -i :3001`

- **Docker issues**:
  - Ensure Docker and Docker Compose are installed and running
  - Check logs: `docker-compose logs`

- **Port conflicts**: Kill processes if needed:
  ```bash
  lsof -ti :3000 | xargs kill -9  # Frontend preview
  lsof -ti :3001 | xargs kill -9  # Backend
  lsof -ti :4000 | xargs kill -9  # Frontend dev
  ```

- **Configuration mismatch**: Verify `config.json` has correct `githubOAuth.clientId` matching `.env`

## Deployments (CI/CD)

### GitHub Actions Workflows

Located in `.github/workflows/`:

- **smoke-api.yml**: API smoke tests
  - Runs on push/PR to verify Express API endpoints
  - Builds analyzer-core → server → runs smoke tests
  - See badge at top of README

- **Nightly Deploy**: Automated deployment
  - Runs nightly at 02:15 UTC
  - Can be triggered manually via "Run workflow"
  - See details: [docs/usage/DEPLOYMENT.md](docs/usage/DEPLOYMENT.md)

- **Submit Template Analysis**: repository_dispatch workflow
  - Saves scan results and opens a PR using `peter-evans/create-pull-request`
  - See setup guide: [docs/usage/GITHUB_ACTION_SETUP.md](docs/usage/GITHUB_ACTION_SETUP.md)

### Publishing Results

- After "Save Results" creates a PR and the PR is merged, results appear on the site after the nightly deploy
- Admins can run the deploy workflow manually to publish immediately
- The UI shows a notification to inform users of this timing

## Deployments (CI/CD)

Workflows under `.github/workflows/`:

- **Azure Static Web Apps (SWA)**:
    - Uses `Azure/static-web-apps-deploy@v1`
    - `app_location: /packages/app`
    - `api_location: /packages/api`

- **Nightly Static Web Apps Deploy (SWA CLI)**:
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

---

For issues, please open a GitHub issue.
