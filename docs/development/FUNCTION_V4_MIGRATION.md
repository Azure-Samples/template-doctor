# Azure Functions v4 Migration for Template Doctor

This guide documents the process and decisions made during the migration from Azure Functions v3 to v4 using TypeScript and ESM modules.

## Major Changes

1. **Programming Model:**
   - Switched from function.json bindings to programmatic API (`app.http()`, etc.)
   - Removed function.json files entirely

2. **TypeScript Integration:**
   - Full TypeScript support with proper type definitions
   - TypeScript configuration for both API and analyzer-core packages

3. **Module System:**
   - Changed from CommonJS to ESM modules
   - Using dynamic imports for internal packages
   - Proper import/export paths with `.js` extensions

4. **Package Structure:**
   - Created dedicated analyzer-core package
   - Defined clear interfaces between packages

## Function Migration Status

| Function | Status | Notes |
|----------|--------|-------|
| analyze-template | ✅ Complete | Fully migrated to TypeScript with v4 model |
| github-oauth-token | ✅ Complete | Migrated with built-in Fetch API |
| runtime-config | ✅ Complete | Migrated as client-settings endpoint |
| archive-collection | ✅ Complete | Migrated with GitHub API interaction |
| submit-analysis-dispatch | ✅ Complete | Migrated with workflow dispatch support |
| validate-template | ⬜ Pending | |
| validation-callback | ⬜ Pending | |
| validation-cancel | ⬜ Pending | |
| validation-status | ⬜ Pending | |
| validation-template | ⬜ Pending | |
| add-template-pr | ⬜ Pending | |

## Technical Decisions

1. **ESM Only:**
   - Decided to use ESM exclusively instead of supporting both ESM and CommonJS
   - Required adding `.js` extensions to import paths

2. **Dynamic Imports:**
   - Using dynamic imports for analyzer-core to allow for proper error handling
   - This approach avoids build-time dependencies

3. **Source Imports:**
   - Direct imports from source files rather than compiled dist
   - Simplifies development workflow

## Testing

Each function requires testing to ensure compatibility with the original implementation:

1. Unit tests for handler logic
2. Integration tests for the full function
3. Manual testing using the local development server

## Next Steps

1. Migrate remaining functions from the original JavaScript implementation
2. Add comprehensive tests for all functions
3. Implement CI/CD pipeline for deployment
4. Document the new API thoroughly