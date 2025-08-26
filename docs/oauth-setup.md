# GitHub OAuth Setup for Development and Testing

This document provides detailed instructions for setting up GitHub OAuth for the Template Doctor application in different environments.

## Prerequisites

- GitHub account with permission to create OAuth applications
- Local development environment with Node.js

## GitHub OAuth Flow Overview

The Template Doctor application uses the standard OAuth 2.0 flow to authenticate with GitHub:

1. User clicks "Login with GitHub" button
2. User is redirected to GitHub's authorization page
3. User grants permission to the application
4. GitHub redirects back to our callback URL with an authorization code
5. Our application exchanges the code for an access token via the backend API
6. The access token is stored in the browser's localStorage
7. The token is used for subsequent GitHub API requests

## Setting Up OAuth for Local Development

### 1. Create a GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the following details:
   - **Application name**: Template Doctor (Local)
   - **Homepage URL**: http://localhost:8080
   - **Application description**: (Optional) Local development instance of Template Doctor
   - **Authorization callback URL**: http://localhost:8080/callback.html
4. Click "Register application"
5. Note the generated **Client ID** (you'll need this later)
6. (Optional) Generate a client secret if your backend implementation requires it

### 2. Configure Environment Variables

Create or edit the `.env` file in the project root with your GitHub OAuth app's client ID:

```
GITHUB_CLIENT_ID=your_client_id_here
```

Note: The `.env` file is already in the `.gitignore` list to prevent accidentally committing secrets.

### 3. Test the OAuth Flow

1. Start the local development server: `npm run dev`
2. Navigate to http://localhost:8080
3. Click "Login with GitHub"
4. You should be redirected to GitHub's authorization page
5. After authorization, you should be redirected back to the application

## Setting Up OAuth for Production

For production deployments, you'll need to create a separate GitHub OAuth app:

### 1. Create a Production GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the following details:
   - **Application name**: Template Doctor
   - **Homepage URL**: https://your-production-url.com
   - **Application description**: (Optional) Production instance of Template Doctor
   - **Authorization callback URL**: https://your-production-url.com/callback.html
4. Click "Register application"
5. Note the generated **Client ID**

### 2. Configure Production Environment Variables

For Azure Static Web Apps or other hosting services, set the following environment variable:

```
GITHUB_CLIENT_ID=your_production_client_id_here
```

## Troubleshooting

### Common Issues

#### "redirect_uri_mismatch" Error

This error occurs when the redirect URI sent to GitHub doesn't exactly match what you registered:

1. Check that the registered callback URL matches exactly what your app is sending
2. Ensure that protocol (http/https), domain, port, and path match exactly
3. No trailing slashes should be added or removed
4. Check the `redirectUri` value in your config.json file
5. Verify the correct GitHub OAuth app is being used (development vs. production)

#### "Bad verification code" Error

This error usually means the authorization code has expired or been used already:

1. OAuth authorization codes are single-use and expire quickly
2. Ensure you're not trying to exchange the same code multiple times
3. Check network requests to see if the code exchange is failing

#### "Not Found" Error on Callback

If GitHub redirects to your callback URL but it returns a 404:

1. Ensure your web server is running
2. Check that the callback.html file exists in the correct location
3. Verify the base path detection is working correctly for your hosting environment

## Configuration Files

The OAuth configuration is spread across several files:

1. **config.json**: Contains the redirect URI for local development
2. **auth.js**: Handles the OAuth flow and token management
3. **config-loader.js**: Loads configuration from multiple sources
4. **runtime-config.js**: Exposes environment variables to the client
5. **callback.html**: Processes the OAuth callback from GitHub

## Security Considerations

- Never commit OAuth client secrets to your repository
- Use environment variables for sensitive configuration
- Configure proper CORS settings for your API endpoints
- Implement state parameter validation to prevent CSRF attacks (already done in auth.js)
- Consider adding PKCE for additional security in public clients

## Additional Resources

- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps)
- [OAuth 2.0 Specification](https://oauth.net/2/)