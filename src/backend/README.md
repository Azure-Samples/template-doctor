# Template Doctor

An Azure Developer CLI template analysis and healing agent. This tool analyzes GitHub repositories that contain Azure Developer CLI (azd) templates to ensure they follow best practices and meet compliance requirements.

## Features

- Checks for required files and folders
- Validates workflow files
- Ensures proper documentation is present
- Checks README.md for required sections and content
- Analyzes Bicep files for required resources
- Verifies azure.yaml configuration
- Generates comprehensive compliance reports
- Provides visual dashboard for compliance status

## Installation

```bash
# Clone the repository
git clone https://github.com/your-username/template-doctor.git
cd template-doctor

# Install dependencies
npm install

# Build the project
npm run build

# Link the CLI for global usage (optional)
npm link
```

## Usage

```bash
# Analyze a GitHub repository
template-doctor analyze --repo=https://github.com/username/repo

# Analyze and serve the dashboard on localhost
template-doctor analyze --repo=https://github.com/username/repo --serve

# Analyze and automatically open the dashboard in a browser
template-doctor analyze --repo=https://github.com/username/repo --open-dashboard

# Specify a custom port for the dashboard server
template-doctor analyze --repo=https://github.com/username/repo --serve --port=8080

# Create a GitHub issue with analysis results
template-doctor create-issue --repo=https://github.com/username/repo

# Start an AZD provision test
template-doctor provision --repo=https://github.com/username/repo --env=dev

# Check the status of an AZD provision job
template-doctor status --job-id=12345
```

## Output

The tool generates two files in the `results` directory:

1. A JSON report with detailed analysis results
2. An HTML dashboard visualizing the compliance status

## Dashboard

The dashboard provides a modern visualization of the compliance status:

- **Compliance Overview**: Shows overall compliance percentage
- **Issues**: Lists all compliance issues with details on how to fix
- **Passed Checks**: Shows all checks that passed with additional details
- **Quick Fix**: Button to open the repository in vscode.dev for quick fixes

## Development

```bash
# Run the tool in development mode
npm run build && npm start -- --repo=https://github.com/username/repo

# Adding new compliance rules
# Modify src/config/dod-rules.ts to add new rules
```

## MCP Server Integration

Template Doctor can integrate with the awesome-azd-template-testing MCP server to:

1. Create GitHub issues with template analysis results
2. Run AZD provisioning tests on templates
3. Get status and logs from provisioning jobs

### Configuration

Set the following environment variables in your `.env` file:

```bash
MCP_SERVER_URL=https://awesome-azd-template-testing.azurewebsites.net
MCP_API_KEY=your_api_key_here
```

### Usage Examples

```bash
# Create a GitHub issue with analysis results
template-doctor create-issue --repo=https://github.com/username/repo

# Start an AZD provision test
template-doctor provision --repo=https://github.com/username/repo --env=dev

# Check the status of an AZD provision job
template-doctor status --job-id=12345

# Test the dashboard with MCP integration
npm run test-dashboard
```

### Testing the Dashboard

To test the dashboard with MCP integration buttons:

1. Make sure your `.env` file contains the `MCP_API_KEY` value
2. Run `npm run build` to build the project
3. Run `npm run test-dashboard` to open a test dashboard with sample data
4. Test the "Create GitHub Issue" and "Test AZD Provision" buttons

The test dashboard uses sample data to show how the MCP integration works.

## License

MIT
