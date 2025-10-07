# Infrastructure as Code - Azure Container Apps

This directory contains Bicep templates for deploying Template Doctor to Azure Container Apps with EasyAuth (Easy Authentication) enabled.

## Files

- **main.bicep**: Main Bicep template defining all Azure resources
- **main.parameters.json.example**: Example parameters file (copy to main.parameters.json and fill in values)
- **main.parameters.json**: Your actual parameters file (gitignored, contains secrets)

## Quick Start

1. **Copy example parameters file**:
   ```bash
   cp main.parameters.json.example main.parameters.json
   ```

2. **Edit parameters** - Fill in your actual values:
   ```bash
   # Required values:
   - containerImage: Your container registry image path
   - githubClientId: GitHub OAuth Client ID
   - githubClientSecret: GitHub OAuth Client Secret
   - githubToken: GitHub Personal Access Token
   - ghWorkflowToken: GitHub Workflow Token
   - setupAllowedUsers: Comma-separated list of GitHub usernames
   ```

3. **Deploy**:
   ```bash
   # Create resource group
   az group create --name template-doctor-rg --location eastus

   # Deploy template
   az deployment group create \
     --resource-group template-doctor-rg \
     --template-file main.bicep \
     --parameters @main.parameters.json
   ```

## What Gets Deployed

The Bicep template creates:

1. **Log Analytics Workspace** - For container logs and monitoring
2. **Container Apps Environment** - Managed environment for container apps
3. **User Assigned Managed Identity** - For Azure service authentication
4. **Container App** - The Template Doctor application with:
   - External ingress (HTTPS)
   - Health probes (liveness and readiness)
   - Auto-scaling (1-3 replicas)
   - Environment variables and secrets
5. **EasyAuth Configuration** - GitHub authentication with:
   - Redirect unauthenticated users to GitHub login
   - OAuth scopes: `read:user`, `public_repo`
   - Session management

## EasyAuth Protected Resources

With EasyAuth enabled, the following are protected:

- **All pages** - Unauthenticated users are redirected to GitHub login
- **Scanned repository tiles** - Only authenticated users can view
- **Leaderboards** - Only authenticated users can access
- **Setup page** - Only users in `SETUP_ALLOWED_USERS` can access
- **All API endpoints** - EasyAuth headers are validated

## Environment Variables

The following environment variables are configured in the container:

### Required (from secrets):
- `GITHUB_CLIENT_ID` - OAuth client ID
- `GITHUB_CLIENT_SECRET` - OAuth client secret
- `GITHUB_TOKEN` - GitHub PAT for API calls
- `GH_WORKFLOW_TOKEN` - Token for workflow dispatch

### Optional (from parameters):
- `DEFAULT_RULE_SET` - Default validation ruleset (default: "dod")
- `REQUIRE_AUTH_FOR_RESULTS` - Require auth for viewing results (default: true)
- `ARCHIVE_ENABLED` - Enable archiving (default: false)
- `ARCHIVE_COLLECTION` - Archive collection name (default: "aigallery")
- `DISPATCH_TARGET_REPO` - Target repo for workflows (default: "Template-Doctor/template-doctor")
- `ISSUE_AI_ENABLED` - Enable AI issue assistance (default: false)
- `SETUP_ALLOWED_USERS` - Comma-separated GitHub usernames for setup access
- `CONFIG_GIST_ID` - GitHub Gist ID for config persistence

## Customization

### Adjust Container Resources

Edit `main.bicep` to change CPU and memory:

```bicep
resources: {
  cpu: json('0.5')      // 0.5 vCPU
  memory: '1Gi'         // 1 GB memory
}
```

### Change Scaling Rules

Edit `main.bicep` to adjust auto-scaling:

```bicep
scale: {
  minReplicas: 1        // Minimum replicas
  maxReplicas: 3        // Maximum replicas
  rules: [
    {
      name: 'http-scaling'
      http: {
        metadata: {
          concurrentRequests: '10'  // Scale threshold
        }
      }
    }
  ]
}
```

### Modify Health Checks

Edit `main.bicep` to change probe settings:

```bicep
probes: [
  {
    type: 'Liveness'
    httpGet: {
      path: '/api/health'
      port: targetPort
    }
    initialDelaySeconds: 10
    periodSeconds: 10
    failureThreshold: 3
  }
]
```

## Security Best Practices

1. **Never commit main.parameters.json** - This file contains secrets and is gitignored
2. **Use strong tokens** - Generate PATs with minimal required scopes
3. **Rotate secrets regularly** - Update tokens every 90 days
4. **Limit setup users** - Only add trusted usernames to SETUP_ALLOWED_USERS
5. **Use Azure Key Vault** - For production, consider Key Vault integration (advanced)

## Outputs

After deployment, the template outputs:

- `containerAppFQDN` - The fully qualified domain name of your app
- `containerAppUrl` - The full HTTPS URL to access the app
- `managedIdentityPrincipalId` - Principal ID of the managed identity
- `managedIdentityClientId` - Client ID of the managed identity

Retrieve outputs:

```bash
az deployment group show \
  --resource-group template-doctor-rg \
  --name main \
  --query properties.outputs
```

## Updating the Deployment

### Update Container Image

```bash
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
  --set-env-vars REQUIRE_AUTH_FOR_RESULTS="true"
```

### Update Secrets

```bash
az containerapp secret set \
  --name template-doctor \
  --resource-group template-doctor-rg \
  --secrets github-token="ghp_newtoken"
```

## Troubleshooting

See the [deployment guide](../docs/usage/CONTAINER_APPS_EASYAUTH.md) for detailed troubleshooting steps.

Common issues:
- **Redirect loop**: Check OAuth callback URL matches Azure FQDN
- **Auth not working**: Verify GitHub OAuth app credentials
- **500 errors**: Check container logs with `az containerapp logs show`
- **Can't access setup**: Add your username to SETUP_ALLOWED_USERS

## Related Documentation

- [Azure Container Apps EasyAuth Deployment Guide](../docs/usage/CONTAINER_APPS_EASYAUTH.md)
- [Environment Variables Reference](../docs/development/ENVIRONMENT_VARIABLES.md)
- [OAuth Configuration Guide](../docs/development/OAUTH_CONFIGURATION.md)
