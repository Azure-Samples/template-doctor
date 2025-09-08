# Template Doctor Express Server

Express replacement for Azure Functions endpoints. Maintains route and JSON contract parity under `/v4/*` (and transitional `/api/v4/*`).

## Current Status
See root `MIGRATION_MATRIX.md` for per-endpoint migration progress.

## Dev
```bash
cd packages/server
npm install
npm run dev
```
Server listens on `:4000` by default.

## Environment Variables
Mirrors existing Azure Function settings. Common keys:
- `GH_WORKFLOW_TOKEN`
- `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`, `GITHUB_REPOSITORY`, `GITHUB_REPO_BRANCH`
- `GITHUB_WORKFLOW_FILE`
- `GITHUB_CLIENT_ID`
- `ALLOW_REPO_OVERRIDE`
- `DEFAULT_RULE_SET`, `REQUIRE_AUTH_FOR_RESULTS`, `AUTO_SAVE_RESULTS`
- `TD_ARCHIVE_ENABLED`, `TD_ARCHIVE_COLLECTION`

## Docker
```bash
docker build -t templatedoctor-server:local -f packages/server/Dockerfile .
docker run -p 4000:4000 templatedoctor-server:local
```

## Future Restructure (Frontend Consolidation)
Planned: co-host frontend in same container.
Proposed adjustments:
- Move `packages/app` build output into `/app/public` (or `dist/public`)
- Add static hosting: `app.use(express.static("public"))`
- Relocate critical CSS/JS from `packages/app` to shared `/packages/server/public`
- Build pipeline: build frontend first → copy artifacts into server image → only ship runtime assets

## Notes
Global fetch available (Node 20). No extra fetch polyfill needed.
