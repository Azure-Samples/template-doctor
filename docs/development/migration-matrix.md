# Frontend Legacy -> TypeScript Migration Matrix

_Last updated: 2025-09-07_

Legend:
- **Status**: Legacy (not started), Partial (some functionality ported), Migrated (feature parity in TS), Obsolete (safe to remove), Deprecated (superseded; pending deletion).
- **TS Replacement Exists?**: Direct module or collection of modules covering functionality.
- **Action**: Next concrete step.

| Legacy Script | Status | TS Replacement Exists? | Replacement Module(s) | Notes / Action |
| ------------- | ------ | ---------------------- | --------------------- | --------------- |
| `debug-console.js` | Legacy | No | – | Dev-only helper; low priority. Decide to port or drop after core flows. |
| `notification-system.js` | Deprecated (Superseded) | Yes | `modules/notifications.ts` (+ `modules/notifications-ready.ts`) | Legacy TS port `notification-system.ts` slated for deletion; rich system now canonical. |
| `notifications.js` | Migrated (Accessibility patched) | Yes | `modules/notifications.ts` | Canonical rich system (flushes guard queue + readiness helper). |
| `notifications-compat.js` | Removed | N/A | – | Functionality folded into readiness helper + rich system methods. |
| `notifications-init.js` | Removed | N/A | – | Redundant; readiness handled centrally. |
| `api-routes.js` | Migrated | Yes | `scripts/api-routes.ts` | HTML script tag removed; file queued for deletion cleanup batch. |
| `auth.js` | Migrated | Yes | `scripts/auth.ts` | HTML script tag removed; file queued for deletion cleanup batch. |
| `github-client.js` / `github-client-new.js` | Obsolete (Removed) | Yes | `scripts/github-client.ts` | Deleted legacy files in repo. |
| `analyzer.js` | Migrated | Yes | `scripts/analyzer.ts` | Remove legacy. |
| `report-loader.js` | Migrated | Yes | `scripts/report-loader.ts` | Remove legacy. |
| `dashboard-renderer.js` | Migrated | Yes | `scripts/dashboard-renderer.ts` | Remove legacy. |
| `config-loader.js` | Migrated | Yes | `scripts/config-loader.ts` | Remove after verify no inline HTML script tag references. |
| `runtime-config.js` | Migrated | Yes | `scripts/runtime-config.ts` | Remove; ensure `TemplateDoctorConfig` still globally exposed via build. |
| `templates-data-loader.js` | Migrated | Yes | `scripts/templates-data-loader.ts`, `scripts/template-list.ts` | Loader fully migrated; TS module loads `results/index-data.js`, dispatches event, adds diagnostic API. Legacy script tag removed. |
| `tooltips.js` | Migrated (Removed) | Yes | `modules/tooltips.ts` | Legacy file deleted after port. |
| `github-issue-handler.js` | Obsolete (Removed) | Yes | `scripts/issue-service.ts`, `scripts/api-client.ts` | Removed stub; TS service exposes `window.createGitHubIssue`. |
| `github-workflow-validation.js` | Migrated (Phase 2) | Yes | `modules/validation.ts` | Unified module w/ diagnostics grouping, collapsible sections, resume, timeout continue, counts, accessibility, tests. |
| `ruleset-modal.js` | Migrated | Yes | `modules/ruleset-modal.ts` | Legacy file deleted; global `showRulesetModal` preserved. |
| `ruleset-docs/analyzer.js` | Legacy | No | – | Niche; evaluate actual usage (maybe remove or rewrite as docs enhancement). |
| `azd-provision.js` | Migrated | Yes | `scripts/azd-provision.ts` | TS module provides validation trigger + polling + cancel; legacy globals preserved. |
| `template-validation.js` | Migrated (Phase 2) | Yes | `modules/validation.ts` | Simple + workflow unified; success/failure/cancel/timeout/a11y tests added; counts + collapsible detail sections. |
| `enable-demo-mode.js` / `demo-helper.js` | Obsolete (Removed) | N/A | – | Demo mode retired; remove scripts + references. |
| `saml-auto-fork.js` | Removed (Integrated) | Yes | `scripts/api-client.ts` (fork SAML handling) | Empty legacy file scheduled for deletion; SAML fork notices + authorization handled centrally. |
| `github-action-hook.js` | Migrated | Yes | `scripts/github-action-hook.ts` | TS module provides `submitAnalysisToGitHub`; remove legacy file & script tag. |
| `action-buttons-direct.js` / `action-buttons-fallback.js` | Removed (Superseded) | Yes | `scripts/dashboard-renderer.ts` | Legacy scripts no longer loaded; TS renderer guarantees button creation & visibility. Delete files in cleanup batch. |
| `test-fork-workflow.js` | Legacy | Obsolete | Playwright specs | Delete; replaced by fork E2E tests. |
| `app.js` | Mixed | Yes (distributed) | Multiple (`api-client.ts`, `issue-service.ts`, `batch-scan.ts`, etc.) | Progressive extraction approach: split remaining monolith concerns into focused modules. Track subtasks. |

### In-Progress Extraction Notes
- Batch Scan: Legacy IndexedDB + per-item card logic scaffolded into `scripts/batch-scan-legacy.ts` (phase 1). Next: migrate resume/retry UI fully and remove overlapping block from `app.js`.
- Notifications: Consolidated. Remaining follow-up: remove `modules/notification-system.ts` once tests + search confirm no direct imports outside rich system.

## Extraction Roadmap (Proposed Next Steps)
1. Low-Hanging Ports: `tooltips.js`, `ruleset-modal.js`.
2. High-Value Functional: `github-issue-handler.js` (user-facing issue creation UI) -> integrate with `issue-service.ts` & surface child issue results.
3. Validation Stack: Combine `github-workflow-validation.js` + `template-validation.js` into `validation.ts` with backend integration if available.
4. Monolith Decomposition: Incrementally peel `app.js` (batch scan polling -> `batch-scan.ts`, notification wiring -> already done, search handling -> `search.ts`).
5. Cleanup & Deletions: Remove fully migrated notification + loader scripts (clients & tooltips already removed). Run `scripts/legacy-script-audit.sh` before PR.
6. Obsolescence Audit: Confirm usage of provisioning, demo, action buttons, ruleset docs; decide remove or redesign.

## Tracking Labels (Suggested)
- `migration:ready-delete` – Legacy file has 1:1 TS replacement and can be removed.
- `migration:partial` – Still has logic not yet ported.
- `migration:needs-audit` – Unsure if used; requires usage search.
- `migration:decompose` – Large file being split gradually (`app.js`).

## Open Questions
- Are there still inline `<script>` tags in HTML referencing any soon-to-delete legacy files? (Perform grep before deletion.)
- Does batch scan logic need further backend delegation for status transitions? (Review `batch-scan.ts` vs `app.js` residual code.)
- Can SAML fork notification now allow deletion of `saml-auto-fork.js` entirely? (Likely yes.)

---
Generated automatically; update this file as migrations land.
