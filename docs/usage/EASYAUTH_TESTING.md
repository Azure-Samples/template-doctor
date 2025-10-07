# EasyAuth Testing and Verification Guide

This document provides steps to test and verify the EasyAuth integration for Azure Container Apps.

## Local Testing (Without EasyAuth)

Before deploying to Azure, verify that local development still works correctly:

### 1. Start Local Development Environment

```bash
# Option A: Docker Compose
docker-compose up

# Option B: Manual (two terminals)
# Terminal 1
cd packages/server && npm run dev

# Terminal 2
cd packages/app && npm run dev
```

### 2. Verify Health Endpoint

```bash
curl http://localhost:3001/api/health
```

Expected response (local development without EasyAuth):
```json
{
  "status": "ok",
  "timestamp": "2025-01-07T12:00:00.000Z",
  "env": {
    "hasGitHubToken": true,
    "hasWorkflowToken": true,
    "hasAnalyzerToken": false
  },
  "easyAuth": {
    "enabled": true,
    "authenticated": false,
    "username": null,
    "provider": null
  }
}
```

**Key Points**:
- `easyAuth.enabled` should be `true` (middleware is loaded)
- `easyAuth.authenticated` should be `false` (no EasyAuth headers)
- Application should work normally with OAuth flow

### 3. Test OAuth Flow

1. Visit http://localhost:4000 (or http://localhost:3000 for preview)
2. Click "Login with GitHub"
3. Authorize the app on GitHub
4. Should redirect back and show authenticated state
5. Token should be stored in localStorage

### 4. Test Protected Pages

After logging in locally:

**Leaderboards**:
- Visit http://localhost:4000/leaderboards.html
- Should show leaderboards (fake data)
- If not logged in, should redirect to home

**Setup** (if your username is in SETUP_ALLOWED_USERS):
- Visit http://localhost:4000/setup.html
- Should show setup page
- Can modify configuration settings

## Azure Container Apps Testing (With EasyAuth)

After deploying to Azure Container Apps:

### 1. Verify Deployment

```bash
# Get deployment outputs
az deployment group show \
  --resource-group template-doctor-rg \
  --name main \
  --query properties.outputs

# Expected outputs:
# - containerAppFQDN: "template-doctor.xxx.azurecontainerapps.io"
# - containerAppUrl: "https://template-doctor.xxx.azurecontainerapps.io"
# - managedIdentityPrincipalId: "..."
# - managedIdentityClientId: "..."
```

### 2. Verify EasyAuth Configuration

```bash
# Get container app name
APP_NAME=$(az containerapp list \
  --resource-group template-doctor-rg \
  --query "[0].name" \
  --output tsv)

# Check auth configuration
az containerapp auth show \
  --name $APP_NAME \
  --resource-group template-doctor-rg
```

**Expected configuration**:
```json
{
  "platform": {
    "enabled": true
  },
  "globalValidation": {
    "unauthenticatedClientAction": "RedirectToLoginPage",
    "redirectToProvider": "github"
  },
  "identityProviders": {
    "gitHub": {
      "enabled": true,
      "registration": {
        "clientId": "YOUR_CLIENT_ID",
        "clientSecretSettingName": "github-client-secret"
      },
      "login": {
        "scopes": ["read:user", "public_repo"]
      }
    }
  }
}
```

### 3. Test Authentication Flow

**First Visit (Unauthenticated)**:

1. Open a private/incognito browser window
2. Visit `https://YOUR_APP_FQDN` (from deployment outputs)
3. **Expected**: Automatic redirect to GitHub OAuth
4. Authorize the app on GitHub
5. **Expected**: Redirect back to app with authentication headers
6. **Expected**: App shows authenticated state

**Subsequent Visits (Authenticated)**:

1. Visit `https://YOUR_APP_FQDN` in the same browser
2. **Expected**: No redirect, directly shows app
3. **Expected**: Authentication cookie is present

### 4. Test Health Endpoint

```bash
# Test without authentication (should redirect to login)
curl -I https://YOUR_APP_FQDN/api/health

# Test with browser (after login)
# Visit https://YOUR_APP_FQDN/api/health
```

**Expected response (authenticated)**:
```json
{
  "status": "ok",
  "timestamp": "2025-01-07T12:00:00.000Z",
  "env": {
    "hasGitHubToken": true,
    "hasWorkflowToken": true,
    "hasAnalyzerToken": false
  },
  "easyAuth": {
    "enabled": true,
    "authenticated": true,
    "username": "your-github-username",
    "provider": "github"
  }
}
```

### 5. Test Protected Resources

**Scanned Repository Tiles**:
- Visit `https://YOUR_APP_FQDN`
- **Expected**: After login, see scanned repository tiles
- **Without login**: Redirected to GitHub OAuth

**Leaderboards**:
- Visit `https://YOUR_APP_FQDN/leaderboards.html`
- **Expected**: After login, see leaderboards
- **Without login**: Redirected to GitHub OAuth

**Setup Page** (requires username in SETUP_ALLOWED_USERS):
- Visit `https://YOUR_APP_FQDN/setup.html`
- **Expected with allowed user**: See setup page
- **Expected with non-allowed user**: Show error or redirect

### 6. Test Authorization (Setup Endpoint)

**With Allowed User** (username in SETUP_ALLOWED_USERS):

```bash
# Get current configuration
curl https://YOUR_APP_FQDN/api/v4/setup

# Expected: 200 OK with current config
```

**With Non-Allowed User**:

```bash
# Attempt to access setup
curl https://YOUR_APP_FQDN/api/v4/setup
```

Expected: 403 Forbidden with error message:
```json
{
  "error": "Access denied",
  "message": "User <username> is not authorized to access this endpoint"
}
```

### 7. Test Logout

```bash
# Visit logout endpoint
curl https://YOUR_APP_FQDN/.auth/logout

# Or visit in browser:
# https://YOUR_APP_FQDN/.auth/logout?post_logout_redirect_uri=/
```

**Expected**:
- Authentication cookie is cleared
- Redirected to home page
- Next visit requires re-authentication

## Monitoring and Debugging

### View Application Logs

```bash
# Follow application logs
az containerapp logs show \
  --name template-doctor \
  --resource-group template-doctor-rg \
  --follow

# Check for authentication-related logs:
# - EasyAuth middleware extracting user info
# - Authorization checks for /setup endpoint
# - Any authentication errors
```

### View System Logs

```bash
# System logs (EasyAuth platform logs)
az containerapp logs show \
  --name template-doctor \
  --resource-group template-doctor-rg \
  --type system
```

### Check EasyAuth Headers

Add logging to Express routes to inspect headers:

```typescript
// In any route handler
console.log('EasyAuth Headers:', {
  principalId: req.headers['x-ms-client-principal-id'],
  principalName: req.headers['x-ms-client-principal-name'],
  principalIdp: req.headers['x-ms-client-principal-idp'],
  principal: req.headers['x-ms-client-principal']
});

console.log('Parsed EasyAuth:', req.easyAuth);
```

## Common Issues and Solutions

### Issue: Redirect Loop

**Symptom**: Browser keeps redirecting between app and GitHub  
**Cause**: OAuth callback URL mismatch  
**Solution**:
1. Get your app FQDN:
   ```bash
   az containerapp show --name template-doctor --resource-group template-doctor-rg --query properties.configuration.ingress.fqdn -o tsv
   ```
2. Update GitHub OAuth app callback URL to:
   ```
   https://<FQDN>/.auth/login/github/callback
   ```

### Issue: "Client secret not found"

**Symptom**: EasyAuth configuration fails  
**Cause**: Secret reference name mismatch  
**Solution**: Verify in Bicep template that:
```bicep
secrets: [
  {
    name: 'github-client-secret'  // Must match clientSecretSettingName
    value: githubClientSecret
  }
]
```

### Issue: Health Check Shows `authenticated: false`

**Symptom**: Health endpoint returns `easyAuth.authenticated: false`  
**Cause**: Either not logged in, or EasyAuth headers not being forwarded  
**Solution**:
1. Verify you're logged in (visit app in browser)
2. Check EasyAuth config: `az containerapp auth show`
3. Check application logs for header values

### Issue: Can't Access Setup Page

**Symptom**: 403 Forbidden when accessing /setup  
**Cause**: Username not in SETUP_ALLOWED_USERS  
**Solution**:
```bash
# Update environment variable
az containerapp update \
  --name template-doctor \
  --resource-group template-doctor-rg \
  --set-env-vars SETUP_ALLOWED_USERS="user1,user2,user3"

# Restart may be needed
az containerapp revision restart \
  --name template-doctor \
  --resource-group template-doctor-rg
```

### Issue: 500 Internal Server Error

**Symptom**: App returns 500 errors  
**Cause**: Missing environment variables or configuration  
**Solution**:
1. Check container logs:
   ```bash
   az containerapp logs show --name template-doctor --resource-group template-doctor-rg --follow
   ```
2. Verify all required environment variables are set:
   - GITHUB_CLIENT_ID
   - GITHUB_CLIENT_SECRET
   - GITHUB_TOKEN
   - GH_WORKFLOW_TOKEN

## Testing Checklist

Before considering the deployment complete, verify:

- [ ] Health endpoint returns 200 OK
- [ ] Health endpoint shows `easyAuth.authenticated: true` when logged in
- [ ] Unauthenticated users are redirected to GitHub OAuth
- [ ] After GitHub authorization, users are redirected back to app
- [ ] Authentication cookie persists across page reloads
- [ ] Scanned repository tiles are visible after login
- [ ] Leaderboards page is accessible after login
- [ ] Setup page is accessible only to allowed users (403 for others)
- [ ] Logout clears authentication cookie
- [ ] Application logs show EasyAuth headers being received
- [ ] No errors in application logs related to authentication

## Performance Testing

### Load Testing

```bash
# Simple load test (requires ab - Apache Bench)
ab -n 1000 -c 10 https://YOUR_APP_FQDN/api/health

# Expected:
# - All requests should succeed (200 OK)
# - Consistent response times
# - No authentication errors
```

### Scaling Verification

```bash
# Check current replica count
az containerapp replica list \
  --name template-doctor \
  --resource-group template-doctor-rg

# Generate load and watch scaling
watch -n 5 'az containerapp replica list --name template-doctor --resource-group template-doctor-rg'

# Expected:
# - Replicas increase under load (up to maxReplicas: 3)
# - Replicas decrease when load subsides (down to minReplicas: 1)
```

## Security Testing

### Test Token Validation

Try accessing with invalid/expired tokens:

```bash
# Try with invalid token (should fail/redirect)
curl -H "Authorization: Bearer invalid_token" https://YOUR_APP_FQDN/api/v4/analyze

# Expected: Redirect to login or 401 Unauthorized
```

### Test Authorization Bypass

Try accessing protected endpoints without authentication:

```bash
# Try accessing setup without auth (should fail)
curl https://YOUR_APP_FQDN/api/v4/setup

# Expected: Redirect to login
```

### Verify HTTPS

```bash
# Verify HTTPS is enforced
curl -I http://YOUR_APP_FQDN

# Expected: Redirect to https://YOUR_APP_FQDN
```

## Next Steps After Testing

Once all tests pass:

1. ✅ Verify all authentication flows work
2. ✅ Check application logs for any errors
3. ✅ Test with multiple users
4. ✅ Verify authorization (setup page access)
5. ⏳ Set up monitoring and alerts
6. ⏳ Configure CI/CD pipeline for automated deployments
7. ⏳ Document any environment-specific configuration
8. ⏳ Train team members on the new deployment process

## Support

If you encounter issues not covered in this guide:

1. Check application logs: `az containerapp logs show --name template-doctor --resource-group template-doctor-rg --follow`
2. Review [troubleshooting guide](../usage/CONTAINER_APPS_EASYAUTH.md#troubleshooting)
3. Verify [environment variables](../development/ENVIRONMENT_VARIABLES.md)
4. Check Azure Container Apps [documentation](https://docs.microsoft.com/azure/container-apps/)
