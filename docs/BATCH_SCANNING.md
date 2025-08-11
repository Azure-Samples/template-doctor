# Batch Scanning Feature for Template Doctor

This document describes the batch scanning feature added to Template Doctor, which allows users to scan multiple repositories at once, automatically fork repositories that aren't already forked, and generate comprehensive reports for each.

## Features

1. **Toggle Between Single and Batch Modes**
   - Simple toggle switch to change between single repository scanning and batch scanning

2. **Multiple URL Input Formats**
   - Accept newline-separated URLs
   - Accept comma-separated URLs
   - Support for various URL formats (full URLs, owner/repo format, or github.com/owner/repo)

3. **Automatic Forking**
   - Automatically checks if repositories need to be forked
   - Creates forks when necessary before scanning

4. **Batch Progress Tracking**
   - Visual progress bar for batch processing
   - Individual status indicators for each repository
   - Ability to cancel remaining scans

5. **Error Handling and Retry**
   - Graceful handling of errors for individual repositories
   - Ability to retry failed scans without restarting the entire batch
   - Detailed error messages for troubleshooting

6. **Individual Report Viewing**
   - View detailed reports for each successfully scanned repository
   - Navigate back to the batch results after viewing a report
   - Back button text changes to "Back to Results" when viewing batch scan reports

7. **Persistent Scan Progress**
   - Uses IndexedDB to store scan progress and results
   - Ability to resume an interrupted or cancelled batch scan
   - Option to skip previously successful scans when resuming
   - Preserves scan results even if the browser is closed or refreshed

## Usage Instructions

1. Click the toggle switch to change to "Batch" mode
2. Enter repository URLs in the textarea (one per line or comma-separated)
3. Click "Start Batch Scan" to begin processing
4. Monitor progress for each repository
5. After scanning completes or when resuming:
   - View individual reports by clicking "View Report"
   - Retry failed scans by clicking "Retry"
   - Return to batch results using the back button labeled "Back to Results"
   - If returning to a previous batch scan, you'll be asked if you want to resume and skip successful scans

## URL Format Examples

The batch scanner accepts repositories in the following formats:

```
https://github.com/Azure-Samples/todo-nodejs-mongo-aca
Azure-Samples/todo-csharp-cosmos-sql
github.com/Azure-Samples/todo-nodejs-mongo
```

Or as comma-separated values:

```
https://github.com/Azure-Samples/todo-nodejs-mongo-aca, Azure-Samples/todo-csharp-cosmos-sql
```

## Resume Functionality

If you start a batch scan with URLs that have been previously scanned:

1. You'll see a confirmation dialog asking if you want to resume and skip successful scans
2. If you choose to resume, any previously successful scans will be displayed immediately without reprocessing
3. Only failed or new repositories will be processed
4. Progress will be updated to reflect the total number of repositories, including previously successful ones

## Testing

Use the provided test-batch-scan.html file to test the batch scanning functionality. It contains comprehensive test cases to verify all aspects of the feature.

## Implementation Details

The batch scanning feature is implemented in the following files:

- **src/frontend/css/scan-request.css**: Styling for the batch scanning UI
- **src/frontend/index.html**: HTML structure for batch scanning UI elements
- **src/frontend/js/app.js**: JavaScript functionality for batch scanning
  - Toggle between single and batch modes
  - Parse repository URLs
  - Process repositories sequentially
  - Handle errors and retries
  - Display results
  - Persistent storage with IndexedDB
  - Resume functionality for interrupted scans

The implementation ensures that each repository is processed one at a time to avoid overwhelming the GitHub API and to ensure consistent results. The IndexedDB storage allows for efficient resumption of batch scans, saving time and resources by avoiding the reprocessing of already successful scans.
