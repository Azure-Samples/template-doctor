# OAuth Configuration Guide

This document explains how GitHub OAuth authentication works in Template Doctor for both local development and production environments.

## How redirectUri Works

The GitHub OAuth authentication system requires a redirectUri to handle the callback after a user authorizes the application. Here's how it works in Template Doctor:

### Default Dynamic Behavior

By default, Template Doctor dynamically builds the redirectUri based on the current environment:

```javascript
redirectUri: window.location.origin + getBasePath() + '/callback.html'
```

This means:
- In local development: `http://localhost:8080/callback.html`
- In production (GitHub Pages): `https://your-username.github.io/template-doctor/callback.html`
- In production (Azure): `https://your-staticwebapp.azurestaticapps.net/callback.html`

### Configuration Options

You can override this behavior in two ways:

1. **Leave it empty in config.json (recommended)**: 
   ```json
   {
     "githubOAuth": {
       "redirectUri": ""
     }
   }
   ```
   With an empty string, the system will use the dynamic redirectUri based on the current environment.

2. **Specify a custom redirectUri**:
   ```json
   {
     "githubOAuth": {
       "redirectUri": "https://specific-domain.com/callback.html"
     }
   }
   ```
   This is useful for scenarios where you need a specific callback URL that differs from the dynamic one.

## GitHub OAuth App Setup

When registering your GitHub OAuth App:

1. For local development:
   - Set the callback URL to: `http://localhost:8080/callback.html`

2. For production:
   - Set the callback URL to match your production environment:
     - GitHub Pages: `https://your-username.github.io/template-doctor/callback.html`
     - Azure: `https://your-staticwebapp.azurestaticapps.net/callback.html`

3. For multiple environments:
   - You can register multiple OAuth apps with different callback URLs
   - Use environment variables to configure the appropriate client ID for each environment

## Environment Variable Configuration

The OAuth client ID and secret are provided through environment variables:

- For local development: Set in the consolidated `.env` file at the root of the project
- For GitHub Pages: Configure as GitHub repository secrets
- For Azure: Configure in App Settings

Example in the `.env` file:
```
GITHUB_CLIENT_ID=your_oauth_client_id
GITHUB_CLIENT_SECRET=your_oauth_client_secret
```

See the [Environment Variables Documentation](./ENVIRONMENT_VARIABLES.md) for a complete list of all environment variables used in the project.

## Troubleshooting

If you encounter OAuth redirect issues:

1. Check the browser console for the actual redirectUri being used
2. Verify that the redirectUri matches one of the callback URLs in your GitHub OAuth App settings
3. Ensure `config.json` either has an empty redirectUri or one that matches your OAuth App settings
4. Clear browser cache and cookies if testing changes to the OAuth configuration