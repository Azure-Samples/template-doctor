# Frontend Legacy -> TypeScript Migration Matrix

_Last updated: 2025-09-07_

Legend:
- **Status**: Legacy (not started), Partial (some functionality ported), Migrated (feature parity in TS), Obsolete (safe to remove), Deprecated (superseded; pending deletion).
- **TS Replacement Exists?**: Direct module or collection of modules covering functionality.
- **Action**: Next concrete step.

| Legacy Script | Status | TS Replacement Exists? | Replacement Module(s) | Notes / Action |
| ------------- | ------ | ---------------------- | --------------------- | --------------- |
| `debug-console.js` | Legacy | No | – | Dev-only helper; low priority. Decide to port or drop after core flows. |
| `notification-system.js` | Migrated | Yes | `modules/notification-system.ts` | Keep until load order validated everywhere, then delete legacy file. |
| `notifications.js` | Migrated (Accessibility patched) | Yes | `modules/notifications.ts` | Legacy kept for backward includes; remove after search confirms no direct script tag dependence. |
| `notifications-compat.js` | Migrated | Yes | `modules/notifications-compat.ts` | Safe to remove with above in one PR. |
| `notifications-init.js` | Migrated | Yes | `modules/notifications-init.ts` | Same removal batch as other notification files. |
| `api-routes.js` | Migrated | Yes | `scripts/api-routes.ts` | Remove legacy after confirming no dynamic import references. |
| `auth.js` | Migrated | Yes | `scripts/auth.ts` | Remove legacy. |
| `github-client.js` / `github-client-new.js` | Obsolete | Yes | `scripts/github-client.ts` | Delete both legacy variants. Already superseded. |
| `analyzer.js` | Migrated | Yes | `scripts/analyzer.ts` | Remove legacy. |
| `report-loader.js` | Migrated | Yes | `scripts/report-loader.ts` | Remove legacy. |
| `dashboard-renderer.js` | Migrated | Yes | `scripts/dashboard-renderer.ts` | Remove legacy. |
| `config-loader.js` | Migrated | Yes | `scripts/config-loader.ts` | Remove after verify no inline HTML script tag references. |
| `runtime-config.js` | Migrated | Yes | `scripts/runtime-config.ts` | Remove; ensure `TemplateDoctorConfig` still globally exposed via build. |
| `templates-data-loader.js` | Partial | Yes (core list logic) | `scripts/template-list.ts` | Audit for extra metadata/history injection not yet ported. Create follow-up ticket to replicate missing pieces. |
| `tooltips.js` | Legacy | No | – | Easy port: encapsulate delegation in `modules/tooltips.ts`. Good starter task. |
| `github-issue-handler.js` | Legacy | Partial (service primatives) | `scripts/issue-service.ts`, `scripts/api-client.ts` | Port UI orchestration: tie form events => issue-service. Need notifications + label creation result surfacing. |
| `github-workflow-validation.js` | Legacy | No | – | Build TS module for dispatch + polling + notifications; may share logic with validation endpoints if backend path exists. |
| `ruleset-modal.js` | Legacy | No | – | Self-contained; create `modules/ruleset-modal.ts`. Medium complexity (DOM + events). |
| `ruleset-docs/analyzer.js` | Legacy | No | – | Niche; evaluate actual usage (maybe remove or rewrite as docs enhancement). |
| `azd-provision.js` | Legacy | No | – | Determine active usage; if unused in UI flows, mark Obsolete. |
| `template-validation.js` | Legacy | No | – | Check overlap with `github-workflow-validation.js`; potentially merge when porting. |
| `enable-demo-mode.js` / `demo-helper.js` | Legacy | No | – | Optional; gate behind query param; port late or drop. |
| `saml-auto-fork.js` | Legacy | Partial (logic integrated) | `scripts/api-client.ts` (fork SAML handling) | Most behavior merged; delete after confirming no residual references. |
| `github-action-hook.js` | Legacy | No | – | Audit: handles backend dispatch events. If backend Functions fully replace, mark Obsolete. |
| `action-buttons-direct.js` / `action-buttons-fallback.js` | Legacy | No | – | Likely removable (UI polish). Validate presence in templates. |
| `test-fork-workflow.js` | Legacy | Obsolete | Playwright specs | Delete; replaced by fork E2E tests. |
| `app.js` | Mixed | Yes (distributed) | Multiple (`api-client.ts`, `issue-service.ts`, `batch-scan.ts`, etc.) | Progressive extraction approach: split remaining monolith concerns into focused modules. Track subtasks. |

## Extraction Roadmap (Proposed Next Steps)
1. Low-Hanging Ports: `tooltips.js`, `ruleset-modal.js`.
2. High-Value Functional: `github-issue-handler.js` (user-facing issue creation UI) -> integrate with `issue-service.ts` & surface child issue results.
3. Validation Stack: Combine `github-workflow-validation.js` + `template-validation.js` into `validation.ts` with backend integration if available.
4. Monolith Decomposition: Incrementally peel `app.js` (batch scan polling -> `batch-scan.ts`, notification wiring -> already done, search handling -> `search.ts`).
5. Cleanup & Deletions: Remove fully migrated notification + client + loader scripts in a single PR to reduce churn.
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
