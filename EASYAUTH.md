# EasyAuth Integration for Azure Container Apps

This document provides a quick overview of the EasyAuth integration for Template Doctor when deploying to Azure Container Apps.

## What is EasyAuth?

EasyAuth (Easy Authentication) is a built-in authentication feature of Azure Container Apps that handles authentication without requiring code changes. It provides:

- Automatic redirect to GitHub OAuth for unauthenticated users
- Session management and cookie handling
- User identity injection via HTTP headers
- No application code changes required for basic authentication

## What Was Added

This implementation adds the necessary infrastructure and middleware to deploy Template Doctor to Azure Container Apps with GitHub authentication via EasyAuth.

### Infrastructure (Bicep Templates)

- **`infra/main.bicep`**: Complete Azure Container Apps deployment with EasyAuth configuration
- **`infra/main.parameters.json.example`**: Example parameters file (copy to `main.parameters.json` to use)
- **`infra/deploy.sh`**: Deployment script for easy deployment
- **`infra/README.md`**: Infrastructure documentation

### Middleware (Express Server)

- **`packages/server/src/middleware/easyauth.ts`**: 
  - Extracts user identity from EasyAuth headers (`X-MS-CLIENT-PRINCIPAL-*`)
  - Provides `req.easyAuth` object with authentication state
  - Includes `requireEasyAuth()` middleware to protect routes
  - Includes `requireAllowedUser()` middleware for admin-only endpoints

- **`packages/server/src/middleware/cors.ts`**: CORS handling for API endpoints
- **`packages/server/src/middleware/error-handler.ts`**: Centralized error handling

### Server Updates

- **`packages/server/src/index.ts`**: Updated to use EasyAuth middleware on all requests
- Health check endpoint (`/api/health`) now includes EasyAuth status for debugging

### Documentation

- **`docs/usage/CONTAINER_APPS_EASYAUTH.md`**: Complete deployment guide with troubleshooting
- **`docs/development/ENVIRONMENT_VARIABLES.md`**: Updated with EasyAuth-related variables

## Protected Resources

With EasyAuth enabled, the following resources are automatically protected:

✅ **Scanned Repository Tiles** - Only authenticated users can view scan results  
✅ **Leaderboards** - Only authenticated users can access  
✅ **Setup Page** - Only users in `SETUP_ALLOWED_USERS` can access  
✅ **All API Endpoints** - Authentication headers are validated

## How It Works

### Production (Azure Container Apps with EasyAuth)

1. User visits the app URL
2. Azure detects no authentication cookie → redirects to GitHub OAuth
3. User authorizes the app on GitHub
4. Azure exchanges code for token and sets authentication cookie
5. Azure redirects user back to app with authentication headers injected
6. Express middleware extracts identity from headers
7. Protected pages/endpoints verify authentication

### Local Development (No EasyAuth)

1. User visits `http://localhost:4000` or `http://localhost:3000`
2. Frontend detects no token in localStorage
3. Frontend shows "Login with GitHub" button
4. User clicks login → redirects to GitHub OAuth
5. GitHub redirects back to `/callback.html`
6. Frontend exchanges code for token via Express `/api/v4/github-oauth-token`
7. Token is stored in localStorage
8. Protected pages check for token in localStorage

**Key Point**: Local development continues to work exactly as before. EasyAuth middleware gracefully handles the absence of EasyAuth headers.

## Deployment Quick Start

1. **Build and push container image**:
   ```bash
   docker build -t template-doctor:latest -f Dockerfile.combined .
   docker tag template-doctor:latest YOUR_REGISTRY.azurecr.io/template-doctor:latest
   docker push YOUR_REGISTRY.azurecr.io/template-doctor:latest
   ```

2. **Configure parameters**:
   ```bash
   cp infra/main.parameters.json.example infra/main.parameters.json
   # Edit main.parameters.json with your values
   ```

3. **Deploy**:
   ```bash
   ./infra/deploy.sh
   ```

4. **Update GitHub OAuth App**:
   - Homepage URL: `https://YOUR_APP_FQDN`
   - Callback URL: `https://YOUR_APP_FQDN/.auth/login/github/callback`

See [`docs/usage/CONTAINER_APPS_EASYAUTH.md`](docs/usage/CONTAINER_APPS_EASYAUTH.md) for detailed instructions.

## Authentication Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Azure Container Apps (Production)                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. User visits app                                                 │
│     ↓                                                               │
│  2. EasyAuth checks for auth cookie                                 │
│     ↓                                                               │
│  3. No cookie? → Redirect to GitHub OAuth                           │
│     ↓                                                               │
│  4. User authorizes on GitHub                                       │
│     ↓                                                               │
│  5. GitHub redirects to /.auth/login/github/callback                │
│     ↓                                                               │
│  6. EasyAuth exchanges code for token                               │
│     ↓                                                               │
│  7. EasyAuth sets auth cookie                                       │
│     ↓                                                               │
│  8. EasyAuth injects headers:                                       │
│     - X-MS-CLIENT-PRINCIPAL (base64 JSON)                           │
│     - X-MS-CLIENT-PRINCIPAL-ID                                      │
│     - X-MS-CLIENT-PRINCIPAL-NAME                                    │
│     - X-MS-CLIENT-PRINCIPAL-IDP                                     │
│     ↓                                                               │
│  9. Request forwarded to Express with headers                       │
│     ↓                                                               │
│ 10. easyAuthMiddleware extracts user info                           │
│     ↓                                                               │
│ 11. Route handler accesses req.easyAuth.username                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Code Examples

### Protecting a Route

```typescript
import { requireEasyAuth } from "./middleware";

// Require authentication
router.post("/api/v4/analyze", requireEasyAuth, (req, res) => {
  const username = req.easyAuth.username;
  // ... handle request
});
```

### Admin-Only Endpoint

```typescript
import { requireAllowedUser } from "./middleware";

// Only users in SETUP_ALLOWED_USERS can access
router.post("/api/v4/setup", requireAllowedUser(), (req, res) => {
  const username = req.easyAuth.username;
  // ... handle request
});
```

### Checking Authentication in Frontend

No changes needed! The existing authentication checks continue to work:

```typescript
// packages/app/src/scripts/auth.ts
const token = localStorage.getItem('gh_access_token');
if (!token) {
  // Show login button
}
```

In production with EasyAuth, the user will never see the login button because Azure redirects them before the page loads.

## Monitoring and Debugging

### Health Check

The `/api/health` endpoint includes EasyAuth status:

```bash
curl https://YOUR_APP_FQDN/api/health
```

Response:
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
    "username": "octocat",
    "provider": "github"
  }
}
```

### Viewing Logs

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

## Security Features

✅ **HTTPS by default** - All traffic is encrypted  
✅ **HTTP-only cookies** - Authentication cookies cannot be accessed by JavaScript  
✅ **Token validation** - EasyAuth validates tokens with GitHub  
✅ **No credential storage** - Application never handles OAuth secrets  
✅ **Managed Identity** - Use for Azure service authentication (future)  
✅ **Authorization checks** - `SETUP_ALLOWED_USERS` restricts admin access  

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Redirect loop | Update GitHub OAuth app callback URL to match Azure FQDN |
| "Not authenticated" | Check EasyAuth configuration: `az containerapp auth show` |
| Can't access /setup | Add username to `SETUP_ALLOWED_USERS` environment variable |
| Health check shows `authenticated: false` | Either not logged in or EasyAuth not configured |

See [troubleshooting guide](docs/usage/CONTAINER_APPS_EASYAUTH.md#troubleshooting) for more details.

## Next Steps

1. ✅ Infrastructure and middleware implemented
2. ⏳ Deploy to Azure Container Apps
3. ⏳ Configure GitHub OAuth app
4. ⏳ Test authentication flow
5. ⏳ Monitor application logs
6. ⏳ Set up CI/CD pipeline for automated deployments

## Related Documentation

- [Azure Container Apps EasyAuth Deployment Guide](docs/usage/CONTAINER_APPS_EASYAUTH.md) - Complete deployment instructions
- [Environment Variables](docs/development/ENVIRONMENT_VARIABLES.md) - Configuration reference
- [Infrastructure README](infra/README.md) - Bicep template documentation
- [Azure Container Apps Docs](https://docs.microsoft.com/azure/container-apps/)
- [EasyAuth Documentation](https://docs.microsoft.com/azure/container-apps/authentication)
