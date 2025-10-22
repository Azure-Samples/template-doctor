# Generic Workflow Execution System

## Overview

The Generic Workflow Execution System provides a unified, extensible framework for triggering, monitoring, and processing results from any GitHub Actions workflow. This complements the existing validation endpoints by providing a flexible system that can be configured at runtime without code changes.

## Architecture

```
┌─────────────────┐
│  Setup/Config   │ ← Workflow configurations stored in MongoDB
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Workflow        │ ← Registers workflows on startup
│ Config Loader   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generic         │ ← Unified API endpoints
│ Workflow Routes │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Workflow        │ ← Core execution logic
│ Service         │   - Trigger
└────────┬────────┘   - Status
         │            - Cancel
         ▼            - Artifact Download
┌─────────────────┐
│ Parser Registry │ ← Pluggable artifact parsers
└─────────────────┘   - Markdown
                      - JSON
                      - Log
                      - Custom
```

## Key Components

### 1. Workflow Configuration

Workflows are configured via the setup endpoint and stored in MongoDB. Each configuration defines:

```typescript
interface WorkflowConfig {
  id: string;                          // Unique identifier (e.g., 'azd-validation')
  name: string;                        // Display name
  workflowFile: string;                // GitHub workflow filename
  description?: string;                // What this workflow does
  artifactCompressed: boolean;         // Whether artifacts are ZIP files
  artifactNamePattern?: string;        // Pattern to match artifacts (supports wildcards)
  streamLogs: boolean;                 // Whether to fetch job logs in real-time
  customParser?: string;               // Custom parser name (optional)
  resultTemplate?: string;             // Path to HTML template for results
  defaultInputs?: Record<string, string>; // Default workflow inputs
  timeout?: number;                    // Timeout in milliseconds
}
```

### 2. Default Workflows

Three workflows are pre-configured on startup:

#### AZD Template Validation
```typescript
{
  id: 'azd-validation',
  name: 'AZD Template Validation',
  workflowFile: 'validation-template.yml',
  artifactCompressed: true,
  artifactNamePattern: '*-validation-result',
  streamLogs: true,
  customParser: 'azd-validation',
  resultTemplate: '/templates/azd-validation-result.html',
  defaultInputs: {
    customValidators: 'azd-up,azd-down'
  },
  timeout: 600000 // 10 minutes
}
```

#### Docker Image Security Scan
```typescript
{
  id: 'docker-image-scan',
  name: 'Docker Image Security Scan',
  workflowFile: 'validation-docker-image.yml',
  artifactCompressed: true,
  streamLogs: false,
  customParser: 'json',
  resultTemplate: '/templates/docker-scan-result.html',
  timeout: 300000 // 5 minutes
}
```

#### OSSF Scorecard
```typescript
{
  id: 'ossf-scorecard',
  name: 'OSSF Scorecard Analysis',
  workflowFile: 'validation-ossf.yml',
  artifactCompressed: true,
  streamLogs: false,
  customParser: 'json',
  resultTemplate: '/templates/ossf-scorecard-result.html',
  timeout: 300000 // 5 minutes
}
```

### 3. Artifact Parsing

The system includes a pluggable parser registry with built-in parsers:

#### Built-in Parsers

- **`markdown`**: Extracts sections, checklists, code blocks
- **`log`**: Extracts errors, warnings, and log lines
- **`json`**: Parses JSON artifacts
- **`azd-validation`**: Specialized parser for AZD validation results

#### Custom Parsers

Register custom parsers for workflow-specific formats:

```typescript
import { registerParser } from './services/workflow-parser-registry';

registerParser('my-custom-parser', (content, config) => {
  // Parse content and return structured data
  return {
    format: 'custom',
    parsed: parseCustomFormat(content),
  };
}, 'Description of custom parser');
```

### 4. Automatic Decompression

The system automatically detects and decompresses ZIP artifacts:

- Checks magic bytes (0x50 0x4B for ZIP files)
- Falls back to raw content if not compressed
- Extracts first file matching `.md`, `.log`, or `.json`

## API Endpoints

### GET /api/v4/workflows

List all available workflow configurations.

**Response:**
```json
{
  "workflows": [
    {
      "id": "azd-validation",
      "name": "AZD Template Validation",
      "description": "Validates Azure Developer CLI templates",
      "workflowFile": "validation-template.yml",
      "streamLogs": true,
      "resultTemplate": "/templates/azd-validation-result.html"
    }
  ],
  "count": 3
}
```

### POST /api/v4/workflow-execute

Trigger a workflow execution.

**Request:**
```json
{
  "workflowId": "azd-validation",
  "inputs": {
    "target_validate_template_url": "https://github.com/user/repo",
    "customValidators": "azd-up,azd-down"
  },
  "callbackUrl": "https://example.com/callback",
  "streamLogs": true
}
```

**Response:**
```json
{
  "runId": "550e8400-e29b-41d4-a716-446655440000",
  "workflowRunId": 1234567890,
  "githubRunUrl": "https://github.com/.../actions/runs/1234567890",
  "workflowOrgRepo": "Template-Doctor/template-doctor",
  "config": { ... },
  "requestId": "req-1234567890-abc123"
}
```

### GET /api/v4/workflow-status

Check workflow execution status with optional logs and parsed results.

**Query Parameters:**
- `workflowRunId` (required): GitHub workflow run ID
- `workflowId` (required): Workflow configuration ID
- `workflowOrgRepo` (optional): GitHub org/repo (defaults to env)
- `streamLogs` (optional): Whether to include job logs

**Response:**
```json
{
  "status": "completed",
  "conclusion": "success",
  "html_url": "https://github.com/.../actions/runs/1234567890",
  "created_at": "2025-10-21T12:00:00Z",
  "updated_at": "2025-10-21T12:05:00Z",
  "jobs": [
    {
      "id": 1234,
      "name": "validate",
      "status": "completed",
      "conclusion": "success",
      "html_url": "https://github.com/.../jobs/1234",
      "started_at": "2025-10-21T12:00:30Z",
      "completed_at": "2025-10-21T12:05:00Z"
    }
  ],
  "failedJobs": [],
  "errorSummary": "",
  "result": {
    "azdUpSuccess": true,
    "azdDownSuccess": true,
    "psRuleErrors": 0,
    "psRuleWarnings": 2,
    "overallStatus": "warning"
  },
  "logs": [
    {
      "jobId": 1234,
      "jobName": "validate",
      "log": "...",
      "downloadUrl": "https://api.github.com/.../logs"
    }
  ],
  "requestId": "req-1234567890-abc123"
}
```

### POST /api/v4/workflow-cancel

Cancel a running workflow.

**Request:**
```json
{
  "workflowRunId": 1234567890,
  "workflowOrgRepo": "Template-Doctor/template-doctor"
}
```

**Response:**
```json
{
  "message": "Workflow cancelled",
  "workflowRunId": 1234567890,
  "requestId": "req-1234567890-abc123"
}
```

## Configuration Management

### Via Setup Endpoint

Workflow configurations can be managed through the setup endpoint (admin only):

1. **List Configurations**: `GET /api/v4/workflows`
2. **Add/Update Configuration**: Store in MongoDB `workflow_configs` collection
3. **Delete Configuration**: Remove from MongoDB

### Programmatic Registration

```typescript
import { saveWorkflowConfig } from './services/workflow-config-loader';

const newWorkflow: WorkflowConfig = {
  id: 'my-custom-workflow',
  name: 'My Custom Workflow',
  workflowFile: 'my-workflow.yml',
  artifactCompressed: true,
  streamLogs: false,
  customParser: 'my-parser',
  defaultInputs: {
    param1: 'value1'
  },
  timeout: 300000
};

await saveWorkflowConfig(newWorkflow);
```

## Frontend Integration

### Basic Usage

```typescript
// 1. List available workflows
const workflows = await fetch('/api/v4/workflows').then(r => r.json());

// 2. Trigger workflow
const execution = await fetch('/api/v4/workflow-execute', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    workflowId: 'azd-validation',
    inputs: {
      target_validate_template_url: repoUrl
    },
    streamLogs: true
  })
}).then(r => r.json());

// 3. Poll for status
const pollStatus = async () => {
  const status = await fetch(
    `/api/v4/workflow-status?workflowRunId=${execution.workflowRunId}&workflowId=${workflowId}&streamLogs=true`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  ).then(r => r.json());

  if (status.status === 'completed') {
    // Render results using status.result
    renderResults(status.result, execution.config.resultTemplate);
  } else {
    // Show logs if available
    if (status.logs) {
      displayLogs(status.logs);
    }
    // Continue polling
    setTimeout(pollStatus, 5000);
  }
};

pollStatus();

// 4. Cancel if needed
await fetch('/api/v4/workflow-cancel', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    workflowRunId: execution.workflowRunId,
    workflowOrgRepo: execution.workflowOrgRepo
  })
});
```

### Dynamic Result Rendering

The system supports workflow-specific result templates:

```typescript
function renderResults(result: any, templatePath?: string) {
  if (templatePath) {
    // Load and render workflow-specific template
    fetch(templatePath).then(async html => {
      const template = await html.text();
      const rendered = Mustache.render(template, result);
      document.getElementById('results').innerHTML = rendered;
    });
  } else {
    // Generic result rendering
    displayGenericResults(result);
  }
}
```

## Migration from Existing Validation Endpoints

The generic system complements existing endpoints:

### Old Way (Specific)
```typescript
// Trigger
POST /api/v4/validation-template
// Status
GET /api/v4/validation-status?workflowRunId=123
// Cancel
POST /api/v4/validation-cancel
```

### New Way (Generic)
```typescript
// Trigger
POST /api/v4/workflow-execute { workflowId: 'azd-validation', inputs: {...} }
// Status
GET /api/v4/workflow-status?workflowRunId=123&workflowId=azd-validation
// Cancel
POST /api/v4/workflow-cancel { workflowRunId: 123 }
```

**Both approaches work!** The generic system is fully backward-compatible.

## Benefits

1. **Extensibility**: Add new workflows without code changes
2. **Configurability**: Customize workflows via setup UI
3. **Reusability**: Same infrastructure for all workflow types
4. **Flexibility**: Support any artifact format with custom parsers
5. **Maintainability**: Single codebase for all workflows
6. **Observability**: Real-time log streaming and detailed status

## Security

- All endpoints require OAuth authentication (`requireAuth` middleware)
- Workflow dispatch uses `GH_WORKFLOW_TOKEN` environment variable
- Admin endpoints protected by `requireAdmin` middleware
- Rate limiting applied to expensive operations (`strictRateLimit`)

## See Also

- [GITHUB_WORKFLOWS.md](./GITHUB_WORKFLOWS.md) - GitHub Actions workflow documentation
- [OAUTH_CONFIGURATION.md](./OAUTH_CONFIGURATION.md) - OAuth setup guide
- [architecture.md](./architecture.md) - Overall system architecture
