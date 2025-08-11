# Template Doctor — Product Specification

## Summary
Template Doctor analyzes [Azure Developer CLI](https://github.com/Azure/azure-dev) templates against organizational standards as documented in our [Template Framework](https://github.com/Azure-Samples/azd-template-artifacts), producing actionable reports and dashboards. Because it is fully configurable, it accepts the default [Definition of Done](https://github.com/Azure-Samples/azd-template-artifacts/blob/main/docs/development-guidelines/definition-of-done.md) as well as custom configuration referrenced from a GitHub Gist. It ships as a static web frontend, an Azure Functions API, and optional GitHub integrations (Action and App) for automation. Core capabilities include single-template analysis, batch scanning with resume/cancel, rich in-app notifications (no native alerts), and publishing results to GitHub Pages.

## Goals
- Provide fast, reliable analysis of templates with clear guidance.
- Support batch scanning workflows with resumability and failure handling.
- Keep the frontend deployable as a static site; backend via Azure Functions.
- Enable GitHub-centric usage (Action/App) and publish reports to GitHub Pages.
- Maintain strong test coverage and contribution guardrails.

## Non-Goals
- General-purpose CI pipeline management.
- Managing private secrets in the frontend.
- Re-implementing GitHub features not essential to template analysis.

## Components
- Frontend (static)
  - Location: `src/frontend/`
  - Responsibilities: user interaction, batch controls, rendering results, notifications UI.
  - Served locally via Python HTTP server; deployed to GitHub Pages.
- Azure Functions API
  - Location: `api/`
  - Responsibilities: authentication helpers, analysis endpoints and utilities as needed.
  - Notable functions: `github-oauth-token`, `add-template-pr` (for PR creation using `dashboard-template.html`), to store a historical of tested templates.
- GitHub Integrations
  - GitHub Action and App for automated scanning and result publication.
- Results Artifacts
  - Location: `results/` (static data and dashboards), consumed by the frontend report loader.

## Functional Scope
1) Single Template Analysis
- User enters/selects a template target (e.g., repository GitHub URL).
- App initializes analyzer, displays progress notifications.
- On success, results render in the UI; on error, the user sees an actionable message with retry.

2) Batch Scanning
- Toggle “Batch Mode” to paste multiple targets (one per line).
- UI shows per-item status: Pending, In Progress, Succeeded, Failed, Canceled.
- Progress: counters for total, completed, failed; overall completion when all items finish.
- Retry failed items individually or re-run remaining failures.
- Persist progress to IndexedDB to allow resume after reload.
- Resume Flow: on reload, prompt to resume remaining items; skip completed.
- Cancel Flow: user can cancel the current batch; running item stops gracefully; status reflects cancellation.

3) Notifications UX
- In-app notification system (no native `alert/confirm/prompt`).
- Types: info, success, warning, error; supports loading states and confirmation prompts.
- Global API: `window.Notifications` with legacy alias `window.NotificationSystem`.
- Tests enforce non-use of native browser dialogs.

4) Results Viewing
- The app can load and display historical scans (from `results/`) including dashboards and summaries.
- Latest runs are accessible by convention (e.g., `latest.json` and generated dashboards).

5) Actions post-scan
- The user can use a one click approach to open GitHub issues for all issues found, and assign to Copilot for a fix
- The user can test deployability with the Template Doctor analyzes [Azure Developer CLI](https://github.com/Azure/azure-dev) 
- The user can open the template in Codespaces to fix manually with Copilot
  
  One-click issue creation details:
  - Issues are created per finding (or batched by category, configurable) with a consistent title prefix, e.g., "[Template Doctor] <rule-id>: <summary>".
  - Each issue includes rich context: ruleset name/version (DoD, partner, or custom), analysis run timestamp (ISO-8601), target repo/ref, severity, and direct links to the dashboard/report artifact.
  - Standardized labels are applied for fast triage, e.g., `template-doctor`, `autofix`, severity labels (`severity:high|medium|low`), and ruleset tags (`ruleset:DoD|partner|custom`).
  - Issues are dated in the body and/or via a `run:YYYY-MM-DD` label for easy filtering.
  - Issues are auto-assigned to a configured automation account or GitHub App (e.g., Copilot) which proposes or opens a PR to address the finding.
  - All operations are idempotent where possible (re-runs update or comment vs. duplicate) to avoid issue spam.

6) Authentication & GitHub
- OAuth/token helper via `api/github-oauth-token` (obtaining tokens server-side).
- Optional PR creation via `api/add-template-pr` using `dashboard-template.html`.
- GitHub Action and/or App automate scanning and publishing to Pages.

7) Deployment
- Frontend: GitHub Pages (workflow builds from `src/frontend`, excludes backups/tests/reports).
- API: Azure Functions (Linux Consumption, Node 18, Functions v4). CORS allows the Pages origin.

8) Observability & Quality
- E2E tests with Playwright (`src/frontend/tests`), run from repo root.
- Formatting via Prettier in `src/frontend` with format and format:check scripts.
- CI must pass tests and lint/format checks before merge.

## Assumptions
- Targets for default analysis are Git repositories intended to be deployed to Azure, (yet custom configuration allows to analyze any type of template or deployment)
- Network access and necessary tokens are available via API when required.
- IndexedDB is available for persistence in supported browsers.

## User Stories & Acceptance Criteria

US1: Analyze a single template
- As a user, I can analyze one template and see a clear success or error outcome, based on the DoD, or other ruleset
- Acceptance:
  - When “Analyze” is clicked, a loading notification appears.
  - On success, a success notification appears and results render.
  - On error, an error notification appears with a retry path.

US2: Run a batch scan across many templates
- As a user, I can paste multiple targets and run a batch scan with status per item.
- Acceptance:
  - Batch mode toggle reveals the multi-target input.
  - Each item displays one of: Pending, In Progress, Succeeded, Failed, Canceled.
  - Progress counters update as items complete.

US3: Retry failed items in batch mode
- As a user, I can retry items that failed.
- Acceptance:
  - Failed items expose a retry action.
  - On retry, the item’s status transitions through In Progress to Succeeded or Failed.

US4: Resume a partially completed batch after reload
- As a user, I can resume a batch after reloading the page.
- Acceptance:
  - On load, if there’s persisted state, a resume confirmation appears (notification UI).
  - If confirmed, only incomplete items are processed; completed items are skipped.

US5: Cancel a running batch
- As a user, I can cancel an in-progress batch.
- Acceptance:
  - Clicking Cancel stops processing promptly.
  - The current item resolves to Canceled if applicable; no new items start.
  - A notification confirms cancellation.

US6: See clear notifications without native dialogs
- As a user, I get consistent in-app notifications and never see native alert/confirm/prompt.
- Acceptance:
  - Info/success/warning/error notifications render with titles and messages.
  - Loading notifications transition to a terminal state (success/error) or dismiss.
  - Confirms are handled in-notification; no native dialogs appear.

US7: Authenticate with GitHub when required
- As a user, I can authenticate via a backend helper without exposing secrets in the browser.
- Acceptance:
  - Token exchange happens via `api/github-oauth-token`.
  - Frontend never stores long-lived secrets; CORS is restricted to Pages origin.

US8: Publish and view results on GitHub Pages
- As a maintainer, I can deploy or locally start the frontend and browse generated reports.
- Acceptance:
  - Pages workflow publishes content from `src/frontend` (excluding backups/tests/reports).
  - Report pages and dashboards render on the Pages site.

US9: Create a PR that includes a dashboard (optional)
- As a maintainer, I can trigger a PR to add a dashboard file using a provided HTML template. (token permissions dependendant)

- Acceptance:
  - Function `add-template-pr` uses `dashboard-template.html` to compose content.
  - A PR is created against the target repo with the dashboard artifact.

US10: Test with DoD standards, partner standards or custom rules
- As a maintainer, I can add configure the analysis to meet my specific requirements. All analysis result cards in the historical are properly tagged with the ruleset used, to validate compliant to internal collections


US11: Contribute safely with tests and formatting
- As a contributor, I must include tests and pass CI checks.
- Acceptance:
  - New features/bugfixes include Playwright E2E coverage.
  - `npm run format:check` passes; CI is green before merge.

US12: One-click issue creation with rich labeling and automation handoff
- As a maintainer, I can create issues for findings in one click, with standardized labels, dates, and tags, and auto-assign them to automation (e.g., Copilot) to open a PR.
- Acceptance:
  - A single action creates issues for current findings with consistent title schema and body content including run timestamp and ruleset.
  - Labels applied include `template-doctor`, a severity label, and a `ruleset:*` label; optionally a `run:YYYY-MM-DD` label is added.
  - Issues include direct links to the specific dashboard/report.
  - The assignee is set to a configured automation account (e.g., Copilot or a GitHub App) so that a follow-up PR is proposed or opened.
  - Re-running the action should update or comment on existing issues instead of creating duplicates when content matches (idempotent behavior).

## Scenarios 

Scenario: Successful single analysis
- Given the frontend is loaded and the API is reachable
- When I enter a valid template URL and click Analyze
- Then I see a loading notification
- And eventually a success notification and rendered results

Scenario: Error with retry
- Given the analyzer returns an error for a target
- When the error notification is shown
- Then I can trigger a retry from the UI
- And the item reprocesses and may succeed

Scenario: Batch resume after reload
- Given a batch was partially completed and persisted
- When I reload the app
- Then a resume confirmation notification is shown
- And if I confirm, only remaining items are processed

Scenario: Batch cancel
- Given a batch is in progress
- When I click Cancel
- Then the current item stops and status becomes Canceled
- And the batch does not start new items

Scenario: Notifications only (no native dialogs)
- Given the app needs to confirm an action
- When a confirmation is required
- Then a notification-based confirm appears
- And no browser-native dialog is used

Scenario: Configure and apply a custom ruleset
- Given the frontend is loaded and the default Definition of Done rules are active
- And a custom rules configuration is available at a GitHub Gist URL
- When I open the rules configuration settings
- And I select custom rules and provide the Gist URL
- And I save the configuration
- Then subsequent analyses use the custom ruleset for evaluation
- And each analysis result card is tagged with the ruleset identifier or source
- And when I switch to partner standards or the default DoD and re-run analysis
- Then new results reflect the selected ruleset and show the corresponding tag

Scenario: One-click issue creation with labels and automation handoff
- Given an analysis has completed with findings visible in the dashboard
- And a label taxonomy and automation assignee are configured
- When I click "Create Issues" from the post-scan actions
- Then issues are created for each finding (or batched per category) with titles prefixed by "[Template Doctor]"
- And each issue body includes the ruleset name/version, the ISO-8601 analysis timestamp, target repo/ref, severity, and links to the dashboard/report
- And labels include `template-doctor`, a severity label, and a `ruleset:*` label; optionally `run:YYYY-MM-DD`
- And the issues are auto-assigned to the configured automation account (e.g., Copilot) which will propose or open a PR
- And if I rerun the action without changes, duplicate issues are not created (existing issues are updated or commented)

## Non-Functional Requirements
- Performance: Reasonable responsiveness for lists of dozens to hundreds of targets; UI should not block.
- Reliability: Batch progress is persisted to IndexedDB; resume flow survives reloads/crashes.
- Security: No secrets in the frontend; tokens exchanged via API; CORS restricted to the Pages origin.
- Compatibility: Modern evergreen browsers; graceful degradation for storage where possible.
- Testability: Playwright E2E tests verify core flows, including guards against native dialogs.

## Edge Cases
- Network timeouts or intermittent failures: retries surface at item-level; batch can continue.
- Duplicate targets: either deduplicate or reprocess deterministically (implementation-defined).
- Mixed results: ensure counters and final status are consistent.
- User leaves the page mid-scan: persistence enables resume; cancellation is implicit if not resumed.

## Configuration
- Frontend base URLs and API endpoints are configurable via environment or constants.
- CORS on the Function App must include the GitHub Pages origin.
- Pages workflow excludes `src/frontend/_backup_unused/`, tests, and reports.

## CI/CD
- Frontend: GitHub Pages workflow builds artifacts and deploys.
- API: Azure Functions workflow deploys via publish profile; Node 18; Functions v4; Linux Consumption.
- Secrets: store publish profile and app name in GitHub repository secrets.

## Acceptance & Validation
- Playwright test suite passes from the repository root using the configured `playwright.config.js`.
- Manual smoke test: local API on 7071, frontend on 8080; single and batch flows operate as specified.

## Out of Scope
- Reporting across arbitrary data sources beyond template analysis.
- Long-term result storage outside static artifacts without explicit design.
