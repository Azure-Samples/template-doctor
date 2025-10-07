# Environment Variables Documentation

This document provides an overview of the environment variables used in the Template Doctor project. We've consolidated the environment variables for the Express-based containerized architecture.

## Architecture Change: Azure Functions → Express

Template Doctor has migrated from Azure Functions to an Express server running in Docker containers. This simplifies configuration and improves local development experience.

### Environment File Locations

- **Root `.env`**: Shared variables for scripts and development
- **`packages/server/.env`**: Express backend configuration (copied from root during build)
- **`packages/app/config.json`**: Frontend runtime configuration

## Core Environment Variables

These are the essential variables that should be in your `.env` file for local development:

| Variable               | Description                                     | Required           | Used In                  |
| ---------------------- | ----------------------------------------------- | ------------------ | ------------------------ |
| `GITHUB_TOKEN`         | GitHub personal access token used for API calls | Yes                | Express, GitHub Action   |
| `GH_WORKFLOW_TOKEN`    | GitHub personal access token used for API calls | Yes                | Express, GitHub Action   |
| `GITHUB_CLIENT_ID`     | OAuth client ID for GitHub authentication       | Yes                | Frontend, Express        |
| `GITHUB_CLIENT_SECRET` | OAuth client secret for GitHub authentication   | Yes                | Express (OAuth endpoint) |
| `GITHUB_OWNER`         | GitHub organization or user name                | Yes                | Scripts, Express         |
| `GITHUB_REPO`          | GitHub repository name                          | Yes                | Scripts, Express         |
| `PORT`                 | Express server port (default: 3001)             | No (default: 3001) | Express                  |
| `NODE_ENV`             | Environment mode (development/production)       | No (default: dev)  | Express, Frontend        |

Notes:

- `GH_WORKFLOW_TOKEN` is used by server-side functions to call GitHub (e.g., repository_dispatch and centralized archive PRs). It must have the right scopes and be SSO-authorized if your org requires it.
- Express server runs on port 3001 by default in development, configurable via `PORT`
- Vite dev server runs on port 4000, preview on port 3000

## Optional Environment Variables

The following environment variables are optional and can be set in different ways:

- In the `.env` file for local development
- In deployment environments (Azure Static Web Apps settings, GitHub Actions secrets)
- In `config.json` for frontend settings

### API Configuration (Optional)

| Variable                               | Description                       | Required | Used In  | Setting Method       |
| -------------------------------------- | --------------------------------- | -------- | -------- | -------------------- |
| `API_BASE_URL` / `TD_BACKEND_BASE_URL` | Base URL for API endpoints        | No       | Frontend | config.json, env var |
| `BACKEND_BASE_URL`                     | Alternative name for API base URL | No       | Express  | env var              |

Notes:

- In local development: Frontend uses `http://localhost:3001` for Express backend
- In production: Configured via `config.json` or runtime environment
- Docker deployment: Uses internal container networking

### GitHub Action Dispatch Target (Optional)

### GitHub Action Dispatch Target (Optional)

| Variable                  | Description                                                 | Required | Used In | Setting Method |
| ------------------------- | ----------------------------------------------------------- | -------- | ------- | -------------- |
| `GITHUB_ACTION_REPO`      | Target repository for saving results (format: `owner/repo`) | No       | Express | env var        |
| `DISPATCH_TARGET_REPO`    | Alternative name for `GITHUB_ACTION_REPO`                   | No       | Express | env var        |
| `TD_DISPATCH_TARGET_REPO` | Another alternative name for `GITHUB_ACTION_REPO`           | No       | Express | env var        |

Notes:

- If omitted, the server will use `GITHUB_REPOSITORY` when available, otherwise it falls back to `Template-Doctor/template-doctor`
- Set this only on the server (Express backend). The client no longer needs to know or set this value.
- If the application and action live in the same repository, you can omit this and rely on `GITHUB_REPOSITORY` or the default fallback.

### Frontend Configuration (Optional)

### Frontend Configuration (Optional)

| Variable                      | Description                                         | Required           | Used In           | Setting Method       |
| ----------------------------- | --------------------------------------------------- | ------------------ | ----------------- | -------------------- |
| `DEFAULT_RULE_SET`            | Default ruleset to use for validation (e.g., 'dod') | No                 | Frontend, Express | config.json, env var |
| `TD_DEFAULT_RULE_SET`         | Alternative name for `DEFAULT_RULE_SET`             | No                 | Frontend, Express | env var              |
| `REQUIRE_AUTH_FOR_RESULTS`    | Whether to require authentication to view results   | No                 | Frontend          | config.json, env var |
| `TD_REQUIRE_AUTH_FOR_RESULTS` | Alternative name for `REQUIRE_AUTH_FOR_RESULTS`     | No                 | Frontend          | env var              |
| `AUTO_SAVE_RESULTS`           | Whether to automatically save results               | No                 | Frontend          | config.json, env var |
| `TD_AUTO_SAVE_RESULTS`        | Alternative name for `AUTO_SAVE_RESULTS`            | No                 | Frontend          | env var              |
| `AZURE_DEVELOPER_CLI_ENABLED` | Enable Azure Developer CLI features                 | No (default: true) | Frontend, Express | config.json, env var |

### Issue AI Enrichment (Optional)

### Issue AI Enrichment (Optional)

| Variable                        | Description                                                          | Required        | Used In           | Setting Method       |
| ------------------------------- | -------------------------------------------------------------------- | --------------- | ----------------- | -------------------- |
| `ISSUE_AI_ENABLED`              | Master flag enabling AI enrichment of issue bodies (`true/1/yes/on`) | No              | Express, Frontend | config.json, env var |
| `TD_ISSUE_AI_ENABLED`           | Alternative name for `ISSUE_AI_ENABLED`                              | No              | Express           | env var              |
| `ISSUE_AI_PROVIDER`             | Force provider selection (`azure` or `github`)                       | No (auto)       | Express           | env var              |
| `ISSUE_AI_MODEL`                | Generic model name                                                   | No              | Express           | env var              |
| `AZURE_OPENAI_ENDPOINT`         | Azure OpenAI endpoint URL                                            | Yes (if azure)  | Express           | env var              |
| `AZURE_OPENAI_DEPLOYMENT`       | Azure OpenAI deployment name (model alias)                           | Yes (if azure)  | Express           | env var              |
| `AZURE_OPENAI_API_VERSION`      | Azure OpenAI API version                                             | No              | Express           | env var              |
| `AZURE_OPENAI_API_KEY`          | Azure OpenAI API key (dev only; prefer MSI in prod)                  | Yes (if no MSI) | Express           | env var              |
| `GITHUB_MODELS_TOKEN`           | Token for GitHub Models (if using GitHub provider)                   | Yes (if github) | Express           | env var              |
| `ISSUE_AI_RATE_LIMIT_MAX`       | Requests allowed per window per key                                  | No (20)         | Express           | env var              |
| `ISSUE_AI_RATE_LIMIT_WINDOW_MS` | Window length in ms for rate limiter                                 | No (60000)      | Express           | env var              |
| `ISSUE_AI_CACHE_TTL_MS`         | Cache TTL in ms for enriched responses                               | No (300000)     | Express           | env var              |
| `ISSUE_AI_CACHE_MAX`            | Max cached entries (approx LRU eviction)                             | No (500)        | Express           | env var              |

### Centralized Archive (Optional)

These variables enable saving a metadata JSON into a centralized archive repository (separate from the results PR).

| Variable                | Description                                                       | Required           | Used In                 | Setting Method          |
| ----------------------- | ----------------------------------------------------------------- | ------------------ | ----------------------- | ----------------------- |
| `TD_API_BASE`           | Base URL to your API endpoints that host `/archive-collection`    | Yes (if archiving) | GitHub Actions          | GitHub Actions secret   |
| `TD_ARCHIVE_COLLECTION` | Default collection name to file results under (e.g., `aigallery`) | No                 | GitHub Actions, Express | GitHub Actions variable |
| `TD_COLLECTION`         | Legacy alias for `TD_ARCHIVE_COLLECTION`                          | No                 | GitHub Actions, Express | GitHub Actions variable |
| `GH_WORKFLOW_TOKEN`     | PAT used by the `archive-collection` function                     | Yes (if archiving) | Express                 | env var                 |
| `ARCHIVE_REPO_SLUG`     | Override central archive repo slug in `owner/repo` form           | No                 | Express                 | env var                 |
| `TD_ARCHIVE_ENABLED`    | Enable centralized archive (`true/1/yes/on`)                      | No                 | Express                 | env var, config.json    |
| `ARCHIVE_ENABLED`       | Alternative name for `TD_ARCHIVE_ENABLED`                         | No                 | Express                 | env var, config.json    |

Notes:

- The `GH_WORKFLOW_TOKEN` must have Contents: Read/Write and Pull requests: Read/Write permissions on the central archive repo (enable SSO if needed)
- Default central archive repo is `Template-Doctor/centralized-collections-archive` if not specified

### Configuration Runtime Flags

These are set in `config.json` or propagated from server environment to client:

| Field                      | Description                               | Default                     | Setting Method       |
| -------------------------- | ----------------------------------------- | --------------------------- | -------------------- |
| `apiBase`                  | Base URL for API endpoints                | `${window.location.origin}` | config.json          |
| `defaultRuleSet`           | Default ruleset for analysis              | 'dod'                       | config.json, env var |
| `requireAuthForResults`    | Require authentication to view results    | true                        | config.json, env var |
| `autoSaveResults`          | Automatically save results                | false                       | config.json, env var |
| `archiveEnabled`           | Enable central archive for every analysis | false                       | config.json, env var |
| `archiveCollection`        | Default collection for archiving          | 'aigallery'                 | config.json, env var |
| `azureDeveloperCliEnabled` | Enable Azure Developer CLI checks         | true                        | config.json, env var |
| `dispatchTargetRepo`       | Target repo for saving results            | ''                          | config.json, env var |
| `issueAIEnabled`           | Enable AI enrichment for issue bodies     | false                       | config.json, env var |

| Variable                       | Description                                    | Required           | Used In | Setting Method       |
| ------------------------------ | ---------------------------------------------- | ------------------ | ------- | -------------------- |
| `DEPRECATED_MODELS`            | Comma-separated list of deprecated model names | No                 | Express | env var, config.json |
| `AI_DEPRECATION_CHECK_ENABLED` | Enable AI model deprecation check              | No (default: true) | Express | env var, config.json |

### Docker Configuration

| Variable               | Description                 | Required | Used In        | Setting Method |
| ---------------------- | --------------------------- | -------- | -------------- | -------------- |
| `DOCKER_REGISTRY`      | Container registry URL      | No       | Docker build   | env var        |
| `DOCKER_IMAGE_TAG`     | Docker image tag            | No       | Docker build   | env var        |
| `COMPOSE_PROJECT_NAME` | Docker Compose project name | No       | docker-compose | env var        |

### Azure Configuration (Legacy - For Reference)

These variables were used with Azure Functions and are maintained for the legacy branch:

| Variable                   | Description                      | Required    | Used In                  | Setting Method |
| -------------------------- | -------------------------------- | ----------- | ------------------------ | -------------- |
| `AZURE_SUBSCRIPTION_ID`    | Azure subscription ID            | Legacy only | Azure Functions (Legacy) | env var        |
| `AZURE_TENANT_ID`          | Azure tenant ID                  | Legacy only | Azure Functions (Legacy) | env var        |
| `AZURE_CLIENT_ID`          | Azure managed identity client ID | Legacy only | Azure Functions (Legacy) | env var        |
| `AZURE_RESOURCE_GROUP`     | Azure resource group             | Legacy only | Scripts (Legacy)         | env var        |
| `AzureWebJobsStorage`      | Storage connection string        | Legacy only | Azure Functions (Legacy) | env var        |
| `FUNCTIONS_WORKER_RUNTIME` | Functions runtime (node)         | Legacy only | Azure Functions (Legacy) | env var        |

## Setup Instructions

### Local Development with Docker

1. Copy the `.env.example` file to `.env` at the root of your project:

    ```bash
    cp .env.example .env
    ```

2. Fill in at least the core environment variables in the `.env` file:
    - GitHub authentication tokens
    - GitHub OAuth credentials
    - GitHub repo information

3. Start the development environment:

    **Option 1: Docker Compose (Recommended)**

    ```bash
    docker-compose up
    ```

    **Option 2: Manual (Two Terminals)**

    Terminal 1 - Express Backend:

    ```bash
    cd packages/server
    npm run dev  # Port 3001
    ```

    Terminal 2 - Vite Frontend:

    ```bash
    cd packages/app
    npm run dev  # Port 4000
    ```

4. Access the application:
    - Docker: http://localhost:3000
    - Manual dev: http://localhost:4000
    - Express API: http://localhost:3001

### Configuration Files

Frontend configuration is managed through:

- **`packages/app/config.json`**: Base configuration
- **`packages/app/config.local.json`**: Local overrides (not committed)
- **`packages/app/config.preview.json`**: Preview/production overrides

## GitHub OAuth Configuration

For the OAuth flow to work correctly, you need to:

1. Create a GitHub OAuth App in your GitHub Developer Settings
2. Set the Authorization callback URL based on your environment:
    - Local development: `http://localhost:3000/callback.html`
    - Production: `https://your-domain.com/callback.html`
3. Fill in the `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in your `.env` file
4. Copy these values to `packages/server/.env` (or ensure build process copies them)

See the [OAuth Configuration Guide](./OAUTH_CONFIGURATION.md) for more detailed instructions.

## Environment-Specific Configuration

### Docker Deployment

Environment variables are passed to containers via:

- `docker-compose.yml` for multi-container deployment
- Docker run `-e` flags for single-container deployment
- `.env` file (automatically loaded by docker-compose)

### GitHub Actions

Configure secrets and variables in Repository → Settings → Secrets and variables → Actions:

- `GITHUB_TOKEN`: Automatically provided by GitHub Actions
- `GH_WORKFLOW_TOKEN`: Add as repository secret
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`: Add as repository secrets

### Production Deployment

For containerized production deployments:

- Use secrets management (Azure Key Vault, AWS Secrets Manager, etc.)
- Pass environment variables through your container orchestration platform
- Never commit sensitive values to version control

### Azure Container Apps with EasyAuth

When deploying to Azure Container Apps with EasyAuth enabled:

| Variable | Description | Required | Used In | Notes |
| -------- | ----------- | -------- | ------- | ----- |
| `GITHUB_CLIENT_ID` | GitHub OAuth Client ID | Yes | EasyAuth, Express | Used by EasyAuth platform for OAuth |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret | Yes | EasyAuth | Used by EasyAuth platform for OAuth |
| `SETUP_ALLOWED_USERS` | Comma-separated GitHub usernames | No | Express | Usernames authorized for /setup endpoint |

**EasyAuth Headers (Injected by Azure)**:

When EasyAuth is enabled, Azure Container Apps automatically injects authentication headers into every request:

- `X-MS-CLIENT-PRINCIPAL`: Base64-encoded JSON with full user info
- `X-MS-CLIENT-PRINCIPAL-ID`: Unique user identifier
- `X-MS-CLIENT-PRINCIPAL-NAME`: GitHub username
- `X-MS-CLIENT-PRINCIPAL-IDP`: Identity provider (e.g., "github")

The Express middleware (`easyAuthMiddleware`) automatically extracts this information and makes it available as `req.easyAuth`.

**Protected Resources**:

With EasyAuth's `globalValidation` set to `RedirectToLoginPage`, all pages are protected:

- Unauthenticated users are automatically redirected to GitHub login
- After authentication, users are redirected back to their original destination
- The application can access user identity via EasyAuth headers

**Local Development**:

During local development without EasyAuth:

- EasyAuth headers are not present
- The application falls back to the existing OAuth flow (browser-based)
- Tokens are stored in localStorage
- No changes to local development workflow

See [Azure Container Apps EasyAuth Deployment Guide](../usage/CONTAINER_APPS_EASYAUTH.md) for full deployment instructions.

## Security Considerations

- Never commit your `.env` file to version control
- Use secrets management for production deployments
- Rotate credentials regularly
- Consider using managed identities in Azure where possible
- Do not expose AI provider keys to the frontend; only the server performs enrichment calls
- Monitor rate limiting metrics to detect abuse of the enrichment endpoint
- **EasyAuth**: Never commit `infra/main.parameters.json` - it contains secrets
- **EasyAuth**: Use Azure Key Vault for production secret storage (advanced)
