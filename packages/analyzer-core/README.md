# Template Doctor Analyzer Core

This package provides the core analyzer functionality for the Template Doctor application.

## Description

The analyzer core is responsible for processing GitHub repository templates and providing analysis results.

## Usage

```typescript
import { runAnalyzer } from 'template-doctor-analyzer-core';

const result = await runAnalyzer(repoUrl, files, options);
```

## API

### runAnalyzer(repoUrl, files, options)

Analyzes a GitHub repository template and returns analysis results.

Parameters:
- `repoUrl` (string): The URL of the GitHub repository
- `files` (GitHubFile[]): Array of file objects from the repository
- `options` (AnalyzerOptions): Configuration options for the analyzer

Returns:
- Analysis results object

## Development

1. Build the package:
   ```bash
   npm run build
   ```

2. Run tests:
   ```bash
   npm test
   ```