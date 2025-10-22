# Adding New Workflows to Template Doctor

This guide explains how to add new GitHub Actions workflows to Template Doctor using the Generic Workflow Execution System.

## Quick Reference

**The generic workflow system allows you to add new workflows WITHOUT code changes.**

Simply configure the workflow via the setup endpoint or database, and the system handles:
- ✅ Workflow triggering
- ✅ Status polling
- ✅ Artifact downloading and parsing
- ✅ Job log streaming
- ✅ Result rendering

## Prerequisites

1. A GitHub Actions workflow file in `.github/workflows/`
2. The workflow must accept `workflow_dispatch` trigger
3. (Optional) Custom artifact parser if using non-standard format

## Step-by-Step Guide

### 1. Create Your GitHub Actions Workflow

Example: `.github/workflows/my-custom-validation.yml`

```yaml
name: My Custom Validation

on:
  workflow_dispatch:
    inputs:
      target_validate_template_url:
        description: 'Repository URL to validate'
        required: true
      run_id:
        description: 'Unique run identifier'
        required: true
      callback_url:
        description: 'Optional callback URL for completion notification'
        required: false
      # Add your custom inputs here
      custom_param:
        description: 'Custom parameter'
        required: false

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        
      - name: Run validation
        run: |
          echo "Validating ${{ inputs.target_validate_template_url }}"
          # Your validation logic here
          
      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: validation-results-${{ inputs.run_id }}
          path: |
            results.md
            # or results.json
            # or results.log
```

**Key Requirements:**
- Must support `workflow_dispatch` trigger
- Should accept `run_id` input (used for tracking)
- Should upload artifacts with results
- Artifact can be `.md`, `.json`, `.log`, or custom format

### 2. Configure the Workflow in Template Doctor

**Option A: Via MongoDB (Recommended)**

Add to `workflow_configs` collection:

```javascript
db.workflow_configs.insertOne({
  id: "my-custom-validation",
  name: "My Custom Validation",
  workflowFile: "my-custom-validation.yml",
  description: "Validates templates using custom rules",
  artifactCompressed: true,  // true if GitHub zips the artifact
  artifactNamePattern: "validation-results-*",  // Pattern to match artifacts
  streamLogs: true,  // true to fetch job logs in real-time
  customParser: "markdown",  // or "json", "log", or custom parser name
  resultTemplate: "/templates/custom-validation-result.html",  // Optional
  defaultInputs: {
    custom_param: "default_value"
  },
  timeout: 300000,  // 5 minutes in milliseconds
  createdAt: new Date(),
  updatedAt: new Date()
});
```

**Option B: Programmatic (via code)**

```typescript
import { saveWorkflowConfig } from './services/workflow-config-loader';

const newWorkflow = {
  id: 'my-custom-validation',
  name: 'My Custom Validation',
  workflowFile: 'my-custom-validation.yml',
  description: 'Validates templates using custom rules',
  artifactCompressed: true,
  artifactNamePattern: 'validation-results-*',
  streamLogs: true,
  customParser: 'markdown',
  resultTemplate: '/templates/custom-validation-result.html',
  defaultInputs: {
    custom_param: 'default_value'
  },
  timeout: 300000
};

await saveWorkflowConfig(newWorkflow);
```

### 3. (Optional) Register Custom Parser

If your workflow uses a custom artifact format, register a parser:

```typescript
import { registerParser } from './services/workflow-parser-registry';

registerParser('my-custom-parser', (content, config) => {
  // Parse the artifact content
  const lines = content.split('\n');
  const results = {
    status: lines[0].includes('PASS') ? 'success' : 'failure',
    errors: lines.filter(l => l.startsWith('ERROR:')),
    warnings: lines.filter(l => l.startsWith('WARNING:')),
    details: content
  };
  
  return {
    format: 'custom',
    ...results
  };
}, 'My custom artifact parser');
```

Then update your workflow config:
```javascript
{
  ...
  customParser: "my-custom-parser"
}
```

### 4. Use the Workflow from Frontend

```typescript
// 1. Trigger the workflow
const response = await fetch('/api/v4/workflow-execute', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${githubToken}`
  },
  body: JSON.stringify({
    workflowId: 'my-custom-validation',
    inputs: {
      target_validate_template_url: 'https://github.com/user/repo',
      custom_param: 'custom_value'
    },
    streamLogs: true
  })
});

const { runId, workflowRunId } = await response.json();

// 2. Poll for status
const pollInterval = setInterval(async () => {
  const status = await fetch(
    `/api/v4/workflow-status?workflowRunId=${workflowRunId}&workflowId=my-custom-validation&streamLogs=true`,
    {
      headers: { 'Authorization': `Bearer ${githubToken}` }
    }
  ).then(r => r.json());
  
  // Display logs
  if (status.logs) {
    console.log(status.logs);
  }
  
  // Check if complete
  if (status.status === 'completed') {
    clearInterval(pollInterval);
    console.log('Results:', status.result);
  }
}, 5000);

// 3. Cancel if needed
await fetch('/api/v4/workflow-cancel', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${githubToken}`
  },
  body: JSON.stringify({
    workflowRunId,
    workflowOrgRepo: 'Template-Doctor/template-doctor'
  })
});
```

## Built-in Parsers

The system includes 4 built-in parsers:

### 1. Markdown Parser (`markdown`)
- Extracts sections by headers
- Parses checklists `- [x]` and `- [ ]`
- Extracts code blocks
- **Use for**: Text-based results with structure

### 2. JSON Parser (`json`)
- Parses JSON artifacts
- Validates JSON format
- **Use for**: Structured data results

### 3. Log Parser (`log`)
- Extracts errors (ERROR, FAILED, FATAL)
- Extracts warnings (WARNING, WARN)
- Splits into lines
- **Use for**: Plain text logs

### 4. AZD Validation Parser (`azd-validation`)
- Specialized for AZD template validation
- Extracts success/failure status
- Parses PSRule errors/warnings
- **Use for**: AZD validation workflows only

## Configuration Options

### `artifactCompressed`
- `true`: Artifact is a ZIP file (default for GitHub artifacts)
- `false`: Artifact is plain text

The system auto-detects ZIP files by magic bytes, so this is mostly a hint.

### `artifactNamePattern`
- Pattern to match artifact names
- Supports wildcards: `*-validation-result`, `results-*`
- Defaults to first artifact if not specified

### `streamLogs`
- `true`: Fetch job logs with every status poll
- `false`: Only fetch logs on failure

Logs are fetched from GitHub API and included in status response.

### `customParser`
- Name of registered parser
- Auto-detects based on file extension if not specified
- Built-in: `markdown`, `json`, `log`, `azd-validation`

### `resultTemplate`
- Path to HTML template for rendering results
- Frontend can fetch and render with result data
- Optional - frontend can use generic rendering

### `defaultInputs`
- Default values merged with user inputs
- Workflow-specific parameters
- Example: `{ customValidators: 'azd-up,azd-down' }`

### `timeout`
- Maximum workflow execution time in milliseconds
- Default: 300000 (5 minutes)
- Increase for long-running validations

## Example Workflows

### Security Scanning Workflow

```javascript
{
  id: "security-scan",
  name: "Security Scanner",
  workflowFile: "security-scan.yml",
  artifactCompressed: true,
  artifactNamePattern: "security-report-*",
  streamLogs: false,
  customParser: "json",
  defaultInputs: {
    scanDepth: "full"
  },
  timeout: 600000  // 10 minutes
}
```

### Compliance Checker Workflow

```javascript
{
  id: "compliance-check",
  name: "Compliance Checker",
  workflowFile: "compliance-check.yml",
  artifactCompressed: true,
  artifactNamePattern: "*-compliance-report",
  streamLogs: true,
  customParser: "markdown",
  resultTemplate: "/templates/compliance-result.html",
  timeout: 300000
}
```

## Testing Your Workflow

1. **Test the GitHub workflow manually** first via GitHub UI
2. **Verify artifact upload** - check artifact is created
3. **Test via API**:
   ```bash
   curl -X POST http://localhost:3000/api/v4/workflow-execute \
     -H "Authorization: Bearer $GITHUB_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "workflowId": "my-custom-validation",
       "inputs": {
         "target_validate_template_url": "https://github.com/test/repo"
       }
     }'
   ```
4. **Poll for status**:
   ```bash
   curl "http://localhost:3000/api/v4/workflow-status?workflowRunId=123&workflowId=my-custom-validation" \
     -H "Authorization: Bearer $GITHUB_TOKEN"
   ```

## Troubleshooting

### Workflow doesn't start
- Check `GH_WORKFLOW_TOKEN` is set and has correct permissions
- Verify workflow file name matches configuration
- Check workflow accepts `workflow_dispatch` trigger

### Artifact not found
- Verify artifact is uploaded in workflow
- Check `artifactNamePattern` matches artifact name
- Ensure workflow completes successfully

### Parser fails
- Check artifact format matches parser type
- Try `markdown` parser for text files
- Implement custom parser if needed

### Logs not appearing
- Set `streamLogs: true` in configuration
- Ensure jobs have completed (logs only available after completion)

## See Also

- [GENERIC_WORKFLOW_SYSTEM.md](./GENERIC_WORKFLOW_SYSTEM.md) - Complete system documentation
- [GITHUB_WORKFLOWS.md](./GITHUB_WORKFLOWS.md) - GitHub Actions workflow guide
- [architecture.md](./architecture.md) - System architecture overview
