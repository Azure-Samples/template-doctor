# Template Doctor – Architecture Overview

## Containerized Express Architecture

Template Doctor has migrated from Azure Functions to a containerized Express server architecture. The application now runs as Docker containers, providing better local development experience, easier deployment, and more flexibility in hosting options.

### Components

- **Express Backend** (`packages/server`): TypeScript-based REST API running on port 3001
- **Static Frontend** (`packages/app`): Vite-built SPA running on port 3000 (preview) or 4000 (dev)
- **Docker**: Multi-container (docker-compose) and single-container (Dockerfile.combined) deployment options
- **Legacy Azure Functions**: Preserved in `dev/api-legacy-azure-functions` branch for historical reference

## OAuth 2.0 Authentication Flow

Template Doctor uses OAuth 2.0 with GitHub for API authentication. The frontend handles the OAuth flow automatically, and all protected endpoints validate GitHub tokens on every request.

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend (Vite SPA)
    participant LS as localStorage
    participant EX as Express Backend (Auth Middleware)
    participant GH as GitHub API

    U->>FE: Click Login
    FE->>GH: Redirect to GitHub OAuth
    GH->>U: Authorization prompt
    U->>GH: Approve
    GH->>FE: Redirect with authorization code
    FE->>EX: POST /api/v4/github-oauth-token (code)
    EX->>GH: Exchange code for access token
    GH-->>EX: Return access_token
    EX-->>FE: Return access_token
    FE->>LS: Store token as 'gh_access_token'

    Note over FE,EX: All subsequent API requests include Authorization header

    U->>FE: Trigger protected operation (e.g., analyze template)
    FE->>EX: POST /api/v4/analyze-template + Bearer token

    EX->>EX: Auth Middleware: Extract token from header
    EX->>GH: Validate token (GET /user)
    GH-->>EX: Return user info (login, id, name, email, avatar)
    EX->>EX: Attach user to req.user
    EX->>EX: Execute route handler with authenticated user
    EX-->>FE: Return result

    alt Token Invalid/Expired
        EX-->>FE: 401 Unauthorized
        FE->>LS: Clear stored token
        FE-->>U: Show login prompt
    end

    alt Admin Endpoint
        EX->>EX: requireAdmin: Check ADMIN_GITHUB_USERS
        alt User is Admin
            EX-->>FE: Return result
        else User is not Admin
            EX-->>FE: 403 Forbidden
        end
    end
```

**Endpoint Protection:**

- **Public Endpoints**: No authentication required
  - `/api/health` - Health check
  - `/api/v4/client-settings` - Runtime configuration
  - `/api/v4/github-oauth-token` - OAuth token exchange

- **Protected Endpoints**: Require valid GitHub token
  - `/api/v4/analyze-template` - Template analysis
  - `/api/v4/validate-template` - Trigger validation
  - `/api/v4/validation-*` - All validation endpoints
  - `/api/v4/issue-create` - Create GitHub issue
  - `/api/v4/action-*` - GitHub Actions endpoints
  - `/api/v4/batch-scan-start` - Batch analysis

- **Admin Endpoints**: Require authentication + admin privileges
  - `/api/admin/*` - Admin configuration and debugging
  - `/api/v4/admin/*` - Admin settings management

**Authentication Middleware:**

The Express backend uses three middleware functions:

1. `requireAuth` - Validates token, attaches user to request, or returns 401
2. `optionalAuth` - Validates token if present, never returns 401
3. `requireAdmin` - Checks user is in ADMIN_GITHUB_USERS list, or returns 403

See [OAuth API Authentication](./OAUTH_API_AUTHENTICATION.md) for detailed documentation.

---

## Template Validation Flow

This diagram shows how the frontend, Express backend, and GitHub workflow interact during the template validation flow, with client-side storage of GitHub run IDs.

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend (Vite SPA)
    participant LS as localStorage
    participant EX as Express Backend
    participant GH as GitHub Workflow
    participant GHA as GitHub API

    Note over FE,EX: User must be authenticated (see OAuth flow above)

    U->>FE: Trigger template validation
    FE->>EX: POST /api/v4/validate-template + Bearer token (templateName)
    EX->>EX: Auth Middleware: Validate token
    EX->>EX: Generate UUID (runId)
    EX->>EX: Store in run-id-store (initially with null GitHub info)
    EX->>GHA: Trigger workflow dispatch to validation-template.yml with runId
    EX-->>FE: Return runId

    GH->>GH: Execute validation workflow
    GH->>GH: Parse repo URL and matrix strategy
    GH->>GH: Clone and validate template with microsoft/template-validation-action
    GH-->>EX: POST /api/v4/validation-callback (runId, githubRunId, githubRunUrl)
    EX->>EX: Update run-id-store with GitHub info

    loop Until validation complete
        FE->>LS: Check for stored GitHub run ID
        LS-->>FE: Return stored run ID (if available)
        FE->>EX: GET /api/v4/validation-status?runId={runId}&githubRunId={id} + Bearer token
        EX->>EX: Auth Middleware: Validate token
        EX->>EX: Use client-provided GitHub run ID or fallback to store
        EX->>GHA: Query workflow status (githubRunId)
        GHA-->>EX: Return workflow status and results
        EX-->>FE: Return status, conclusion, and results (with githubRunId)
        FE->>LS: Store GitHub run ID for future requests
    end

    FE-->>U: Display validation results
```

Notes:

- The in-memory run-id-store maps internal UUIDs to GitHub workflow run IDs and URLs
- The frontend stores GitHub run IDs in localStorage to maintain mapping across browser sessions
- When polling for status, the frontend includes the stored GitHub run ID in the request
- This provides resilience against Function App restarts, which would otherwise lose the in-memory mapping
- The status endpoint queries the GitHub API with either the client-provided run ID or falls back to in-memory store
- The validation workflow includes additional steps like location determination, repository cloning, and running the microsoft/template-validation-action

---

## Generic Workflow Execution System

**NEW**: Template Doctor now supports a unified workflow execution system that allows triggering any GitHub Actions workflow without creating new endpoints. This system replaces the pattern of creating workflow-specific endpoints (like `/validate-template`, `/docker-scan`, etc.) with a single generic execution framework.

### Architecture Overview

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[User Interface]
        WC[Workflow Component]
    end

    subgraph "Backend Layer"
        API[Generic Workflow API]
        WS[Workflow Service]
        PR[Parser Registry]
        CL[Config Loader]
    end

    subgraph "Storage Layer"
        DB[(MongoDB - workflow_configs)]
    end

    subgraph "GitHub"
        GHA[GitHub Actions]
        WF1[validation-template.yml]
        WF2[validation-docker-image.yml]
        WF3[validation-ossf.yml]
        WFN[custom-workflow.yml]
    end

    UI -->|1. Select workflow| WC
    WC -->|2. POST /workflow-execute| API
    API -->|3. Load config| CL
    CL -->|4. Query| DB
    DB -->|5. Return config| CL
    API -->|6. Trigger| WS
    WS -->|7. Dispatch| GHA
    GHA -->|8. Execute| WF1
    GHA -->|8. Execute| WF2
    GHA -->|8. Execute| WF3
    GHA -->|8. Execute| WFN
    
    WC -->|9. Poll| API
    API -->|10. Status| WS
    WS -->|11. Query| GHA
    GHA -->|12. Status + logs + artifacts| WS
    WS -->|13. Download artifact| GHA
    WS -->|14. Parse| PR
    PR -->|15. Parsed result| API
    API -->|16. Result + template| WC
    WC -->|17. Render| UI

    class API,WS,PR,CL highlight
    class DB highlight
    classDef highlight fill:#f9f,stroke:#333,stroke-width:2px
```

### Generic Workflow Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant API as Generic Workflow API
    participant WS as Workflow Service
    participant PR as Parser Registry
    participant DB as MongoDB
    participant GH as GitHub Actions

    Note over FE,API: All requests require OAuth authentication

    U->>FE: Select workflow (e.g., "azd-validation")
    FE->>API: POST /api/v4/workflow-execute + Bearer token
    Note right of FE: { workflowId: "azd-validation",<br/>inputs: { templateUrl: "..." } }
    
    API->>API: Auth Middleware: Validate token
    API->>DB: Load workflow configuration
    DB-->>API: Return config (workflowFile, parser, timeout, etc.)
    
    API->>WS: triggerWorkflow(config, inputs)
    WS->>GH: POST /repos/.../actions/workflows/{file}/dispatches
    Note right of WS: workflow_dispatch with run_id input
    GH-->>WS: 204 No Content
    WS->>WS: Wait 2s for workflow to start
    WS->>GH: GET /repos/.../actions/runs?event=workflow_dispatch
    GH-->>WS: Return workflow runs (extract run ID)
    WS-->>API: Return workflowRunId
    API-->>FE: Return { workflowRunId, status: "queued" }

    loop Poll until complete
        FE->>API: GET /api/v4/workflow-status?workflowRunId={id}&workflowId={id} + Bearer token
        API->>API: Auth Middleware: Validate token
        API->>DB: Load workflow config
        DB-->>API: Return config
        API->>WS: getWorkflowStatus(runId, config)
        
        WS->>GH: GET /repos/.../actions/runs/{runId}
        GH-->>WS: Return status, conclusion
        
        alt streamLogs is true
            WS->>GH: GET /repos/.../actions/runs/{runId}/jobs
            GH-->>WS: Return jobs list
            loop For each job
                WS->>GH: GET /repos/.../actions/jobs/{jobId}/logs
                GH-->>WS: Return logs
            end
        end
        
        alt Workflow completed
            WS->>GH: GET /repos/.../actions/runs/{runId}/artifacts
            GH-->>WS: Return artifacts list
            WS->>GH: GET /repos/.../actions/artifacts/{artifactId}/{archive_format}
            GH-->>WS: Return artifact ZIP
            WS->>WS: Detect ZIP (magic bytes 0x50 0x4B)
            WS->>WS: Extract first file from ZIP
            WS->>PR: parseArtifact(content, config)
            PR->>PR: Select parser (config.customParser or auto-detect)
            PR-->>WS: Return parsed result
        end
        
        WS-->>API: Return { status, conclusion, jobs, logs, result }
        API-->>FE: Return complete status
    end

    FE->>FE: Load result template (config.resultTemplate)
    FE-->>U: Render results with workflow-specific template
```

### Key Components

1. **Workflow Configuration** (`workflow_configs` MongoDB collection):
   - Stores workflow metadata: `id`, `name`, `workflowFile`, `artifactCompressed`, `streamLogs`, `customParser`, `resultTemplate`, `defaultInputs`, `timeout`
   - Loaded on server startup via `initializeWorkflowConfigs()`
   - Configurable via `/api/v4/setup` endpoint (admin only)

2. **Workflow Service** (`packages/server/src/services/workflow-service.ts`):
   - `triggerWorkflow()`: Dispatches GitHub workflow with run_id input
   - `getWorkflowStatus()`: Fetches status + jobs + logs + artifacts
   - `cancelWorkflow()`: Cancels running workflow
   - `downloadArtifact()`: Auto-detects ZIP, extracts, returns content
   - `fetchJobLogs()`: Streams logs from all jobs

3. **Parser Registry** (`packages/server/src/services/workflow-parser-registry.ts`):
   - Built-in parsers: `markdown`, `log`, `json`, `azd-validation`
   - Custom parser registration via `registerParser(name, parserFn)`
   - Auto-detection based on content type

4. **Generic API Endpoints** (`packages/server/src/routes/generic-workflow.ts`):
   - `GET /api/v4/workflows` - List all workflow configurations
   - `POST /api/v4/workflow-execute` - Trigger workflow (requires auth)
   - `GET /api/v4/workflow-status` - Poll status with logs/results (requires auth)
   - `POST /api/v4/workflow-cancel` - Cancel workflow (requires auth)

### Default Workflows

The system includes three pre-configured workflows:

| Workflow ID         | GitHub Actions File          | Timeout | Stream Logs | Parser         |
|---------------------|------------------------------|---------|-------------|----------------|
| azd-validation      | validation-template.yml      | 10 min  | Yes         | azd-validation |
| docker-image-scan   | validation-docker-image.yml  | 5 min   | No          | markdown       |
| ossf-scorecard      | validation-ossf.yml          | 5 min   | No          | json           |

### Adding New Workflows

**CRITICAL**: Do NOT create new specific endpoints for workflows. Use the generic system:

1. Create GitHub Actions workflow file (`.github/workflows/my-workflow.yml`)
   - Must support `workflow_dispatch` trigger
   - Must accept `run_id` input parameter
   - Should upload artifacts with results

2. Configure workflow in MongoDB via `/api/v4/setup` (admin) or programmatically:
   ```javascript
   {
     id: "my-workflow",
     name: "My Workflow",
     workflowFile: "my-workflow.yml",
     artifactCompressed: true,
     streamLogs: true,
     customParser: "markdown",
     defaultInputs: { param: "value" },
     timeout: 300000
   }
   ```

3. Use generic endpoints from frontend:
   ```javascript
   // Trigger
   const { workflowRunId } = await fetch('/api/v4/workflow-execute', {
     method: 'POST',
     headers: { 'Authorization': `Bearer ${token}` },
     body: JSON.stringify({ workflowId: 'my-workflow', inputs: { ... } })
   });

   // Poll status
   const status = await fetch(`/api/v4/workflow-status?workflowRunId=${runId}&workflowId=my-workflow`, {
     headers: { 'Authorization': `Bearer ${token}` }
   });
   ```

4. (Optional) Register custom parser if needed:
   ```typescript
   import { registerParser } from './services/workflow-parser-registry';
   registerParser('my-parser', (content, config) => {
     // Parse logic
     return parsedResult;
   });
   ```

### Benefits

- ✅ **No Code Changes**: Add workflows via configuration, not code
- ✅ **Unified API**: Single set of endpoints for all workflows
- ✅ **Automatic Features**: ZIP extraction, log streaming, parsing
- ✅ **Extensible**: Custom parsers for any artifact format
- ✅ **Consistent Auth**: All workflows use OAuth authentication
- ✅ **Result Templates**: Workflow-specific rendering

### Documentation

- **System Architecture**: [GENERIC_WORKFLOW_SYSTEM.md](./GENERIC_WORKFLOW_SYSTEM.md)
- **User Guide**: [NEW_WORKFLOW_GUIDE.md](./NEW_WORKFLOW_GUIDE.md)
- **AI Agent Guidance**: [AGENTS.md](../../AGENTS.md#adding-new-workflows-critical-guidance-for-agents)

---

## Submit Analysis Workflow

This diagram shows how the Template Doctor processes and submits analysis results to be stored in the repository.

```mermaid
sequenceDiagram
    participant EC as External Client
    participant GHD as GitHub Dispatch
    participant SAW as submit-analysis.yml
    participant TDA as Template Doctor Action
    participant GH as GitHub API
    participant ARC as Archive Collection (Optional)

    EC->>GHD: Trigger template-analysis-completed
    GHD->>SAW: Execute submit-analysis workflow

    SAW->>SAW: Checkout repository & setup Node.js
    SAW->>TDA: Process analysis result with action
    Note right of TDA: Uses repository action.yml
    TDA->>TDA: Generate dashboard & data files
    TDA-->>SAW: Return template data (JSON)

    SAW->>GH: Create Pull Request with analysis results
    GH-->>SAW: Return PR details

    alt If archiveEnabled is true
        SAW->>ARC: POST to archive-collection API
        ARC-->>SAW: Return archive status
    end
```

Notes:

- The submit-analysis workflow is triggered by a repository_dispatch event of type "template-analysis-completed"
- The workflow uses the Template Doctor action (action.yml in the repository root) to process analysis results
- The action generates dashboard HTML and data JS files for the analyzed template
- A pull request is created to add these files to the repository
- Optionally, results can be archived to a central collection if configured

## GitHub issue creation flow

This diagram shows how the frontend uses the Express OAuth endpoint to exchange the code for a token and then opens a GitHub issue, applying labels and assigning it to Copilot. **Note: Issue creation now requires authentication.**

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend (Vite SPA)
    participant LS as localStorage
    participant EX as Express Backend
    participant GH as GitHub API

    Note over FE,LS: User must be authenticated (token in localStorage)

    U->>FE: Click Open Issue
    FE->>LS: Retrieve stored GitHub token
    FE->>EX: POST /api/v4/issue-create + Bearer token (title, body, labels)
    EX->>EX: Auth Middleware: Validate token
    EX->>GH: POST /repos/:owner/:repo/issues (title, body, labels, assignees: copilot)
    GH-->>EX: 201 Created (issue number and url)
    EX-->>FE: Return issue details
    opt Add more labels
        FE->>GH: POST /repos/:owner/:repo/issues/:number/labels (labels)
        GH-->>FE: 200 OK
    end
    FE-->>U: Show issue link and assigned to Copilot
```

## Overall System Architecture

The following diagram illustrates the high-level containerized system architecture of Template Doctor:

```mermaid
graph TB
    User((User))

    subgraph "Frontend Container (Vite SPA)"
        UI[Web UI]
        ResultsViewer[Results Viewer]
        BatchManager[Batch Manager]
        NotificationSystem[Notification System]
    end

    subgraph "Express Backend Container"
        AnalyzeAPI[/api/v4/analyze]
        ConfigAPI[/api/v4/client-settings]
        AuthAPI[/api/v4/github-oauth-token]
        ValidateAPI[/api/v4/validate-template]
        StatusAPI[/api/v4/validation-status]
        CallbackAPI[/api/v4/validation-callback]
        ArchiveAPI[/api/v4/archive-collection]
    end

    subgraph "Docker Deployment"
        DockerCompose[docker-compose.yml]
        SingleContainer[Dockerfile.combined]
    end

    subgraph "GitHub Workflows"
        ValidationWorkflow[validation-template.yml]
        SubmitAnalysis[submit-analysis.yml]
    end

    subgraph "Storage"
        localStorage[(localStorage)]
        ResultsRepo[(GitHub Pages Results)]
    end

    User --> UI
    UI --> BatchManager
    UI --> NotificationSystem
    UI --> ResultsViewer

    BatchManager --> AnalyzeAPI
    UI --> ValidateAPI
    UI --> StatusAPI
    UI --> AuthAPI
    UI --> ConfigAPI

    AnalyzeAPI --> GitHub
    ValidateAPI --> ValidationWorkflow
    ValidationWorkflow --> CallbackAPI
    CallbackAPI --> StatusAPI

    ValidationWorkflow --> SubmitAnalysis
    SubmitAnalysis --> ResultsRepo
    SubmitAnalysis --> ArchiveAPI

    StatusAPI --> localStorage
    localStorage --> StatusAPI

    ResultsRepo --> ResultsViewer

    AuthAPI --> GitHub

    DockerCompose -.-> UI
    DockerCompose -.-> AnalyzeAPI
    SingleContainer -.-> UI
    SingleContainer -.-> AnalyzeAPI

    class UI,BatchManager,ResultsViewer,NotificationSystem highlight
    class AnalyzeAPI,ConfigAPI,AuthAPI,ValidateAPI,StatusAPI,CallbackAPI,ArchiveAPI highlight
    class ValidationWorkflow,SubmitAnalysis highlight

    classDef highlight fill:#f9f,stroke:#333,stroke-width:2px
```

## Deployment Options

### Local Development

**Two-Terminal Approach (Recommended):**

Terminal 1 - Express Backend:

```bash
cd packages/server
npm run dev  # Runs on port 3001
```

Terminal 2 - Vite Frontend:

```bash
cd packages/app
npm run dev  # Runs on port 4000
```

**Production Preview:**

```bash
cd packages/app
npm run preview  # Runs on port 3000
```

### Docker Deployment

**Multi-Container (Development):**

```bash
docker-compose up
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001

**Single Container (Production):**

```bash
docker build -f Dockerfile.combined -t template-doctor .
docker run -p 80:80 template-doctor
```

- All services: http://localhost

### Port Allocation

| Service                  | Development | Preview | Docker (Multi) | Docker (Single) |
| ------------------------ | ----------- | ------- | -------------- | --------------- |
| Vite Dev Server          | 4000        | -       | -              | -               |
| Vite Preview             | -           | 3000    | 3000           | -               |
| Express Backend          | 3001        | 3001    | 3001           | -               |
| Nginx (Combined)         | -           | -       | -              | 80              |
| Azure Functions (Legacy) | 7071        | 7071    | -              | -               |

## Migration Status

### Completed Migrations

✅ **Core API Endpoints:**

- `/api/v4/analyze` - Template analysis with fork-first SAML strategy
- `/api/v4/github-oauth-token` - OAuth token exchange
- `/api/v4/client-settings` - Runtime configuration

✅ **Infrastructure:**

- Docker Compose configuration for multi-container deployment
- Combined Dockerfile for single-container production deployment
- Environment variable consolidation
- CORS and security configuration

### Pending Migrations (17 Functions)

The following Azure Functions remain to be migrated to Express endpoints:

**Validation Workflow:**

- `validate-template` → `/api/v4/validate-template`
- `validation-status` → `/api/v4/validation-status`
- `validation-callback` → `/api/v4/validation-callback`
- `validation-cancel` → `/api/v4/validation-cancel`
- `validation-docker-image` → `/api/v4/validation-docker-image`
- `validation-ossf` → `/api/v4/validation-ossf`

**GitHub Actions:**

- `action-trigger` → `/api/v4/action-trigger`
- `action-run-status` → `/api/v4/action-run-status`
- `action-run-artifacts` → `/api/v4/action-run-artifacts`

**Analysis & Submission:**

- `submit-analysis-dispatch` → `/api/v4/submit-analysis-dispatch`
- `add-template-pr` → `/api/v4/add-template-pr`
- `archive-collection` → `/api/v4/archive-collection` ✅ (migrated)

**Repository Management:**

- `repo-fork` → `/api/v4/repo-fork`
- `batch-scan-start` → `/api/v4/batch-scan-start`

**Issue Management:**

- `issue-create` → `/api/v4/issue-create`
- `issue-ai-proxy` → `/api/v4/issue-ai-proxy`

**Setup:**

- `setup` → `/api/v4/setup`

### Legacy Branch

Azure Functions code is maintained in the `dev/api-legacy-azure-functions` branch for historical reference.

```

```
