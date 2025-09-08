# Azure Functions → Express Migration Matrix

| Function File | Route | Method(s) | Purpose | External Deps | Complexity | Migrated | Tests Written | Tests Passing |
|---------------|-------|-----------|---------|---------------|------------|----------|---------------|---------------|
| ping.ts | /v4/ping | GET | Health / liveness | None | Very Low | ✅ | ✅ | ✅ |
| runtime-config.ts | /v4/client-settings | GET | Client runtime config | Env only | Low | ✅ | ✅ | ✅ |
| github-oauth-token.ts | /v4/github-oauth-token | GET/POST | OAuth code exchange | GitHub OAuth | Medium | ✅ | ✅ | ✅ |
| analyze-template.ts | /v4/analyze-template | POST | Analyze repo contents | Octokit, analyzer-core | High | ✅ | ✅ | ✅ |
| issue-create.ts | /v4/issue-create | POST | Create issue + optional child issues | Octokit issues/labels | Medium | ✅ | ✅ | ✅ |
| batch-scan-start.ts | /v4/batch-scan-start | POST | Start in-memory batch simulation | In-memory store | Medium | ✅ | ✅ | ✅ |
| batch-scan-start.ts (status) | /v4/batch-scan-status | GET | Poll batch progress | In-memory store | Medium | ✅ | ✅ | ✅ |
| submit-analysis-dispatch.ts | /v4/submit-analysis-dispatch | POST | Repo dispatch event | GitHub dispatch | Low | ✅ | ✅ | ✅ |
| validation-template.ts | /v4/validation-template | POST | Trigger workflow_dispatch | Octokit actions | Medium | ✅ | ✅ | ✅ |
| validation-status.ts | /v4/validation-status | GET | Poll workflow + logs | Octokit actions/artifacts | High | ✅ | ✅ | ✅ |
| validation-cancel.ts | /v4/validation-cancel | POST | Cancel workflow run | Octokit actions | Medium | ✅ | ✅ | ✅ |
| validation-callback.ts | /v4/validation-callback | POST | Acknowledge + cookie | None | Low | ✅ | ✅ | ✅ |
| add-template-pr.ts | /v4/add-template-pr | POST | Create PR with template JSON | Octokit git/contents/pulls | Medium | ✅ | ✅ | ✅ |
| archive-collection.ts | /v4/archive-collection | POST | Branch + file + PR archive JSON | Raw GitHub REST | Medium | ✅ | ✅ | ✅ |
| repo-fork.ts | /v4/repo-fork | POST | Fork repo (SAML aware) | Octokit repos | Medium | ✅ | ✅ | ✅ |

Legend: ✅ migrated, ☐ pending

## Phases
1. Core / low risk (done): ping, runtime-config
2. Workflow start + callback: submit-analysis-dispatch, validation-template, validation-callback
3. Repo operations: repo-fork, issue-create
4. PR / archive ops: add-template-pr, archive-collection
5. Batch simulation: batch-scan-start/status (introduce store abstraction)
6. Workflow lifecycle heavy: validation-status, validation-cancel
7. Analyzer: analyze-template (final)

## Notes
- Dual mount at `/v4` and `/api/v4` for backward compatibility during transition.
- Maintain identical JSON shapes and status codes.
- Batch simulation remains memory-backed until persistent option chosen.
- High complexity endpoints gain shared service helpers under `services/` when migrated.
- Pending Optional Improvements (tracking list):
	- Error normalization utility (map GitHub & internal errors to consistent { error, code, details? }).
	- Rate limit header parsing (x-ratelimit-remaining/reset) surfaced in responses for observability (non-sensitive).
	- Logger injection / silencer for tests to suppress retry noise.
	- Exponential backoff variant for retry (current linear) + jitter.
	- GitHub error classifier (status → symbolic code e.g. rate_limit, not_found, validation_failed).
	- Shared response helper to reduce repetitive status/JSON patterns.
