# Template Doctor API v4 (TypeScript)

Migration of Azure Functions (model v4) in TypeScript. Incrementally porting handlers from `packages/api` (JS) to use the v4 programming model with TypeScript.

## Structure
- `src/functions/analyze-template.ts` - HTTP POST function for analyzing GitHub repository templates
- `src/functions/github-oauth-token.ts` - Handles GitHub OAuth token acquisition
- `src/functions/runtime-config.ts` - Provides runtime configuration for the client
- `src/functions/archive-collection.ts` - Archives template collections
- `src/functions/submit-analysis-dispatch.ts` - Submits analysis for GitHub workflow dispatch
- `src/functions/validation-template.ts` - Validates a template by dispatching GitHub workflow
- `src/functions/validation-callback.ts` - Handles callbacks from validation workflows
- `src/functions/validation-status.ts` - Checks validation status of GitHub workflow
- `src/functions/validation-cancel.ts` - Cancels validation processes
- `src/functions/add-template-pr.ts` - Processes template pull requests

## Scripts
- `npm run build` - Build the TypeScript code
- `npm run start` - Start the Azure Functions runtime
- `npm run start:watch` - Start with TypeScript watch mode
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:ui` - Run tests with UI
- `npm run test:coverage` - Run tests with coverage reporting

## Migration Notes

This package represents the migration from Azure Functions v3 (Node.js with function.json) to Azure Functions v4 (TypeScript with programmatic registration).

Key changes:
- Functions are now defined using the `app.http()` method instead of function.json
- TypeScript support with proper types
- ESM module format
- Dynamic imports for the analyzer-core package
- Native Fetch API instead of node-fetch
- Routes now include the prefix `api/v4/` to distinguish from v3 endpoints

## API Endpoints

All endpoints are prefixed with `api/v4/` to distinguish from the v3 API:

- `POST api/v4/analyze-template` - Analyze GitHub repository template
- `POST api/v4/github-oauth-token` - Exchange OAuth code for GitHub token
- `GET api/v4/runtime-config` - Get runtime configuration
- `GET api/v4/archive-collection` - Archive template collections
- `POST api/v4/submit-analysis-dispatch` - Submit analysis for GitHub workflow dispatch
- `POST api/v4/validation-template` - Validate a template by dispatching GitHub workflow
- `POST api/v4/validation-callback` - Handle callbacks from validation workflows
- `GET api/v4/validation-status` - Check validation status of GitHub workflow
- `POST api/v4/validation-cancel` - Cancel validation processes
- `POST api/v4/add-template-pr` - Process template pull requests

## Environment Variables

Required environment variables:
- `GITHUB_TOKEN_ANALYZER` or `GH_WORKFLOW_TOKEN`: GitHub token for API access
- `DEPRECATED_MODELS`: Comma-separated list of deprecated models (optional)
- `GITHUB_REPO_OWNER`: Owner of the GitHub repository for workflow dispatch
- `GITHUB_REPO_NAME`: Name of the GitHub repository for workflow dispatch
- `GITHUB_REPO_BRANCH`: Branch of the GitHub repository (default: 'main')
- `GITHUB_WORKFLOW_FILE`: Workflow file name (default: 'validation-template.yml')
- `ALLOW_REPO_OVERRIDE`: Set to '1' to allow overriding repo settings (optional)

## Local Development

1. Clone the repository
2. Run `npm install` to install dependencies
3. Create a `local.settings.json` file with the required environment variables
4. Run `npm run build` to build the TypeScript code
5. Run `npm run start` to start the Azure Functions runtime

## Testing

Each function should be tested individually using:
1. Unit tests for the handler logic
2. Integration tests against the deployed function
3. Manual testing using the Azure Functions local runtime

## Deployment

Deploy using Azure Functions CLI or Azure DevOps pipeline:

```bash
# Build the functions
npm run build

# Deploy to Azure
func azure functionapp publish <app-name>
```
