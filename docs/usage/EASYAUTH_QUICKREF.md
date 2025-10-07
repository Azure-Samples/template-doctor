# EasyAuth Quick Reference

## 🚀 Quick Deploy

```bash
# 1. Build image
docker build -t template-doctor:latest -f Dockerfile.combined .
docker tag template-doctor:latest YOUR_REGISTRY.azurecr.io/template-doctor:latest
docker push YOUR_REGISTRY.azurecr.io/template-doctor:latest

# 2. Configure
cp infra/main.parameters.json.example infra/main.parameters.json
# Edit with your values

# 3. Deploy
./infra/deploy.sh

# 4. Update GitHub OAuth App
# Homepage: https://YOUR_APP_FQDN
# Callback: https://YOUR_APP_FQDN/.auth/login/github/callback
```

## 📝 Required Parameters

In `infra/main.parameters.json`:

| Parameter | Example | Where to Get |
|-----------|---------|------------- |
| `containerImage` | `myregistry.azurecr.io/template-doctor:latest` | Your container registry |
| `githubClientId` | `Iv1.abc123...` | GitHub OAuth App settings |
| `githubClientSecret` | `abc123def456...` | GitHub OAuth App → Generate new secret |
| `githubToken` | `ghp_abc123...` | GitHub → Settings → Developer settings → PAT |
| `ghWorkflowToken` | `ghp_xyz789...` | GitHub → Settings → Developer settings → PAT |
| `setupAllowedUsers` | `user1,user2` | GitHub usernames (comma-separated) |

## 🔐 Protected Resources

| Resource | Auth Required | Authorization |
|----------|---------------|---------------|
| Home (tiles) | ✅ GitHub login | Any authenticated user |
| Leaderboards | ✅ GitHub login | Any authenticated user |
| Setup | ✅ GitHub login | Must be in `SETUP_ALLOWED_USERS` |
| API endpoints | ✅ GitHub login | Varies by endpoint |

## 🔍 Debugging

```bash
# Check health
curl https://YOUR_APP_FQDN/api/health

# View logs
az containerapp logs show --name template-doctor --resource-group template-doctor-rg --follow

# Check auth config
az containerapp auth show --name template-doctor --resource-group template-doctor-rg

# Get app URL
az deployment group show --resource-group template-doctor-rg --name main --query properties.outputs.containerAppUrl.value -o tsv
```

## 🛠️ Common Tasks

### Update Container Image

```bash
docker build -t template-doctor:v2 -f Dockerfile.combined .
docker tag template-doctor:v2 YOUR_REGISTRY.azurecr.io/template-doctor:v2
docker push YOUR_REGISTRY.azurecr.io/template-doctor:v2

az containerapp update \
  --name template-doctor \
  --resource-group template-doctor-rg \
  --image YOUR_REGISTRY.azurecr.io/template-doctor:v2
```

### Update Allowed Users

```bash
az containerapp update \
  --name template-doctor \
  --resource-group template-doctor-rg \
  --set-env-vars SETUP_ALLOWED_USERS="user1,user2,user3"
```

### Update Secrets

```bash
az containerapp secret set \
  --name template-doctor \
  --resource-group template-doctor-rg \
  --secrets github-token="ghp_newtoken"
```

### Scale Manually

```bash
# Set min/max replicas
az containerapp update \
  --name template-doctor \
  --resource-group template-doctor-rg \
  --min-replicas 2 \
  --max-replicas 5
```

## 🐛 Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Redirect loop | OAuth callback URL mismatch | Update GitHub OAuth app callback to `https://YOUR_APP_FQDN/.auth/login/github/callback` |
| "Not authenticated" | EasyAuth not enabled | Check `az containerapp auth show` |
| 403 on /setup | Not in allowed users | Add username to `SETUP_ALLOWED_USERS` |
| 500 errors | Missing env vars | Check container logs |
| Health check fails | Container not running | Check logs: `az containerapp logs show` |

## 📚 Documentation Links

- **Full Guide**: [EASYAUTH.md](../EASYAUTH.md)
- **Deployment**: [docs/usage/CONTAINER_APPS_EASYAUTH.md](CONTAINER_APPS_EASYAUTH.md)
- **Testing**: [docs/usage/EASYAUTH_TESTING.md](EASYAUTH_TESTING.md)
- **Environment Variables**: [docs/development/ENVIRONMENT_VARIABLES.md](../development/ENVIRONMENT_VARIABLES.md)

## 🔑 EasyAuth Headers (For Development)

When logged in, Azure injects these headers:

```
X-MS-CLIENT-PRINCIPAL: <base64-encoded-json>
X-MS-CLIENT-PRINCIPAL-ID: <user-id>
X-MS-CLIENT-PRINCIPAL-NAME: <github-username>
X-MS-CLIENT-PRINCIPAL-IDP: github
```

Access in Express:
```typescript
const username = req.easyAuth?.username;
const isAuthenticated = req.easyAuth?.isAuthenticated;
```

## 💡 Tips

- **Local Dev**: Works without EasyAuth, uses regular OAuth
- **Secrets**: Never commit `infra/main.parameters.json`
- **Testing**: Use `az containerapp logs show --follow` to watch logs in real-time
- **Monitoring**: Check health endpoint regularly: `/api/health`
- **Performance**: App auto-scales 1-3 replicas based on load
- **Cost**: Use `az containerapp update` to adjust resources (CPU/memory)

## 🎯 Next Steps

After deployment:
1. ✅ Test authentication flow (visit app in browser)
2. ✅ Verify protected pages (tiles, leaderboards, setup)
3. ✅ Check health endpoint
4. ✅ Review logs for errors
5. ⏳ Set up monitoring/alerts
6. ⏳ Configure CI/CD pipeline
