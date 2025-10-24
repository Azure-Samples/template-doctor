# Changelog

All notable changes to Template Doctor will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.0](https://github.com/Azure-Samples/template-doctor/compare/v2.2.0...v2.3.0) (2025-10-24)


### Features

* Unified header navigation and empty state UI ([#172](https://github.com/Azure-Samples/template-doctor/issues/172)) ([e97c11b](https://github.com/Azure-Samples/template-doctor/commit/e97c11bb32ec7d6e60f2871a12ea49e8a6f0d1c5))


### Bug Fixes

* Category percentages showing 0% instead of real values ([#173](https://github.com/Azure-Samples/template-doctor/issues/173)) ([42863fe](https://github.com/Azure-Samples/template-doctor/commit/42863fe2666ac735344dfed1805998cc9399df83))

## [Unreleased]

### ⚠ BREAKING CHANGES

- **API Authentication**: All validation endpoints now require OAuth authentication. Existing clients that do not send authentication tokens will receive 401 errors. Migration required:
  - Clients must implement GitHub OAuth flow to obtain access tokens
  - Include `Authorization: Bearer <github_token>` header in all requests to validation endpoints
  - Affected endpoints: `/api/v4/validation-template`, `/api/v4/validation-docker-image`, `/api/v4/validation-ossf`, `/api/v4/validation-status`, `/api/v4/validation-cancel`, `/api/v4/validation-callback`
  - See `docs/development/OAUTH_CONFIGURATION.md` for OAuth setup details

### Features

- Add OAuth 2.0 authentication to all API endpoints (except public health/config endpoints)
- Add three-tier rate limiting (standard: 100/min, strict: 10/min, auth: 20/min)

### Bug Fixes

- Fix health endpoint path in logger configuration (was `/api/v4/health`, corrected to `/api/health`)
- Remove duplicate vitest imports in test files

## 1.0.0 (2025-10-07)

### ⚠ BREAKING CHANGES

- Deleted 49 legacy JavaScript files from packages/app/js/

### Features

- Add Azure Developer CLI (azd) deployment support with optimized build system ([#126](https://github.com/Template-Doctor/template-doctor/issues/126)) ([7afdd08](https://github.com/Template-Doctor/template-doctor/commit/7afdd08dc0afe15cccb0be5ecbd54eaa54b2bb1d))
- add compliance check for agents.md ([#100](https://github.com/Template-Doctor/template-doctor/issues/100)) ([ed8f10f](https://github.com/Template-Doctor/template-doctor/commit/ed8f10fc923815dfdde83ace8ae5dadd99de9e28))
- add granular config ([c881a93](https://github.com/Template-Doctor/template-doctor/commit/c881a93dffdba2a9c1ac0bae4c675d317cf47dc9))
- add new repo feat ([e992a83](https://github.com/Template-Doctor/template-doctor/commit/e992a8385ea99f59f507f412d2f3aad9fb5389b9))
- add pr when new scan ([b2d0e56](https://github.com/Template-Doctor/template-doctor/commit/b2d0e5689e6cd21451ef6b980c18efd746b07f53))
- debug app and api ([#80](https://github.com/Template-Doctor/template-doctor/issues/80)) ([429954e](https://github.com/Template-Doctor/template-doctor/commit/429954ecd7adfedde0b7d4f235fe1086c1ea1491))
- dev container (Node + PY) ([#18](https://github.com/Template-Doctor/template-doctor/issues/18)) ([6b3dfa5](https://github.com/Template-Doctor/template-doctor/commit/6b3dfa55233444e362a3bc4dc99ff5469de8c5a1))
- docs-config: integration for repo config ([#21](https://github.com/Template-Doctor/template-doctor/issues/21)) ([6e59f3b](https://github.com/Template-Doctor/template-doctor/commit/6e59f3b61c8277ac747d144d903cbeae6f0e21ab))
- enable batch testing ([#5](https://github.com/Template-Doctor/template-doctor/issues/5)) ([5f94c44](https://github.com/Template-Doctor/template-doctor/commit/5f94c44751e2e29751171508f721e57bae479dd5))
- improve issue creation ([#92](https://github.com/Template-Doctor/template-doctor/issues/92)) ([ff35702](https://github.com/Template-Doctor/template-doctor/commit/ff3570233c21d39fb6bcad8f45ec4c49368c7802))
- migration to typescript and express server ([#128](https://github.com/Template-Doctor/template-doctor/issues/128)) ([5171351](https://github.com/Template-Doctor/template-doctor/commit/517135131052c0cbe2def2b2966a7e55a7b545a5))
- queue analysis requests and poll for service readiness to reduce 'services not available' errors ([df54efb](https://github.com/Template-Doctor/template-doctor/commit/df54efbfa3b44b25d8999adc674e354e5a323a82))
- scroll to analysis area on triggering scan ([#110](https://github.com/Template-Doctor/template-doctor/issues/110)) ([b804194](https://github.com/Template-Doctor/template-doctor/commit/b804194f1c2fbdbd325a9b4187a750347ef932a2))
- separate out docs analysis ([#40](https://github.com/Template-Doctor/template-doctor/issues/40)) ([5b80aeb](https://github.com/Template-Doctor/template-doctor/commit/5b80aeb1ff2d5757632f6710038d7fea67a94442))
- workflow ossf score ([#53](https://github.com/Template-Doctor/template-doctor/issues/53)) ([755bb9d](https://github.com/Template-Doctor/template-doctor/commit/755bb9dab116c4009a80d4b6ffcf7814e8d1791c))

### Bug Fixes

- add missing files ([#65](https://github.com/Template-Doctor/template-doctor/issues/65)) ([1ecbf9a](https://github.com/Template-Doctor/template-doctor/commit/1ecbf9a9086f268916fa4f8b1665d8d753e50368))
- add more scope ([62cc3a4](https://github.com/Template-Doctor/template-doctor/commit/62cc3a41f9f7bd0ea8954b01ed9b37355d0a3b5a))
- assign only main issue ([b4b1761](https://github.com/Template-Doctor/template-doctor/commit/b4b1761a2c1b932c8ec208dff4c4ecef5e456347))
- assign to copilot ([3df2e65](https://github.com/Template-Doctor/template-doctor/commit/3df2e651424880e82793785649ab73ee87d941bb))
- clean auth and config ([#23](https://github.com/Template-Doctor/template-doctor/issues/23)) ([97a0d98](https://github.com/Template-Doctor/template-doctor/commit/97a0d9872a878ba9ff28c4bba3233f680c0bbe49))
- cleanup workflow ([a4992b8](https://github.com/Template-Doctor/template-doctor/commit/a4992b80e0a7e84c3510aaa4c5cacb3ff4f5bf82))
- **dispatch:** define repoSlug from payload/env/url; fix workflow if conditions to use env mapping again ([c17986b](https://github.com/Template-Doctor/template-doctor/commit/c17986b515e9526411d01de722c2dbb5278c57aa))
- Docs config - mock data and better categories ([#120](https://github.com/Template-Doctor/template-doctor/issues/120)) ([1b94ed8](https://github.com/Template-Doctor/template-doctor/commit/1b94ed84b6ba5f549b38b2c026cbb9df5acb484b))
- Docs config - rename integration function ([#88](https://github.com/Template-Doctor/template-doctor/issues/88)) ([27e614a](https://github.com/Template-Doctor/template-doctor/commit/27e614a0b3bc6112344ad1740ea0bd5a5cd131eb))
- fix action buttons visibility and interactivity ([b433df8](https://github.com/Template-Doctor/template-doctor/commit/b433df8d182cecc138e0de0277cf62ac02a3b9e9))
- fix analysis ([abc6b06](https://github.com/Template-Doctor/template-doctor/commit/abc6b068a10f96e8dfc23f8e522b993cc6418921))
- fix api ([773ca46](https://github.com/Template-Doctor/template-doctor/commit/773ca4642555b8f11795d51601719e9f3560f32c))
- fix api base and csp issue ([7cf3ea6](https://github.com/Template-Doctor/template-doctor/commit/7cf3ea6dd69a59c74366dd04c2264073308f3c6c))
- fix apiBase remote ([9371012](https://github.com/Template-Doctor/template-doctor/commit/9371012d3aff39e21168ee1fd984bbcfa26d97d4))
- fix auth ([#9](https://github.com/Template-Doctor/template-doctor/issues/9)) ([6aa6090](https://github.com/Template-Doctor/template-doctor/commit/6aa609075503614be7bf997cfa0420c17dbef867))
- fix auth after merge and add docs ([#26](https://github.com/Template-Doctor/template-doctor/issues/26)) ([9768d10](https://github.com/Template-Doctor/template-doctor/commit/9768d10b19649a737b96a325e19ebad5cf982969))
- fix back to search ([aff9740](https://github.com/Template-Doctor/template-doctor/commit/aff9740b0d0c0d897d3a3174165c49e6beda18ad))
- fix create fork ([#52](https://github.com/Template-Doctor/template-doctor/issues/52)) ([c867f40](https://github.com/Template-Doctor/template-doctor/commit/c867f40ba2d423488f91d7e7c65f07841c4b5bdf))
- fix files ([c29fb6b](https://github.com/Template-Doctor/template-doctor/commit/c29fb6bf1baebfb0a74e7d9cba2aef30a6cba6bf))
- fix historical data display ([#10](https://github.com/Template-Doctor/template-doctor/issues/10)) ([e210374](https://github.com/Template-Doctor/template-doctor/commit/e210374f021710e6f926a77cc876c0bbd8e1c2a2))
- fix history ([3b02fe7](https://github.com/Template-Doctor/template-doctor/commit/3b02fe7eb7640b5b278cad6006f234cd69e6cfb8))
- fix list ([7853ace](https://github.com/Template-Doctor/template-doctor/commit/7853ace6ae98ac9481eb25deb1f9fbb043862ce4))
- fix mi for action ([#28](https://github.com/Template-Doctor/template-doctor/issues/28)) ([fde264f](https://github.com/Template-Doctor/template-doctor/commit/fde264f0f154f9213068d708596c3860029830fa))
- fix pr creation and history ([#44](https://github.com/Template-Doctor/template-doctor/issues/44)) ([639dd9c](https://github.com/Template-Doctor/template-doctor/commit/639dd9c67c43a0876f72994fca55907d8a742b32))
- fix provision and deploy ([d64348d](https://github.com/Template-Doctor/template-doctor/commit/d64348d77dc33f53b3df64af35e7707211298cd9))
- fix rescan, view report ([a24318b](https://github.com/Template-Doctor/template-doctor/commit/a24318b86c18da1c2e7446b336f7435c34d51832))
- fix scroll to tile (again) ([3b2d4f3](https://github.com/Template-Doctor/template-doctor/commit/3b2d4f3e97810b7675d819a63c0b9d989478c94f))
- fix search and implement new scan ([4253ecc](https://github.com/Template-Doctor/template-doctor/commit/4253eccb6ee1b8fbf8221af3c3889274fcb696ae))
- fix show report ([baca1d8](https://github.com/Template-Doctor/template-doctor/commit/baca1d85542cec37e2f90b832c39a3b7916490aa))
- fix start-job (preliminar) ([2041c41](https://github.com/Template-Doctor/template-doctor/commit/2041c410bed3fa27a484fd2655b1261285be7acd))
- fix submission of PR ([#42](https://github.com/Template-Doctor/template-doctor/issues/42)) ([b0e4a43](https://github.com/Template-Doctor/template-doctor/commit/b0e4a4319670e19f844e3239c1ab6e14b68fac4f))
- fix template rendering ([79fb572](https://github.com/Template-Doctor/template-doctor/commit/79fb5722adfa2d6e5cedf95ecabc9ad7ac326b76))
- fix Test AZD deployment button that was hitting the old endpoint ([#63](https://github.com/Template-Doctor/template-doctor/issues/63)) ([6b1f5b5](https://github.com/Template-Doctor/template-doctor/commit/6b1f5b57012d15bde7ecd210a6edadc24a1556d0))
- fix unbound env var ref ([57ecaab](https://github.com/Template-Doctor/template-doctor/commit/57ecaab9f526b72f6e5013542402985dfd33911e))
- fixed trigger from UI ([534a641](https://github.com/Template-Doctor/template-doctor/commit/534a64183535859f4cf3fdefbc5ff6e3cfcf99dc))
- fork indicator and history fetching for old forks ([549376d](https://github.com/Template-Doctor/template-doctor/commit/549376dbdd3945f26a265ef4984128c95edf462e))
- improve config ([#121](https://github.com/Template-Doctor/template-doctor/issues/121)) ([a04204f](https://github.com/Template-Doctor/template-doctor/commit/a04204f5c95073d5f2777edac7822a42a517265e))
- improve security scan ([#24](https://github.com/Template-Doctor/template-doctor/issues/24)) ([e8c63f9](https://github.com/Template-Doctor/template-doctor/commit/e8c63f9a055110f93718c7f3727d3460b286037a))
- make gh labels configurable ([7a555b1](https://github.com/Template-Doctor/template-doctor/commit/7a555b1d1e3b3fa61738610f8942b9297eac15e0))
- make global assignment conditional to check ([1da1b91](https://github.com/Template-Doctor/template-doctor/commit/1da1b917ed628362bfb53d41c7466cff348e6698))
- make results path configurable ([22cac3c](https://github.com/Template-Doctor/template-doctor/commit/22cac3ceeedbf88b335eab7499cb2e1a465bf732))
- OSS/Trivy actions with run id ([#101](https://github.com/Template-Doctor/template-doctor/issues/101)) ([2384206](https://github.com/Template-Doctor/template-doctor/commit/2384206c62a29d213ad2acf53c0b035670085bf0))
- OSSF & Trivy - More message fixes for reporting ([#118](https://github.com/Template-Doctor/template-doctor/issues/118)) ([6bde1de](https://github.com/Template-Doctor/template-doctor/commit/6bde1de8251964f9770f682c1c735aaef9c824e8))
- ossf scorecard action - better logging ([#85](https://github.com/Template-Doctor/template-doctor/issues/85)) ([0aa35db](https://github.com/Template-Doctor/template-doctor/commit/0aa35db54c81692b039925a4c016a5a8c17d1b22))
- OSSF workflow run URL ([#111](https://github.com/Template-Doctor/template-doctor/issues/111)) ([bae8df0](https://github.com/Template-Doctor/template-doctor/commit/bae8df017b74a34ff835ebb18f8ca13491634693))
- remove duplicate code ([f1bc282](https://github.com/Template-Doctor/template-doctor/commit/f1bc2827384f4864a19b5cab2cc77171517b08e1))
- revert broken session changes ([ed0ca7e](https://github.com/Template-Doctor/template-doctor/commit/ed0ca7ecffdccf50eaf20df95e9af7c62c9324d8))
- search and fork ([2b89eb7](https://github.com/Template-Doctor/template-doctor/commit/2b89eb716e40cf28f88fe6455f01672d36f29624))
- submit template analysis ([#29](https://github.com/Template-Doctor/template-doctor/issues/29)) ([46b0513](https://github.com/Template-Doctor/template-doctor/commit/46b05134ac89e9bc988d19b3cea4f4d2cce8ba6f))
- Update APIs to return better core info for reporting ([#116](https://github.com/Template-Doctor/template-doctor/issues/116)) ([6555c37](https://github.com/Template-Doctor/template-doctor/commit/6555c376c833bbfc1ef21f4c6816f9e59524fcfe))
- **workflow:** reference secrets via env in if: expressions to avoid 'Unrecognized named-value: secrets' ([#45](https://github.com/Template-Doctor/template-doctor/issues/45)) ([a479d98](https://github.com/Template-Doctor/template-doctor/commit/a479d9860e173a861a37b569e4119a9ef127d4d6))

### Reverts

- **workflow:** restore single PR creation step using GITHUB_TOKEN; keep archive step gated by archiveEnabled ([b7e1ff1](https://github.com/Template-Doctor/template-doctor/commit/b7e1ff1ff10e4f260dc30c8e50b97de23b93820f))

### Code Refactoring

- update HTTP wrapper to enforce correct signature and return value ([5171351](https://github.com/Template-Doctor/template-doctor/commit/517135131052c0cbe2def2b2966a7e55a7b545a5))

### 🎉 Major Release - Express Architecture Migration

Template Doctor 1.0.0 marks the completion of the TypeScript migration and transition from Azure Functions to a containerized Express-based architecture.

### Added

- **Express Backend** (`packages/server`): New TypeScript REST API on port 3001
  - OAuth token exchange
  - Template validation endpoints
  - GitHub integration
  - CORS-enabled for frontend communication
- **Docker Deployment**: Containerized architecture with `Dockerfile.combined`
  - Single-container production build
  - Multi-container development setup with `docker-compose.yml`
- **TypeScript Frontend**: Vite SPA with HMR for fast development
  - Port 4000 (development), Port 3000 (preview/production)
- **Comprehensive Documentation**:
  - Updated README with Express architecture
  - Docker deployment instructions
  - Troubleshooting guide
  - Port allocation table

### Changed

- **Architecture**: Migrated from Azure Functions to Express server
- **Build System**: Added `build:all` with correct dependency order (analyzer-core → server → app)
- **Test Suite**: Reorganized unit tests
  - Moved legacy API tests to `tests/unit/legacy-api/`
  - Excluded legacy tests from vitest
  - Only `analyzer.categories.spec.js` runs in CI (6 tests, all passing)

### Removed

- **Azure Static Web Apps**: Removed all SWA deployment workflows
  - `manual-swa-deploy.yml`
  - `manual-swa-deploy-simple.yml`
  - `nightly-swa-deploy.yml`
- **Azure Functions**: Removed legacy serverless deployment
  - `azure-functions-v4.yml` workflow deleted
  - Legacy API code preserved in `legacy/azure-functions` branch
- **Legacy Tests**: 7 legacy API tests moved out of CI
  - Tests depend on removed Azure Functions code
  - Preserved in `tests/unit/legacy-api/` for reference

### Fixed

- **Build Order**: analyzer-core builds before dependent packages
- **Package Verification**: Updated `scripts/verify-packages.sh` for current structure
- **TypeScript Compilation**: All packages compile without errors
- **Vitest Configuration**: Properly excludes legacy-api tests

### Infrastructure

- **CI/CD Workflows**:
  - Removed: smoke-api.yml (TODO: re-add after debugging server startup)
  - Active: guard-packages, validation, submit-analysis, etc.
- **Environment Variables**: Consolidated configuration
  - Backend: `packages/server/.env` (copied from root during build)
  - Frontend: `packages/app/config.json` (client config)
  - Root: `.env` (single source of truth)

### Breaking Changes

- **Deployment Method**: No longer uses Azure Static Web Apps or Azure Functions
  - New deployment: Docker containers via `Dockerfile.combined`
  - See README for migration instructions
- **Port Changes**:
  - Express backend: 3001 (was: Azure Functions on 7071)
  - Frontend preview: 3000 (was: 5173)
  - Frontend dev: 4000 (was: 5173)
- **Legacy API**: Removed from production
  - Code preserved in `legacy/azure-functions` branch for reference
  - Express server provides equivalent functionality

### Migration Guide

For users upgrading from pre-1.0.0 versions:

1. **Pull latest changes**:

   ```bash
   git pull origin main
   npm ci
   ```

2. **Update OAuth configuration**:
   - Update GitHub OAuth app callback URLs to use port 3000/3001
   - See `docs/development/OAUTH_CONFIGURATION.md`

3. **Docker deployment** (recommended):

   ```bash
   docker build -f Dockerfile.combined -t template-doctor .
   docker run -p 3000:3000 --env-file .env template-doctor
   ```

4. **Manual deployment**:
   ```bash
   npm run build:all
   npm run preview -w packages/server
   ```

### Known Issues

- Smoke API tests disabled (TODO: fix Express server startup in CI)
- See `TODO.md` for tracked improvements

### Contributors

Thank you to all contributors who made this release possible!

---

## [Unreleased]

Changes that are in development but not yet released will appear here.

---

[1.0.0]: https://github.com/Template-Doctor/template-doctor/releases/tag/v1.0.0
