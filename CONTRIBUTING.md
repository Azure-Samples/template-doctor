# Contributing to Template Doctor

Thanks for your interest in contributing! This document explains how to propose changes and what we expect in pull requests.

## TL;DR
- Use Conventional Commits: `feat:`, `dev:`, `test:`, `fx:`
- Include tests for any behavior change
- Run formatting and ensure CI is green
- Don’t introduce native browser dialogs; use the notification system

## Development Setup
- Frontend lives in `packages/app` (static site)
- API lives in `api` (Azure Functions)
- Local run:
  - API: `cd api && func start`
  - Frontend: `cd packages/app && npm start` (serves http://localhost:8080)

## Testing
- E2E tests use Playwright and live under `packages/app/tests`.
- Run all tests from the repository root:

```
npm test
```

- New features and bug fixes must include or update relevant tests.
- A guard test fails if native `alert/confirm/prompt` are used—stick to the in-app notifications API.

## Code Style
- Prettier is configured in `packages/app`.
- Before committing:

```
cd packages/app
npm run format
npm run format:check
```

- Keep changes focused and avoid reformatting unrelated files.

## Commit Messages (Conventional Commits)
Use the following types to keep history clean and automatable:
- `feat:` user-facing feature additions or changes
- `dev:` tooling, build, config, workflows, docs development
- `test:` adding or updating tests
- `fx:` bug fixes (functional or visual)

Examples:
- `feat: add resume flow for batch scanning`
- `fx: fix strict locator in notifications spec`
- `test: add guard against native dialogs`
- `dev: configure pages workflow exclusions`

Scope is optional but encouraged, e.g. `feat(frontend): ...` or `fx(api): ...`.

## Pull Requests
- Fill in the PR template and link related issues.
- Ensure:
  - All tests pass locally
  - Formatting checks pass
  - No generated artifacts or backups are committed (`results/`, `src/frontend/_backup_unused/`, `playwright-report/`, `node_modules/`)
- Update docs (README/spec) when behavior or configuration changes.

## Code Review
- Keep PRs small and focused; favor multiple smaller PRs over one large change.
- Respond to feedback promptly; explain trade-offs when relevant.

## Security & Secrets
- Do not commit secrets.
- Frontend must not store long-lived tokens; rely on the API for token exchange.

## License
By contributing, you agree that your contributions will be licensed under the repository’s license.
