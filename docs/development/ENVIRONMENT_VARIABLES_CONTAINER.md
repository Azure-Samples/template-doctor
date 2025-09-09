# Environment Variables (Container & Azure Container Apps Architecture)

This guide documents required and optional environment variables when running Template Doctor in a containerized deployment (local Docker / Docker Compose / Azure Container Apps) after migrating from the previous Static Web Apps + managed Functions model.

> Scope: Applies to the unified Express server (in `packages/server`) optionally serving the built frontend (`SERVE_FRONTEND=true`). Variables specific to the deprecated `packages/api` Azure Functions package are noted only where migration guidance is needed.

## 1. Quick Start (Local Container)

1. Build the frontend + server
   ```bash
   npm run build:full
   ```
2. Build the server image (Dockerfile lives at `packages/server/Dockerfile`):
   ```bash
   docker build -f packages/server/Dockerfile -t template-doctor:local .
   ```
3. Run with a minimal env file:
   ```bash
   cat > .env.container.local <<'EOF'
   PORT=4000
   SERVE_FRONTEND=true
   GITHUB_CLIENT_ID=YOUR_OAUTH_APP_CLIENT_ID
   GITHUB_CLIENT_SECRET=YOUR_OAUTH_APP_CLIENT_SECRET
   GH_WORKFLOW_TOKEN=ghp_xxx_with_repo_scopes
   DEFAULT_RULE_SET=dod
   REQUIRE_AUTH_FOR_RESULTS=true
   AUTO_SAVE_RESULTS=false
   ARCHIVE_ENABLED=false
   EOF

   docker run --env-file .env.container.local -p 4000:4000 template-doctor:local
   ```
4. Open http://localhost:4000 (SPA served) and OAuth flows will use the configured client ID.

## 2. Variable Inventory

### Loading Strategy (Why your root `.env` might not be found)

The Docker image deliberately does NOT copy your root `.env` (to avoid leaking secrets in layers). The running container only sees environment values you explicitly inject. If you started the container and variables like `GITHUB_CLIENT_ID` are missing inside, you likely forgot one of the following injection methods:

Supported methods:
1. Provide a curated env file at run time:
  ```bash
  docker run --env-file .env.container.local -p 4000:4000 template-doctor:local
  ```
2. Pass individual flags (useful in CI):
  ```bash
  docker run -e GH_WORKFLOW_TOKEN=$GH_WORKFLOW_TOKEN -e GITHUB_CLIENT_ID=$GITHUB_CLIENT_ID -e GITHUB_CLIENT_SECRET=$GITHUB_CLIENT_SECRET -p 4000:4000 template-doctor:local
  ```
3. Mount your existing `.env` and point `ENV_FILE` to it (server now supports this):
  ```bash
  docker run -v "$PWD/.env:/app/.env:ro" -e ENV_FILE=/app/.env -p 4000:4000 template-doctor:local
  ```

Server load order (first wins, later does NOT override):
1. `.env` in working directory (if present)
2. File specified by `ENV_FILE=/path/to/file`
3. `.env.$NODE_ENV` (e.g. `.env.production`) if present

If you want override semantics you can extend logic—current implementation prefers earliest source to reduce accidental secret shadowing.

### Azure Variable Classification (Container Runtime)

You may still have these Azure-related variables in your root `.env`. They are NOT consumed by the unified container server code today; they remain for tooling, legacy Functions workflows, or future expansion. Keep them if you still run provisioning scripts or GitHub workflows that rely on them—otherwise they are inert.

| Variable | Used by Container Server? | Typical Origin | Keep If… | Notes |
|----------|---------------------------|----------------|----------|-------|
| `AZURE_SUBSCRIPTION_ID` | No | Provisioning / scripts / GitHub Actions | You run infra scripts (`scripts/setup.sh`) or AZD/role assignment workflows | Safe to leave; not read at runtime |
| `AZURE_TENANT_ID` | No | Same as above | Same as above | Only used for Azure CLI / identity flows |
| `AZURE_CLIENT_ID` | No | UAMI / Service Principal setup | Using managed identity in legacy Functions or future Azure SDK calls | Not referenced in current server code |
| `AZURE_RESOURCE_GROUP` | No | Provision scripts | You still execute `scripts/setup.sh` | Not referenced by server |
| `AzureWebJobsStorage` | No | Azure Functions local dev | You still run the Functions project (`packages/api`) locally | Irrelevant to containerized Express app |
| `FUNCTIONS_WORKER_RUNTIME` | No | Azure Functions runtime | Same as above | Irrelevant to containerized Express app |

Decision Guidance:
1. Leave them in `.env` if you still run the older workflows—harmless but clutter.
2. If you fully migrated and want crisp minimal env, move them to a separate `.env.legacy` and stop passing that file to the container.
3. Future Azure SDK integration (e.g. listing resources) would reintroduce the need to document them here as “ACTIVE”. Until then they remain “LEGACY / OPTIONAL”.

### Core Server / Infrastructure

| Variable | Required | Purpose | Notes |
|----------|----------|---------|-------|
| `PORT` | No | Port the Express server listens on | Defaults to `4000` |
| `SERVE_FRONTEND` | No | If `true`, serve static frontend from `../app/dist` + SPA fallback | Build must have been executed beforehand |
| `NODE_ENV` | No | Standard Node environment flag | `production` inside runtime image |

### GitHub Access & Tokens

| Variable | Required | Purpose | Scopes Needed |
|----------|----------|---------|---------------|
| `GH_WORKFLOW_TOKEN` | Yes (server -> GitHub) | Primary PAT for repo dispatch, issue creation, PR ops, label ensure, archive branch creation | `repo` (Contents, Issues, Pull requests) + `workflow` if triggering workflows; enable SSO if org requires |
| `GITHUB_TOKEN_ANALYZER` | Recommended (optional override) | Dedicated token for repository content reads during analysis to isolate permissions | Can be read-only (`repo:read`) |
| `GITHUB_CLIENT_ID` | Yes (OAuth login) | GitHub OAuth App client ID | Provide to runtime config endpoint -> frontend |
| `GITHUB_CLIENT_SECRET` | Yes (OAuth exchange) | Secret used in token exchange route | Keep secret; never exposed to client |

### Repository Targeting & Defaults

| Variable | Required | Purpose | Fallback Logic |
|----------|----------|---------|---------------|
| `GITHUB_REPOSITORY` | No | Default slug `owner/repo` used when explicit owner/repo not provided | Many routes split into owner/repo if owner/name absent |
| `GITHUB_REPO_OWNER` | No | Explicit owner override for operations (validation, PR helpers) | If unset we parse `GITHUB_REPOSITORY` |
| `GITHUB_REPO_NAME` | No | Explicit repo name override | Same fallback as above |
| `GITHUB_REPO_BRANCH` | No | Target default branch for validation/status/PR | Defaults to `main` |
| `DISPATCH_TARGET_REPO` / `TD_DISPATCH_TARGET_REPO` | No | Repo to which repository_dispatch is sent for batch analysis | Exposed to frontend via runtime-config |
| `GH_TARGET_REPO` | Legacy (optional) | Earlier name used in `submit-analysis-dispatch` path | Prefer `DISPATCH_TARGET_REPO` |

### Analysis & Runtime Behavior

| Variable | Required | Purpose | Notes |
|----------|----------|---------|-------|
| `DEFAULT_RULE_SET` / `TD_DEFAULT_RULE_SET` | No | Global default ruleset pre-filled in UI | e.g. `dod`, `partner` |
| `DEPRECATED_MODELS` | No | Comma-separated list of model names flagged as deprecated in analyzer config | Provided as metadata only |
| `DEBUG_ANALYZE` | No | If `1`, logs per-file enrichment errors to console | Useful for diagnosing missing file content |
| `REQUIRE_AUTH_FOR_RESULTS` / `TD_REQUIRE_AUTH_FOR_RESULTS` | No | If truthy, hides saved results unless user authenticated | String flag; treat non-empty as true |
| `AUTO_SAVE_RESULTS` / `TD_AUTO_SAVE_RESULTS` | No | Automatically persists scan results (if backed by storage/action) | Requires GitHub token w/ necessary scopes |

### Archiving (Optional Feature)

| Variable | Required | Purpose | Default / Fallback |
|----------|----------|---------|-------------------|
| `ARCHIVE_ENABLED` / `TD_ARCHIVE_ENABLED` | No | Toggles centralized archive behavior | Off if unset |
| `ARCHIVE_COLLECTION` / `TD_ARCHIVE_COLLECTION` | No | Default collection label for archive JSON | None |
| `ARCHIVE_REPO_SLUG` | No | Location `owner/repo` of central archive repo | `Template-Doctor/centralized-collections-archive` |

### Validation Workflow (GitHub Actions Integration)

| Variable | Required | Purpose | Default |
|----------|----------|---------|---------|
| `GITHUB_WORKFLOW_FILE` | No | Name of workflow file invoked/queried for validation status | `validation-template.yml` |

### Runtime Config Exposure
Values surfaced to the frontend at `/v4/runtime-config`:

`GITHUB_CLIENT_ID`, `DISPATCH_TARGET_REPO`, `DEFAULT_RULE_SET`, `REQUIRE_AUTH_FOR_RESULTS`, `AUTO_SAVE_RESULTS`, `ARCHIVE_ENABLED`, `ARCHIVE_COLLECTION`, plus a `backend` object with `baseUrl`, `functionKey` (legacy), and `apiVersion`.

In container mode you typically do NOT set `TD_BACKEND_FUNCTION_KEY` / `BACKEND_FUNCTION_KEY`—they were for Azure Functions hosting.

### Legacy / Azure Functions Migration Notes

| Legacy Functions Var | Container Usage | Action |
|----------------------|-----------------|--------|
| `TD_BACKEND_BASE_URL` / `BACKEND_BASE_URL` | Usually omit | Frontend now same origin; base URL implied |
| `TD_BACKEND_FUNCTION_KEY` / `BACKEND_FUNCTION_KEY` | Not used | Remove from secrets unless still calling old Functions host |
| `AzureWebJobsStorage` | Not used | Only needed if retaining Functions for side-jobs |
| `FUNCTIONS_WORKER_RUNTIME` | Not used | Remove |

## 3. Local Development Patterns

### a. Pure Node (no Docker)
```bash
cp .env.example .env   # add tokens & client id/secret
npm run build:full
npm run start:full      # sets SERVE_FRONTEND=true
```
Navigate to http://localhost:4000.

### b. Docker Single Container
```bash
npm run build:full
docker build -f packages/server/Dockerfile -t template-doctor:local .
docker run --env-file .env.container.local -p 4000:4000 template-doctor:local
```

### c. Docker Compose (Example Snippet)
```yaml
services:
  template-doctor:
    build:
      context: .
      dockerfile: packages/server/Dockerfile
    env_file: .env.container.local
    environment:
      SERVE_FRONTEND: "true"
    ports:
      - "4000:4000"
    restart: unless-stopped
```

## 4. Azure Container Apps (ACA)

Recommended configuration mapping (via ACA Environment Variables or Secrets):

| Category | ACA Setting Type | Variables |
|----------|------------------|-----------|
| Public (non-sensitive UI flags) | Environment Vars | `DEFAULT_RULE_SET`, `REQUIRE_AUTH_FOR_RESULTS`, `AUTO_SAVE_RESULTS`, `ARCHIVE_ENABLED`, `ARCHIVE_COLLECTION` |
| Secrets (sensitive) | Secrets | `GH_WORKFLOW_TOKEN`, `GITHUB_CLIENT_SECRET`, `GITHUB_TOKEN_ANALYZER` (if used) |
| Mixed | Environment + Secret refs | `GITHUB_CLIENT_ID` (public) references Client ID directly |

ACA Deployment Considerations:
1. Set `SERVE_FRONTEND=true` if you want a single container (no CDN) serving UI + API.
2. Configure scaling: analysis calls are I/O bound (GitHub API); start with min=1, max=3 replicas.
3. Add health probe to `/health` (GET, 200 expected) since root path may serve SPA.
4. Add rate limiting or GitHub token rotation if hitting secondary rate limits.

Example az CLI excerpt (conceptual):
```bash
az containerapp secret set -n td-app -g rg --secrets gh-workflow-token=$GH_WORKFLOW_TOKEN gh-client-secret=$GITHUB_CLIENT_SECRET
az containerapp update -n td-app -g rg \
  --set-env-vars PORT=4000 SERVE_FRONTEND=true DEFAULT_RULE_SET=dod GITHUB_CLIENT_ID=$GITHUB_CLIENT_ID \
  --set-secret-env-vars GH_WORKFLOW_TOKEN=gh-workflow-token GITHUB_CLIENT_SECRET=gh-client-secret
```

## 5. Minimum Viable Sets

### Public Demo (Read-Only)
```
PORT=4000
SERVE_FRONTEND=true
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
GH_WORKFLOW_TOKEN=ghp_xxx
DEFAULT_RULE_SET=dod
REQUIRE_AUTH_FOR_RESULTS=true
```

### Full Feature (Archive + Dispatch + Validation)
```
PORT=4000
SERVE_FRONTEND=true
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
GH_WORKFLOW_TOKEN=ghp_xxx
GITHUB_TOKEN_ANALYZER=ghp_readonly_yyy
DISPATCH_TARGET_REPO=Org/results-repo
DEFAULT_RULE_SET=partner
ARCHIVE_ENABLED=true
ARCHIVE_COLLECTION=gallery
REQUIRE_AUTH_FOR_RESULTS=true
AUTO_SAVE_RESULTS=true
DEPRECATED_MODELS=gpt-3.5-turbo,model-old-x
```

## 6. Security & Operational Tips

1. Use separate tokens: one high-privilege `GH_WORKFLOW_TOKEN`, one read-only `GITHUB_TOKEN_ANALYZER`.
2. Rotate PATs quarterly; audit token scopes vs. actual API usage.
3. Prefer organization fine-grained PATs limited to specific repos.
4. Monitor GitHub rate limit headers; consider adding metrics endpoint if scaling.
5. For ACA, enable Diagnostic Logs to trace outbound GitHub API calls timing.
6. Never expose `GITHUB_CLIENT_SECRET` or PATs via runtime-config; only `GITHUB_CLIENT_ID` is surfaced.

## 7. Deprecation Checklist (From SWA + Functions to Container)

| Task | Status Guidance |
|------|-----------------|
| Remove Functions-specific keys (`AzureWebJobsStorage`, `FUNCTIONS_WORKER_RUNTIME`) | Safe once container routes replicate functionality |
| Remove `TD_BACKEND_FUNCTION_KEY` / `BACKEND_FUNCTION_KEY` from secrets | After frontend loads runtime-config from container successfully |
| Update OAuth callback URLs to container domain (`https://your-domain/callback.html`) | Required prior to user login in container deployment |
| Consolidate `.env` to root or deployment system | Done when container can start with single env file |
| Validate issue creation + label ensure in container | Run existing server tests + manual check |
| Remove legacy `_legacy_js_backup` | After a week of stable runs |

## 8. Troubleshooting

| Symptom | Likely Cause | Resolution |
|---------|--------------|-----------|
| 401 from GitHub on issue creation | Missing / wrong `GH_WORKFLOW_TOKEN` scope | Ensure token has `repo` + `workflow` (if needed) and SSO enabled |
| Frontend loads but API 404s | `SERVE_FRONTEND` off and no reverse proxy path | Set `SERVE_FRONTEND=true` or proxy `/v4` to container |
| OAuth popup error `redirect_uri mismatch` | OAuth App callback still points to old SWA domain | Update GitHub OAuth App settings |
| Analysis missing file contents | Hitting rate limit or missing `GITHUB_TOKEN_ANALYZER` | Add analyzer token or reduce concurrency |
| Archive endpoint 404 | `ARCHIVE_ENABLED` not set or route path mismatch | Enable variable and verify route base `/v4/archive-collection` |

---

For updates or additions, edit this file: `docs/development/ENVIRONMENT_VARIABLES_CONTAINER.md`.
