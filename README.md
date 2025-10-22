<!-- prettier-ignore -->
<div align="center">

<img src="./assets/images/templatedoctor.svg" alt="template-doctor" align="center" height="128" />

# Template Doctor

[![Template Framework Documentation](https://img.shields.io/badge/TemplateFramework-008080?style=flat-square)](https://github.com/Azure-Samples/azd-template-artifacts/)
[![Template Framework MCP](https://img.shields.io/badge/TemplateFrameworkMCP-0090FF?style=flat-square)](https://github.com/Template-Doctor/template-doctor)
[![License](https://img.shields.io/badge/License-MIT-white?style=flat-square)](LICENSE)

[Overview](#overview) | [Features](#features) | [Install](#installation-and-setup) | [Usage](#usage)

</div>

Template Doctor analyzes and validates samples and templates, including but not limited to Azure Developer CLI (azd) templates. It provides a web UI to view analysis results and take action, including opening GitHub issues and assigning them to GitHub copilot in one go. It also automates PR updates with scan results.

# Overview

Template Doctor analyzes and validates samples and templates, with a focus on Azure Developer CLI (azd) templates. It provides a web UI to view analysis results, create GitHub issues with AI-powered suggestions, and automate PR updates with scan results.

## Features

- **Template Analysis**: Validate templates against organization standards and best practices
- **Security Analysis**: Bicep security checks for Managed Identity, insecure auth patterns, and anonymous access
- **AI Integration**: One-click GitHub issue creation with AI-powered suggestions
- **Automated Workflows**: PR updates with scan results and deployment testing
- **AZD Validation**: Azure Developer CLI deployment validation and testing
- **AI Model Checks**: Automated deprecation checking for AI models
- **OAuth 2.0 Authentication**: Secure API access with GitHub OAuth
- **Database Storage**: MongoDB (local) or Cosmos DB (production) for persistent storage

## Architecture

Template Doctor is a **containerized monorepo** with the following structure:

- **packages/app**: Vite SPA (TypeScript frontend)
  - Production: Served by Express on port 3000

- **packages/server**: Express backend (TypeScript REST API)
  - OAuth token exchange, template validation, GitHub integration
  - Serves static frontend assets in production
  - Port 3000 (matches OAuth callback URL)

- **packages/analyzer-core**: Core analyzer functionality (shared library)

- **Docker**: Containerized deployment
  - `docker-compose.yml`: Local development setup
  - `Dockerfile.combined`: Production single-container build

**Database**: Results stored in MongoDB (local) or Cosmos DB (production) via REST API endpoints

## Features

- **Template Analysis**: Validate templates against organization standards and best practices
- **Security Analysis**: Bicep security checks for Managed Identity, insecure auth patterns, and anonymous access
- **AI Integration**: One-click GitHub issue creation with AI-powered suggestions
- **Automated Workflows**: PR updates with scan results and deployment testing
- **AZD Validation**: Azure Developer CLI deployment validation and testing
- **AI Model Checks**: Automated deprecation checking for AI models
- **OAuth 2.0 Authentication**: Secure API access with GitHub OAuth
- **Database Storage**: MongoDB (local) or Cosmos DB (production) for persistent storage

## Architecture

Template Doctor is a **containerized monorepo** with the following structure:

- **packages/app**: Vite SPA (TypeScript frontend)
  - Production: Served by Express on port 3000

- **packages/server**: Express backend (TypeScript REST API)
  - OAuth token exchange, template validation, GitHub integration
  - Serves static frontend assets in production
  - Port 3000 (matches OAuth callback URL)

- **packages/analyzer-core**: Core analyzer functionality (shared library)

- **Docker**: Containerized deployment
  - `docker-compose.yml`: Local development setup
  - `Dockerfile.combined`: Production single-container build

**Database**: Results stored in MongoDB (local) or Cosmos DB (production) via REST API endpoints

# Installation and Setup

## 🚀 Automated Setup Wizard (Recommended)

The **fastest way to get started** - our interactive wizard handles everything:

```bash
git clone https://github.com/Template-Doctor/template-doctor.git
cd template-doctor
./scripts/full-setup.sh
```

The wizard will ask: **"Are you setting up for local development or Azure deployment?"**

### Local Development Path (5 minutes)
- ✅ Check prerequisites (Node.js, Docker)
- ✅ Guide you through GitHub OAuth App creation
- ✅ Create GitHub Personal Access Token
- ✅ Configure MongoDB (automatic Docker setup)
- ✅ Set up admin users
- ✅ Install npm dependencies
- ✅ Build all packages
- ✅ **Start Docker containers automatically**
- ✅ **Open http://localhost:3000 in your browser**

### Azure Production Path (10 minutes)
- ✅ Check prerequisites (Node.js, Azure CLI, azd)
- ✅ Guide you through GitHub OAuth App creation
- ✅ Create GitHub Personal Access Token
- ✅ Configure Cosmos DB (automatic azd setup)
- ✅ Set up admin users and workflow repository
- ✅ Install npm dependencies
- ✅ Build all packages
- ✅ **Run `azd up` to provision and deploy**
- ✅ **Open your Azure app URL**

> [!TIP]
> The wizard is interactive, validates configuration at each step, and provides helpful troubleshooting tips. **This is the easiest way to get Template Doctor running!**

---

## Manual Setup

If you prefer to set things up manually, choose your path:

- **[Local Development](#local-development-docker)** - Run on your machine with Docker
- **[Production Deployment](#production-deployment-azure)** - Deploy to Azure with azd

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
   # Start the combined profile (frontend + backend in one container)
   docker-compose --profile combined up

   # Or run in detached mode
   docker-compose --profile combined up -d

   # Rebuild and start
   docker-compose --profile combined up --build
   ```

5. **Access the application**:
   - Frontend + Backend: http://localhost:3000

> [!IMPORTANT]
> **OAuth Requirement**: Both frontend and backend run on port 3000 in Docker. This matches the GitHub OAuth callback URL (`http://localhost:3000/oauth-callback`). The Docker setup handles this automatically - the Express server serves both the API and frontend assets.

## Manual Development Setup (Not Recommended for OAuth)

If you prefer running services without Docker:

1. **Follow steps 1-3 from Quick Start above**

2. **Build packages**:

   ```bash
   npm run build -w packages/server
   npm run build -w packages/app
   ```

3. **Start services in SEPARATE terminals**:

   **Terminal 1 - Express Backend (port 3000)**:

   ```bash
   cd packages/server
   npm run dev
   ```

   **Terminal 2 - Vite Dev Server (port 4000)**:

   ```bash
   cd packages/app
   npm run dev
   ```

> [!WARNING]
> **OAuth Not Supported**: This manual setup is NOT RECOMMENDED. The frontend (port 4000) and backend (port 3000) run on different ports, breaking OAuth authentication. **Use Docker Compose instead** - it runs both services on port 3000, matching the recommended OAuth configuration.

> [!WARNING]
> **OAuth Not Supported**: This manual setup is NOT RECOMMENDED. The frontend (port 4000) and backend (port 3000) run on different ports, breaking OAuth authentication. **Use Docker Compose instead** - it runs both services on port 3000, matching the recommended OAuth configuration.

> [!IMPORTANT]
> The Express backend MUST be running before using OAuth login or analysis features.
> Hard refresh (Cmd+Shift+R / Ctrl+Shift+R) required after config changes.

### Port Allocation

| Service                  | Port | Notes                                      |
| ------------------------ | ---- | ------------------------------------------ |
| Docker (Recommended)     | 3000 | Frontend + Backend (OAuth compatible)      |
| Production               | 3000 | Frontend + Backend served by Express       |

**Note**: Port 3000 is required for OAuth authentication to work correctly.

## Authentication Setup

### GitHub OAuth Authentication (Required for API Access)

**Template Doctor v2.1.0+ requires OAuth 2.0 authentication** for all API endpoints except public health checks and configuration.

**What you need:**

1. GitHub OAuth App (for frontend login)
2. GitHub Personal Access Token (for API access)
3. Environment variables configured

**Quick Setup:**

1. **Create GitHub OAuth App**:
   - Go to GitHub Settings → Developer settings → OAuth Apps → New OAuth App
   - **Application name**: Template Doctor
   - **Homepage URL**: `http://localhost:3000` (or your domain)
   - **Authorization callback URL**: `http://localhost:3000/callback.html`
   - Copy Client ID and Client Secret

2. **Create GitHub Personal Access Token**:
   - Go to GitHub Settings → Developer settings → Personal access tokens → Generate new token
   - Required scopes: `public_repo`, `read:user`
   - Copy the generated token

3. **Configure environment variables**:

   ```bash
   cp .env.example .env
   ```

   Edit `.env`:

   ```bash
   # OAuth (for frontend login)
   GITHUB_CLIENT_ID=your_oauth_app_client_id
   GITHUB_CLIENT_SECRET=your_oauth_app_client_secret

   # API Access
   GH_WORKFLOW_TOKEN=your_personal_access_token

   # Admin Users (optional - comma-separated GitHub usernames)
   ADMIN_GITHUB_USERS=username1,username2
   ```

**For detailed instructions**, see:

- [OAuth API Authentication](docs/reference/oauth-api.md) - Complete authentication guide
- [OAuth Configuration](docs/reference/oauth-setup.md) - OAuth app setup details

**Endpoint Protection:**

- ✅ **Public**: Health check, client settings, OAuth token exchange
- 🔒 **Protected**: Template analysis, validation, GitHub integration, batch scanning
- 🔐 **Admin**: Configuration management, database info, debugging endpoints

> [!WARNING]
> You will need different OAuth app registrations for local (localhost:3000) and production (yourdomain.com) environments.

> [!IMPORTANT]
> **Frontend users**: Authentication happens automatically when you click "Login"  
> **API users**: Include `Authorization: Bearer <github_token>` header in all requests  
> **Admin access**: Configure `ADMIN_GITHUB_USERS` to enable admin endpoints

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

See the [Environment Variables Documentation](docs/reference/environment-variables.md) for a complete reference of all available variables.

# Usage

## Local Development

### With Docker (Recommended)

1. **Install dependencies**:

   ```bash
   npm ci
   ```

2. **Start all services**:

   ```bash
   docker-compose --profile combined up
   ```

3. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3000/api

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

> [!NOTE]
> This setup is for development without OAuth. The Express backend must be running (port 3000) before the frontend (port 4000) will work. **For OAuth functionality, use Docker Compose instead.**

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

### Playwright Browser Guard (Fail‑Fast)

End‑to‑end tests require Playwright browsers (Chromium at minimum). A misconfigured pipeline that sets `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` without restoring a cached browser directory used to fail late with a missing executable error. We added a proactive guard script `scripts/verify-playwright-browsers.js` (wired via the root `pretest` hook) that:

1. Detects whether a Chromium installation exists in the Playwright cache.
2. Fails fast (non‑zero) with remediation guidance if `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` is set but browsers are absent.
3. Allows intentional bypass (unit‑only jobs) via `PLAYWRIGHT_ALLOW_MISSING=1`.

Typical GitHub Actions snippet (with cache):

```yaml
- uses: actions/cache@v4
    with:
        path: ~/.cache/ms-playwright
        key: ${{ runner.os }}-playwright-${{ hashFiles('**/package-lock.json') }}
        restore-keys: |
            ${{ runner.os }}-playwright-
- name: Install browsers (if cache miss)
    run: |
        if [ ! -d ~/.cache/ms-playwright ]; then npx playwright install chromium; fi
- name: Tests
    run: npm test
```

Unit‑only pipeline example (skip browser requirement deliberately):

```bash
PLAYWRIGHT_ALLOW_MISSING=1 npm run test:unit
```

Do NOT set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` for jobs that execute Playwright tests unless you guarantee a cache restore first.

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
# Start all services with combined profile
docker-compose --profile combined up

# Rebuild and restart
docker-compose --profile combined up --build

# Run in detached mode
docker-compose --profile combined up -d

# Stop services
docker-compose --profile combined down
```

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
- **Database Storage**: Scan results are stored in MongoDB/Cosmos DB and served via REST API endpoints (`/api/v4/results/*`).
- **Independent Deployment**: Each package is deployable independently via dedicated workflows.
- **TypeScript-First**: All new code should be TypeScript with proper type definitions.
- **No Mocks in Production**: All implementations must be complete and production-ready (see `.github/instructions/copilot-instructions.md`).

## Troubleshooting

### Common Issues

- **OAuth redirect issues**: Both frontend and backend MUST run on port 3000
  - ✅ Docker/Production: Both services on port 3000 (recommended)
  - ❌ Manual development: Different ports, OAuth won't work

- **Express server not starting**:
  - Check `.env` file exists with required variables
  - Verify port 3000 is not in use: `lsof -i :3000`

- **Docker issues**:
  - Ensure Docker and Docker Compose are installed and running
  - Check logs: `docker-compose logs`

- **Port conflicts**: Kill processes if needed:

  ```bash
  lsof -ti :3000 | xargs kill -9  # Docker container or Express server
  ```

- **Configuration mismatch**: Verify `config.json` has correct `githubOAuth.clientId` matching `.env`

## Deployments

### GitHub Actions Workflows

- **validate-docker-images.yml**: Docker image build validation
- **Nightly Deploy**: Automated deployment (runs at 02:15 UTC, manual trigger available)
- **Submit Template Analysis**: repository_dispatch workflow for saving scan results via PR

### Publishing Results

- Results appear after PR merge + nightly deploy
- Admins can trigger manual deploy for immediate publishing
- UI notifications inform users of timing

### Centralized Archive (Optional)

Archive analysis metadata to a central repository:

- **Setup**: See [Environment Variables](docs/reference/environment-variables.md) and [GitHub Action Setup](docs/guides/github-actions.md)
- **Configuration**: Set `archiveEnabled: true` or check "save to archive" per-analysis

## Documentation

## Deployments (CI/CD)

### GitHub Actions Workflows

Located in `.github/workflows/`:

- **validate-docker-images.yml**: Docker image validation
  - Validates Docker builds and image integrity
  - Ensures containers can be built successfully

- **Nightly Deploy**: Automated deployment
  - Runs nightly at 02:15 UTC
  - Can be triggered manually via "Run workflow"
  - See details: [docs/usage/DEPLOYMENT.md](docs/usage/DEPLOYMENT.md)

- **Submit Template Analysis**: repository_dispatch workflow
  - Saves scan results and opens a PR using `peter-evans/create-pull-request`
  - See setup guide: [docs/guides/github-actions.md](docs/guides/github-actions.md)

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
  - See setup guide (including bot token fallback): [docs/guides/github-actions.md](docs/guides/github-actions.md)

Publishing results

- After “Save Results” creates a PR and the PR is merged, results appear on the site after the nightly deploy. Admins can run the deploy workflow manually to publish immediately. The UI shows a notification to inform users of this timing.

### Centralized Archive (optional)

Template Doctor can also archive a small JSON metadata file to a central repository for each analysis.

- How to enable and required variables: see
  - Env vars reference: [docs/reference/environment-variables.md](docs/reference/environment-variables.md)
  - Action setup (archive section): [docs/guides/github-actions.md](docs/guides/github-actions.md#6-centralized-archive-of-analysis-metadata-optional)

Quick checklist

- In GitHub repo (Settings → Secrets and variables → Actions):
  - Set `TD_API_BASE` to your API base (e.g., `https://<your-swa>.azurestaticapps.net/api`).
  - Optionally set `TD_ARCHIVE_COLLECTION` (defaults to `aigallery`).
- In Azure Functions (Application Settings):
  - Set `GH_WORKFLOW_TOKEN` with Contents & Pull requests write access to the central archive repo (authorize SSO if needed).
- Enable archiving:
  - Globally: set `archiveEnabled: true` in runtime-config, or
  - Per-run: check the “Also save metadata to the centralized archive for this analysis” box in the analyze modal when global is off.

## Documentation

### Getting Started
- [Deployment Guide](DEPLOYMENT_GUIDE.md) - Simple steps for local and production deployment
- [Quick Start](QUICKSTART.md) - 5-minute setup guide
- [Troubleshooting](docs/guides/troubleshooting.md) - Common issues and solutions

### Deployment
- [AZD Deployment](docs/setup/azure-deployment.md) - Deploy with Azure Developer CLI
- [Production Database Setup](docs/setup/database-setup.md) - Cosmos DB with Managed Identity
- [Infrastructure Guide](infra/README.md) - Bicep templates and deployment

### Development
- [Architecture](docs/reference/architecture.md) - System architecture and flows
- [AGENTS.md](AGENTS.md) - AI agent development guide
- [Environment Variables](docs/reference/environment-variables.md) - Complete configuration reference
- [OAuth Configuration](docs/reference/oauth-setup.md) - OAuth app setup
- [OAuth API Authentication](docs/reference/oauth-api.md) - API authentication guide
- [Database Schema](docs/reference/database-schema.md) - MongoDB/Cosmos DB schema

### Usage
- [GitHub Action Setup](docs/guides/github-actions.md) - CI/CD integration
- [Batch Scanning](docs/guides/batch-scanning.md) - Bulk template analysis
- [Security Analysis](docs/features/security-analysis.md) - Bicep security checks
- [Docker Guide](docs/guides/docker.md) - Docker deployment

### Testing
- [Test Coverage](docs/reference/testing.md) - Testing strategy and coverage

## Contributing

- Add/update tests for features and fixes
- Avoid native browser dialogs; use notifications to keep tests stable
- Format code before committing: `npm run format`
- Don't commit generated artifacts like `node_modules/` or large reports
- Update docs and workflows when changing paths or behavior
- See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines

## Security Analysis Features

Template Doctor includes enhanced security analysis for Bicep files:

1. **Managed Identity Detection**: Identifies when Managed Identity is properly used
2. **Insecure Authentication Detection**: Flags connection strings, access keys, SAS tokens
3. **Anonymous Access Detection**: Identifies resources that may allow anonymous access

Configure in rule sets via `bicepChecks.securityBestPractices` properties.

## Documentation

### Getting Started
- [Deployment Guide](DEPLOYMENT_GUIDE.md) - Simple steps for local and production deployment
- [Quick Start](QUICKSTART.md) - 5-minute setup guide
- [Troubleshooting](docs/guides/troubleshooting.md) - Common issues and solutions

### Deployment
- [AZD Deployment](docs/setup/azure-deployment.md) - Deploy with Azure Developer CLI
- [Production Database Setup](docs/setup/database-setup.md) - Cosmos DB with Managed Identity
- [Infrastructure Guide](infra/README.md) - Bicep templates and deployment

### Development
- [Architecture](docs/reference/architecture.md) - System architecture and flows
- [AGENTS.md](AGENTS.md) - AI agent development guide
- [Environment Variables](docs/reference/environment-variables.md) - Complete configuration reference
- [OAuth Configuration](docs/reference/oauth-setup.md) - OAuth app setup
- [OAuth API Authentication](docs/reference/oauth-api.md) - API authentication guide
- [Database Schema](docs/reference/database-schema.md) - MongoDB/Cosmos DB schema

### Usage
- [GitHub Action Setup](docs/guides/github-actions.md) - CI/CD integration
- [Batch Scanning](docs/guides/batch-scanning.md) - Bulk template analysis
- [Security Analysis](docs/features/security-analysis.md) - Bicep security checks
- [Docker Guide](docs/guides/docker.md) - Docker deployment

### Testing
- [Test Coverage](docs/reference/testing.md) - Testing strategy and coverage

## Contributing

- Add/update tests for features and fixes
- Avoid native browser dialogs; use notifications to keep tests stable
- Format code before committing: `npm run format`
- Don't commit generated artifacts like `node_modules/` or large reports
- Update docs and workflows when changing paths or behavior
- See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines
