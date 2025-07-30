# Setting up the GitHub Action for Template Doctor

This guide explains how to set up the GitHub Action to automatically submit template analysis results as pull requests.

## Prerequisites

1. You need a GitHub account with write access to the repository.
2. You need a Personal Access Token (PAT) with the `repo` scope.

## Setting up the Personal Access Token

The GitHub Action needs a token with the correct permissions to create repository dispatch events and pull requests.

1. Go to your GitHub account settings
2. Navigate to "Developer settings" > "Personal access tokens" > "Tokens (classic)"
3. Click on "Generate new token" > "Generate new token (classic)"
4. Give the token a descriptive name like "Template Doctor Action"
5. Select the `repo` scope (this gives full control of repositories)
6. Click "Generate token"
7. Copy the token (it will only be shown once)

## Configure the Template Doctor

1. Login to Template Doctor using your GitHub account
2. Add your Personal Access Token in the settings page
3. Make sure your token has the correct permissions

## How the Action Works

1. When you analyze a template, Template Doctor will:
   - Analyze the repository against the selected ruleset
   - Send the results to the GitHub API using your PAT
   - Create a repository dispatch event in the Template Doctor repository
   - This triggers a GitHub Action workflow that creates a PR with your analysis

## Troubleshooting

If the PR is not being created, check these common issues:

### 1. Token Permission Issues

- The token needs the `repo` scope
- The token must be valid and not expired
- The token must belong to a user with write access to the repository

### 2. API Rate Limits

- GitHub API has rate limits that might be reached
- Check the error message for rate limit information

### 3. Repository Dispatch Errors

- Repository dispatch events require the token to have the correct permissions
- The target repository must be correctly configured to accept these events

### 4. Action Workflow Issues

- Check the GitHub Actions tab in the repository for any workflow failures
- Look at the logs for error messages

## Manual Testing

You can manually test the repository dispatch with this curl command:

```bash
curl -X POST \
  -H "Authorization: token YOUR_PERSONAL_ACCESS_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Content-Type: application/json" \
  https://api.github.com/repos/anfibiacreativa/template-doctor/dispatches \
  -d '{"event_type":"template-analysis-completed","client_payload":{"repoUrl":"https://github.com/test/repo","ruleSet":"dod","username":"testuser","timestamp":"2023-01-01T00:00:00Z"}}'
```

Replace `YOUR_PERSONAL_ACCESS_TOKEN` with your actual token.
