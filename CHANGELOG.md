# Changelog

All notable changes to Template Doctor will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0](https://github.com/Template-Doctor/template-doctor/compare/v2.0.0...v2.1.0) (2025-10-22)


### Features

* Add DISABLE_AUTH environment variable for testing ([#155](https://github.com/Template-Doctor/template-doctor/issues/155)) ([46cd3b4](https://github.com/Template-Doctor/template-doctor/commit/46cd3b47ea12731c65088f8a47866ef58d5941e5))
* Add OAuth 2.0 API Authentication ([#147](https://github.com/Template-Doctor/template-doctor/issues/147)) ([d312ec7](https://github.com/Template-Doctor/template-doctor/commit/d312ec781d96b4f2882083b0351f23d1f3d031a8))
* Add rate limiting to API endpoints with UI improvements ([#150](https://github.com/Template-Doctor/template-doctor/issues/150)) ([7944293](https://github.com/Template-Doctor/template-doctor/commit/79442932c83834168afd224c83ddb8c578c1ab6b))
* Improve setup script with enhanced UX and critical UAMI deploym… ([#160](https://github.com/Template-Doctor/template-doctor/issues/160)) ([a370114](https://github.com/Template-Doctor/template-doctor/commit/a37011463aa531d8157482b7bfd1dde954b76b83))
* release v2.2.0 with security fixes ([f2e88e4](https://github.com/Template-Doctor/template-doctor/commit/f2e88e42b8138211e28abd4dd860766b13cc0b3a))
* reset release-please to calculate from v2.0.1 ([315d715](https://github.com/Template-Doctor/template-doctor/commit/315d715e24d531e78d44760f4a17cf023468f2e2))
* trigger v2.2.0 release after establishing v2.1.0 baseline ([c6b9b5f](https://github.com/Template-Doctor/template-doctor/commit/c6b9b5f2943cffa3250e70d95f0270331796152a))


### Bug Fixes

* Add critical MongoDB connection guidance for Docker Compose users ([8d1aa95](https://github.com/Template-Doctor/template-doctor/commit/8d1aa9501494d8a5ab9bf55dcb5061f8f70a7c5c))
* scannedby createdby clean ([#158](https://github.com/Template-Doctor/template-doctor/issues/158)) ([bb5ab04](https://github.com/Template-Doctor/template-doctor/commit/bb5ab042239111421c5b312607c3aabdab37c7aa))
* trigger release-please workflow ([095b8cf](https://github.com/Template-Doctor/template-doctor/commit/095b8cf4404aa3294f6130ca4a52f459bb6cd9c1))
* update MongoDB connection string placeholder to avoid secret scanning ([#148](https://github.com/Template-Doctor/template-doctor/issues/148)) ([cab4c85](https://github.com/Template-Doctor/template-doctor/commit/cab4c85e247ba63b23b303d77293fa2281af9ba2))
* update release-please manifest to force 2.2.0 release ([2de5e6b](https://github.com/Template-Doctor/template-doctor/commit/2de5e6b5cf6995bc220803236eb35b82e6b8ab1d))

## [Unreleased]

## [2.2.0] - 2025-10-22

### Security Fixes

- **CRITICAL**: Fix XSS vulnerability in GitHub search (sanitize untrusted repository names before DOM insertion)
- **CRITICAL**: Fix GitHub issue search XSS (escape HTML in issue titles/bodies)
- **CRITICAL**: Sanitize repository URLs before DOM operations (prevent `javascript:` protocol attacks)
- **HIGH**: Fix validation status XSS in polling (sanitize repository names in status updates)
- **HIGH**: Escape Markdown content before rendering (prevent script injection via report content)
- **HIGH**: Fix metadata XSS in result cards (sanitize all user-controlled metadata fields)

### Performance Improvements

- Optimize leaderboard calculations (10x-40x faster with batched database queries)
- Add database indexes for common query patterns
- Implement efficient pagination for large result sets

### Bug Fixes

- Fix notification system edge cases (prevent double notifications)
- Improve error messages for validation failures
- Fix GitHub API rate limit handling

### Tests

- Add 65 comprehensive test cases (OAuth, XSS prevention, API endpoints)
- 100% passing rate (65/65 tests)
- Improved test coverage for security-critical paths

## [2.1.0] - 2025-10-20

### ⚠ BREAKING CHANGES

- **API Authentication**: All validation endpoints now require OAuth authentication. Existing clients that do not send authentication tokens will receive 401 errors. Migration required:
  - Clients must implement GitHub OAuth flow to obtain access tokens
  - Include `Authorization: Bearer <github_token>` header in all requests to validation endpoints
  - Affected endpoints: `/api/v4/validation-template`, `/api/v4/validation-docker-image`, `/api/v4/validation-ossf`, `/api/v4/validation-status`, `/api/v4/validation-cancel`, `/api/v4/validation-callback`
  - See `docs/development/OAUTH_CONFIGURATION.md` for OAuth setup details

### Features

- Add OAuth 2.0 authentication to all API endpoints (except public health/config endpoints) ([#147](https://github.com/Azure-Samples/template-doctor/issues/147))
- Add three-tier rate limiting (standard: 100/min, strict: 10/min, auth: 20/min) ([#150](https://github.com/Azure-Samples/template-doctor/issues/150))

### Bug Fixes

- Fix health endpoint path in logger configuration (was `/api/v4/health`, corrected to `/api/health`)
- Update MongoDB connection string placeholder to avoid secret scanning ([#148](https://github.com/Azure-Samples/template-doctor/issues/148))
- Remove duplicate vitest imports in test files

### Documentation

- Fix README port references, architecture, and Docker commands ([#149](https://github.com/Azure-Samples/template-doctor/issues/149))

## [2.0.1] - 2025-10-19

### Miscellaneous

- **Documentation reorganization** ([#141](https://github.com/Azure-Samples/template-doctor/pull/141))
  - Moved documentation to proper directories (docs/development/, docs/usage/, docs/deployment/)
  - Removed 1,668 lines of temporary files
  - Organized by purpose with clean root directory
  - Updated all cross-references
- **Azurite cleanup** ([#142](https://github.com/Azure-Samples/template-doctor/pull/142))
  - Removed storage emulator configuration files from version control
  - Already covered by .gitignore patterns
- **Prettier formatting** ([#143](https://github.com/Azure-Samples/template-doctor/pull/143))
  - Standardized code formatting across 95 files
  - 26,080 insertions, 24,436 deletions
  - TypeScript, JavaScript, JSON, Markdown, and YAML files formatted consistently

### Summary

- **3,398 lines removed**: Documentation debt and tech debt cleanup
- **Better organization**: Clean root directory with only GitHub standard files
- **Improved consistency**: Standardized code formatting across the entire codebase
- **No functional changes**: Pure cleanup and maintenance

## [2.0.0] - 2025-10-19

### ⚠ BREAKING CHANGES

- **TypeScript Migration**: Deleted 49 legacy JavaScript files from `packages/app/js/`. All frontend code has been migrated to TypeScript with modern ES modules.
- **Express Server**: Migrated from Azure Functions to Express.js backend for improved performance and development experience.
- **Database Architecture**: Introduced MongoDB persistence layer, replacing file-based storage.

### Major Features

#### Database Persistence (#135)
- MongoDB integration with comprehensive schema (repos, analysis, configuration, rulesets)
- Automatic persistence of all analysis results
- Historical tracking and trend analysis capabilities
- Seeded database with production-ready sample data

#### Express Server Migration (#128)
- Complete backend rewrite from Azure Functions to Express.js
- 20+ RESTful API endpoints with consistent error handling
- Improved CORS configuration and middleware architecture
- Enhanced logging with structured request/response tracking

#### Azure Developer CLI (azd) Support (#126)
- Full azd deployment integration
- Infrastructure as Code with Bicep templates
- Optimized Docker builds (multi-stage, layer caching)
- Azure Container Apps deployment support

#### Security & Validation
- Comprehensive XSS protection (18 patterns, 56 test cases, defense in depth)
- ACR managed identity authentication (no more password-based auth)
- Enhanced input validation with consistent UX (red borders, clear error messages)
- OSSF Scorecard workflow integration (#53)

#### Developer Experience
- Agents.md compliance validation (#100)
- Improved issue creation workflow (#92)
- Batch scan functionality (#5)
- Dev container support (Node + Python) (#18)
- Queue-based analysis requests with service readiness polling

### Bug Fixes

- Fixed action button visibility and interactivity
- Fixed historical data display (#10)
- Fixed Test AZD deployment button endpoint (#63)
- Fixed PR creation and history (#44)
- Fixed fork indicator and history fetching for old forks
- OSSF & Trivy message fixes for reporting (#118)
- OSSF workflow run URL (#111)

## [1.0.0] - 2025-10-07

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

[Unreleased]: https://github.com/Azure-Samples/template-doctor/compare/v2.2.0...HEAD
[2.2.0]: https://github.com/Azure-Samples/template-doctor/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/Azure-Samples/template-doctor/compare/v2.0.1...v2.1.0
[2.0.1]: https://github.com/Azure-Samples/template-doctor/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/Azure-Samples/template-doctor/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/Azure-Samples/template-doctor/releases/tag/v1.0.0
