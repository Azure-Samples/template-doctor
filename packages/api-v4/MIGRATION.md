# Migration Plan for Azure Functions v4 (Template Doctor)

This document outlines the plan for migrating the Template Doctor API from Azure Functions v3 (Node.js with function.json bindings) to Azure Functions v4 (TypeScript with programmatic registration).

## Migration Strategy

We'll follow an incremental approach:

1. Create the basic structure for the v4 API
2. Implement the analyzer-core package
3. Port each function one by one
4. Add tests for each function
5. Document the new API

## Functions to Migrate

Based on the original API, we need to migrate the following functions:

1. ✅ analyze-template - Analyzes a GitHub repository template
2. ✅ github-oauth-token - Handles GitHub OAuth token acquisition
3. ✅ runtime-config - Provides runtime configuration
4. ✅ archive-collection - Archives template collections
5. ✅ submit-analysis-dispatch - Submits analysis for dispatch
6. ✅ validation-template - Validates a template
7. ✅ validation-callback - Handles validation callbacks
8. ✅ validation-cancel - Cancels validation processes
9. ✅ validation-status - Checks validation status
10. ✅ add-template-pr - Processes template pull requests

## Technical Changes

Key differences in the v4 model:

1. Function Registration:
   - V3: Used function.json for binding configuration
   - V4: Uses `app.http()`, `app.timer()`, etc. for programmatic registration

2. Module System:
   - V3: CommonJS
   - V4: ESM (ECMAScript Modules)

3. Language:
   - V3: JavaScript
   - V4: TypeScript with type definitions

4. Dependencies:
   - Using dynamic imports for analyzer-core and other internal packages
   - Proper TypeScript types for request/response objects
   - Using native Fetch API instead of node-fetch

5. Routing:
   - All endpoints now include the prefix `api/v4/` to distinguish from v3 endpoints
   - Function names and route parameters are preserved

## Testing Strategy

For each migrated function:
1. Unit tests for the handler logic
2. Integration tests for the full function
3. Manual testing using the local development server

## Deployment Considerations

1. During migration, both v3 and v4 APIs can coexist
2. Final cutover will require updating any dependent services
3. CI/CD pipeline updates needed for TypeScript build process

## Migration Progress

All functions have been successfully migrated to Azure Functions v4 with TypeScript and ESM modules. Each function now uses the programmatic registration pattern with `app.http()` and includes the `api/v4/` prefix in its route.

## Next Steps

1. Build and test the migrated functions
2. Update client applications to use the new API endpoints
3. Deploy the new API in parallel with the existing v3 API
4. Monitor for issues and gradually shift traffic to the new API
5. Once stable, deprecate and eventually remove the v3 API