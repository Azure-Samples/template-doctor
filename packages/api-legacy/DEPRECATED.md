## Deprecated Legacy API Folder

This folder (`packages/api-legacy`) contains the legacy JavaScript/Function.json based Azure Functions implementation.

All active endpoints have been migrated to the programmatic TypeScript model in `packages/api` under routes `v4/*` (served at `/api/v4/*`).

Do not add new code here. Migrate anything still required into `packages/api/src/functions/` and register it in the barrel `src/index.ts`.

Planned removal: once production deployment references only the new package and no consumers call unversioned routes.

If you believe something is missing, open an issue or PR referencing this file.
# Deprecated Folder: packages/api

This directory contains the legacy Azure Functions (v3, function.json based) implementation.

All active endpoints have been migrated to `packages/api-v4` (TypeScript, programmatic `app.http()` registration, routes under `api/v4/*`).

Status:
- Do NOT add new code here.
- Pending full deletion after confirming no external deployments reference this path.
- Guard tests now only scan `packages/api-v4`.

Next steps before deletion:
1. Ensure CI/CD workflows reference `packages/api-v4` only.
2. Remove any residual documentation references to this folder (in progress).
3. Delete this folder in a dedicated PR once consumers are updated.

If you believe you still need something from here, migrate it to `packages/api-v4/src/functions/` and add tests there.

-- Template Doctor Maintainers