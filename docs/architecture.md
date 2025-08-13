# Template Doctor – Deployment Test Architecture

This diagram shows how the Static Web App (frontend), managed/standalone Functions, Azure Container Apps Job, and Log Analytics interact during the “Test AZD Provision” flow.

```mermaid
sequenceDiagram
    participant U as User
    participant SWA as SWA Frontend
    participant MF as Managed OAuth Function
    participant FA as Functions App (standalone)
    participant ACA as ACA Job
    participant LAW as Log Analytics

    U->>SWA: Click Test AZD Provision
    SWA->>FA: POST /api/start-job (repoUrl and action)
    FA->>ACA: Begin start and wait (job + executionName)
    ACA-->>FA: Execution started
    FA-->>SWA: Return executionName
    SWA->>FA: GET /api/job-logs/:executionName (SSE)
    opt SSE fails
        SWA->>FA: GET /api/job-logs/:executionName?mode=poll&since=cursor
    end
    FA->>LAW: Query logs for execution (optional)
    LAW-->>FA: Log lines
    FA-->>SWA: Stream status, message, complete events or JSON summary
    SWA-->>U: Render status and logs
```

Notes
- Frontend attempts SSE first for logs, then falls back to JSON polling automatically.
- The Stop button stops local streaming (not the job itself). A cancellable endpoint can be added later if needed.

## GitHub issue creation flow (assign to Copilot)

This diagram shows how the frontend uses the managed OAuth function to exchange the code for a token and then opens a GitHub issue, applying labels and assigning it to Copilot.

```mermaid
sequenceDiagram
    participant U as User
    participant SWA as SWA Frontend
    participant MF as Managed OAuth Function
    participant GH as GitHub API

    U->>SWA: Click Open Issue
    SWA->>MF: GET /api/github-oauth-token with code
    MF-->>SWA: Return access token
    SWA->>GH: POST /repos/:owner/:repo/issues (title, body, labels, assignees: copilot)
    GH-->>SWA: 201 Created (issue number and url)
    opt Add more labels
        SWA->>GH: POST /repos/:owner/:repo/issues/:number/labels (labels)
        GH-->>SWA: 200 OK
    end
    SWA-->>U: Show issue link and assigned to Copilot
```
