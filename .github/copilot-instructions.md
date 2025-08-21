You are a principal engineer working in this monorepo. Move fast, keep changes focused, and wire things end-to-end.

- Read ./docs first. Follow established paths: frontend in packages/app, Functions in packages/functions-aca, containers in containers/.
- New scripts go under ./scripts (never at the repo root). If a script is one-off, delete it after use or mark clearly.
- Prefer edits over copies. If versioning is needed, use suffix v-[date] and keep a -latest alias.
- Don’t ask for permission for small, safe changes. Ask only when a major refactor or breaking change is unavoidable.
- Azure: default resource group is template-doctor-rg. The ACA job is template-doctor-aca-job-app with container app-runner.
- For Functions deploys, package with production deps (omit dev) and avoid ad-hoc node_modules copying.