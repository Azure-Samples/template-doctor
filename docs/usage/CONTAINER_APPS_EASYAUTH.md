# Azure Container Apps Deployment with EasyAuth

This guide explains how to deploy Template Doctor to Azure Container Apps with EasyAuth (Easy Authentication) enabled for GitHub authentication.

## Overview

Azure Container Apps EasyAuth provides built-in authentication without requiring code changes. When enabled, Azure handles:

- Redirecting unauthenticated users to GitHub login
- Validating OAuth tokens
- Injecting user identity into request headers
- Managing session cookies

The application code only needs to read the injected headers to identify the authenticated user.

## Prerequisites

1. **Azure Subscription** with permissions to create resources
2. **Azure CLI** installed and configured (`az login`)
3. **GitHub OAuth App** registered:
   - Go to GitHub Settings → Developer settings → OAuth Apps → New OAuth App
   - Application name: "Template Doctor"
   - Homepage URL: Will be set after deployment
   - Authorization callback URL: `https://YOUR_APP_FQDN/.auth/login/github/callback`
   - Save the Client ID and generate a Client Secret

4. **Container Registry** (Azure Container Registry or Docker Hub)
5. **GitHub Tokens**:
   - Personal Access Token with `repo`, `workflow` scopes
   - Optional: Separate workflow token

## Deployment Steps

### 1. Build and Push Container Image

```bash
# Build the combined container (frontend + backend)
docker build -t template-doctor:latest -f Dockerfile.combined .

# Tag for your registry
docker tag template-doctor:latest YOUR_REGISTRY.azurecr.io/template-doctor:latest

# Login to Azure Container Registry (if using ACR)
az acr login --name YOUR_REGISTRY

# Push the image
docker push YOUR_REGISTRY.azurecr.io/template-doctor:latest
```

### 2. Prepare Parameters File

Copy the example parameters file and fill in your values:

```bash
cp infra/main.parameters.json.example infra/main.parameters.json
```

Edit `infra/main.parameters.json`:

```json
{
  "containerImage": {
    "value": "YOUR_REGISTRY.azurecr.io/template-doctor:latest"
  },
  "githubClientId": {
    "value": "your_github_oauth_client_id"
  },
  "githubClientSecret": {
    "value": "your_github_oauth_client_secret"
  },
  "githubToken": {
    "value": "ghp_your_github_token"
  },
  "ghWorkflowToken": {
    "value": "ghp_your_workflow_token"
  },
  "setupAllowedUsers": {
    "value": "github-username1,github-username2"
  }
}
```

**Important**: Never commit `main.parameters.json` to source control! Add it to `.gitignore`.

### 3. Deploy Infrastructure

Create a resource group:

```bash
az group create \
  --name template-doctor-rg \
  --location eastus
```

Deploy the Bicep template:

```bash
az deployment group create \
  --resource-group template-doctor-rg \
  --template-file infra/main.bicep \
  --parameters @infra/main.parameters.json
```

### 4. Get Deployment Outputs

After deployment completes, retrieve the app URL:

```bash
az deployment group show \
  --resource-group template-doctor-rg \
  --name main \
  --query properties.outputs.containerAppUrl.value \
  --output tsv
```

### 5. Update GitHub OAuth App

Go back to your GitHub OAuth App settings and update:

- **Homepage URL**: `https://YOUR_APP_FQDN` (from step 4)
- **Authorization callback URL**: `https://YOUR_APP_FQDN/.auth/login/github/callback`

### 6. Verify EasyAuth Configuration

Check that EasyAuth is properly configured:

```bash
# Get the container app name
APP_NAME=$(az containerapp list \
  --resource-group template-doctor-rg \
  --query "[0].name" \
  --output tsv)

# View auth configuration
az containerapp auth show \
  --name $APP_NAME \
  --resource-group template-doctor-rg
```

Expected output should show:
- `platform.enabled: true`
- `identityProviders.gitHub.enabled: true`
- `globalValidation.unauthenticatedClientAction: RedirectToLoginPage`

## How EasyAuth Works

### Authentication Flow

1. User visits the app URL (e.g., `https://template-doctor.example.com`)
2. Azure detects no authentication cookie
3. Azure redirects to GitHub OAuth: `https://github.com/login/oauth/authorize`
4. User authorizes the app on GitHub
5. GitHub redirects back to: `https://template-doctor.example.com/.auth/login/github/callback`
6. Azure exchanges the code for a token
7. Azure sets an authentication cookie
8. Azure redirects user to original URL
9. All subsequent requests include authentication headers

### Headers Injected by EasyAuth

When a user is authenticated, Azure injects these headers into every request:

- `X-MS-CLIENT-PRINCIPAL`: Base64-encoded JSON with full user info
- `X-MS-CLIENT-PRINCIPAL-ID`: Unique user identifier
- `X-MS-CLIENT-PRINCIPAL-NAME`: GitHub username
- `X-MS-CLIENT-PRINCIPAL-IDP`: Identity provider (always "github")

Example decoded principal:

```json
{
  "auth_typ": "aad",
  "claims": [
    { "typ": "preferred_username", "val": "octocat" },
    { "typ": "name", "val": "The Octocat" }
  ],
  "userId": "12345678",
  "userDetails": "octocat"
}
```

### Protected Pages

The following pages require authentication (enforced by EasyAuth at the platform level):

- **Scanned Repository Tiles** (`/`) - Only authenticated users can view scan results
- **Leaderboards** (`/leaderboards.html`) - Only authenticated users can view leaderboards
- **Setup** (`/setup.html`) - Only authorized users (from `SETUP_ALLOWED_USERS`) can access

### Middleware Implementation

The Express server includes middleware to extract EasyAuth information:

```typescript
import { easyAuthMiddleware, requireEasyAuth } from "./middleware";

// Extract auth info on all requests (doesn't enforce)
app.use(easyAuthMiddleware);

// Protect specific routes
router.post("/api/v4/setup", requireEasyAuth, (req, res) => {
  const username = req.easyAuth.username;
  // ... handle request
});
```

## Local Development

During local development, EasyAuth headers are not present. The application falls back to:

1. Standard GitHub OAuth flow (using the existing `auth.ts` implementation)
2. Token stored in localStorage
3. Frontend authentication checks remain functional

To test locally:

```bash
# Use docker-compose (no EasyAuth)
docker-compose up

# Or use dev servers
cd packages/server && npm run dev  # Terminal 1
cd packages/app && npm run dev     # Terminal 2
```

## Troubleshooting

### "Redirect loop" or "Too many redirects"

**Cause**: OAuth callback URL mismatch between GitHub app and Azure configuration.

**Solution**: 
1. Get your app's FQDN: `az containerapp show --name template-doctor --resource-group template-doctor-rg --query properties.configuration.ingress.fqdn`
2. Update GitHub OAuth app callback URL to: `https://YOUR_FQDN/.auth/login/github/callback`

### "Client secret not found"

**Cause**: Secret reference name mismatch in Bicep template.

**Solution**: Verify the secret is created with the correct name in `main.bicep`:
```bicep
secrets: [
  {
    name: 'github-client-secret'
    value: githubClientSecret
  }
]
```

And referenced correctly in auth config:
```bicep
clientSecretSettingName: 'github-client-secret'
```

### Health check shows `authenticated: false`

**Cause**: Either not logged in, or EasyAuth headers not being forwarded.

**Solution**:
1. Check health endpoint: `curl https://YOUR_APP_FQDN/api/health`
2. If `easyAuth.enabled: false`, EasyAuth headers are not present
3. Verify auth config: `az containerapp auth show --name template-doctor --resource-group template-doctor-rg`
4. Try logging in: Navigate to `https://YOUR_APP_FQDN` in a browser

### Users can't access setup page

**Cause**: Username not in `SETUP_ALLOWED_USERS` environment variable.

**Solution**:
1. Update the container app environment variable:
```bash
az containerapp update \
  --name template-doctor \
  --resource-group template-doctor-rg \
  --set-env-vars SETUP_ALLOWED_USERS="user1,user2,user3"
```
2. Restart may be needed for changes to take effect

## Updating the Deployment

### Update Application Code

```bash
# Build new image
docker build -t template-doctor:v2 -f Dockerfile.combined .
docker tag template-doctor:v2 YOUR_REGISTRY.azurecr.io/template-doctor:v2
docker push YOUR_REGISTRY.azurecr.io/template-doctor:v2

# Update container app
az containerapp update \
  --name template-doctor \
  --resource-group template-doctor-rg \
  --image YOUR_REGISTRY.azurecr.io/template-doctor:v2
```

### Update Environment Variables

```bash
az containerapp update \
  --name template-doctor \
  --resource-group template-doctor-rg \
  --set-env-vars \
    DEFAULT_RULE_SET="dod" \
    REQUIRE_AUTH_FOR_RESULTS="true"
```

### Update Secrets

```bash
# Update GitHub token
az containerapp secret set \
  --name template-doctor \
  --resource-group template-doctor-rg \
  --secrets github-token="ghp_newtoken"
```

## Security Considerations

1. **Secrets Management**: 
   - Never commit `main.parameters.json` or `.env` files
   - Use Azure Key Vault for production secrets (advanced setup)
   - Rotate GitHub tokens regularly

2. **Authorization**:
   - EasyAuth handles authentication (who you are)
   - Application code handles authorization (what you can do)
   - Always check `SETUP_ALLOWED_USERS` for admin operations

3. **Network Security**:
   - Container Apps use HTTPS by default
   - EasyAuth cookies are HTTP-only and secure
   - No direct container access from internet

4. **Managed Identity**:
   - User-assigned managed identity is created
   - Use it for Azure service authentication (future enhancement)
   - No need to store Azure credentials in environment variables

## Monitoring

### View Logs

```bash
# Application logs
az containerapp logs show \
  --name template-doctor \
  --resource-group template-doctor-rg \
  --follow

# System logs
az containerapp logs show \
  --name template-doctor \
  --resource-group template-doctor-rg \
  --type system
```

### Metrics

```bash
# CPU and memory usage
az monitor metrics list \
  --resource /subscriptions/YOUR_SUB/resourceGroups/template-doctor-rg/providers/Microsoft.App/containerApps/template-doctor \
  --metric "UsageNanoCores" \
  --metric "WorkingSetBytes"
```

### Health Check

```bash
# Check health endpoint
curl https://YOUR_APP_FQDN/api/health

# Expected response includes:
# {
#   "status": "ok",
#   "easyAuth": {
#     "enabled": true,
#     "authenticated": true,
#     "username": "your-github-username"
#   }
# }
```

## Cost Optimization

- **Scale to Zero**: Not recommended for this app (authentication state may be lost)
- **Minimum Replicas**: Set to 1 for production
- **Maximum Replicas**: Increase based on load (current: 3)
- **Resource Limits**: Adjust CPU/memory in `main.bicep` based on usage

## Additional Resources

- [Azure Container Apps Documentation](https://docs.microsoft.com/azure/container-apps/)
- [EasyAuth Documentation](https://docs.microsoft.com/azure/container-apps/authentication)
- [GitHub OAuth Apps](https://docs.github.com/developers/apps/building-oauth-apps)
- [Template Doctor Architecture](../development/architecture.md)

## Support

For issues related to:
- Infrastructure deployment: Check Bicep template validation
- Authentication: Verify GitHub OAuth app settings
- Application errors: Check container logs
- Permission issues: Verify `SETUP_ALLOWED_USERS` configuration
