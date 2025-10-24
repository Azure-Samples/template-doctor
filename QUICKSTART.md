# Quick Start Guide - Template Doctor

## 🚀 First Time Setup (5 minutes)

### Step 1: Prerequisites
```bash
# Install Docker Desktop
# https://www.docker.com/products/docker-desktop

# Verify installation
docker --version
docker-compose --version
```

### Step 2: Clone Repository
```bash
git clone https://github.com/Azure-Samples/template-doctor.git
cd template-doctor
```

### Step 3: Run Setup Script
```bash
./scripts/full-setup.sh
```

**Choose these options:**
1. **GitHub OAuth**: Option 1 or 2 (create new or use existing)
2. **GitHub PAT**: Create token with `repo`, `workflow`, `read:user` scopes
3. **MongoDB**: **Option 1** - Local development ✅
4. **Admin Users**: Enter your GitHub username
5. **Dispatch Repo**: Your fork or leave for manual setup

### Step 4: Start Application
```bash
docker-compose --profile combined up
```

Wait for:
```
✓ MongoDB container started
✓ Express backend + Vite frontend started on port 3000
```

### Step 5: Open Application
```
http://localhost:3000
```

Click "Sign in with GitHub" and you're ready! 🎉

---

## 🔄 Quick Redeploy (Already Configured)

If you already have `.env` configured and just need to redeploy to Azure:

```bash
./scripts/full-setup.sh --deploy
```

This command:
- ✅ Skips all configuration prompts
- ✅ Validates existing `.env` file
- ✅ Checks for Template Doctor updates
- ✅ Installs dependencies and builds packages
- ✅ Deploys to Azure (runs `azd provision` + `deploy.sh`)

**When to use**: After initial setup, for quick updates or redeployments to Azure.

**Input flexibility**: All setup prompts support multiple input methods:
- **Press Enter**: Uses the default (shown in capital letter, e.g., `[Y/n]`)
- **Type 1**: Yes/Option 1
- **Type 2**: No/Option 2
- **Type y/n**: Traditional yes/no input

---

## ⚠️ Common Mistakes (DON'T DO THIS!)

### ❌ WRONG: Setting MONGODB_URI in .env
```bash
# DON'T do this for local development:
MONGODB_URI=mongodb://localhost:27017/template-doctor
```

### ✅ CORRECT: Leave MONGODB_URI commented out
```bash
# Correct - leave commented for Docker:
# MONGODB_URI - DO NOT SET for local dev! Docker Compose handles this automatically.
```

**Why?** Docker containers use service names (`mongodb`), not `localhost`.

---

## 🔧 Quick Commands

### Start Application
```bash
docker-compose --profile combined up
```

### Stop Application
```bash
# Stop but keep data
docker-compose down

# Stop and delete ALL data (careful!)
docker-compose down -v
```

### View Logs
```bash
docker-compose logs -f
```

### Restart Clean
```bash
docker-compose down
docker-compose --profile combined up --build
```

### Check MongoDB is Running
```bash
docker ps | grep mongodb
```

Expected output:
```
template-doctor-mongodb   Up X minutes   0.0.0.0:27017->27017/tcp
```

---

## 🐛 Troubleshooting

### MongoDB Connection Error
```
MongoServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017
```

**Fix:**
1. Check `.env` - `MONGODB_URI` must be commented out
2. Restart: `docker-compose down && docker-compose --profile combined up`

### OAuth Login Not Working
```
404 after clicking "Sign in with GitHub"
```

**Fix:**
1. GitHub OAuth callback URL must be: `http://localhost:3000/callback.html`
2. Check `.env` has correct `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`

### Port Already in Use
```
bind: address already in use
```

**Fix:**
```bash
# macOS/Linux
lsof -ti :3000 | xargs kill -9
docker-compose --profile combined up
```

### Container Won't Start
```
Error response from daemon: ...
```

**Fix:**
```bash
# Clear Docker cache
docker system prune -a
docker-compose --profile combined up --build
```

---

## 📚 Full Documentation

- **Setup**: [docs/usage/DOCKER.md](../usage/DOCKER.md)
- **Troubleshooting**: [docs/usage/TROUBLESHOOTING.md](../usage/TROUBLESHOOTING.md)
- **Environment Variables**: [docs/development/ENVIRONMENT_VARIABLES.md](../development/ENVIRONMENT_VARIABLES.md)
- **OAuth Setup**: [docs/development/OAUTH_CONFIGURATION.md](../development/OAUTH_CONFIGURATION.md)
- **Production Deploy**: [docs/deployment/COSMOS_DB_PORTAL_SETUP.md](../deployment/COSMOS_DB_PORTAL_SETUP.md)

---

## 🆘 Getting Help

**Still stuck?**

1. Check [Troubleshooting Guide](../usage/TROUBLESHOOTING.md)
2. Search [existing issues](https://github.com/Azure-Samples/template-doctor/issues)
3. Create [new issue](https://github.com/Azure-Samples/template-doctor/issues/new) with:
   - Error message
   - Docker version
   - `.env` contents (redact secrets!)
   - Output of `docker-compose logs`

---

## 🎯 What You Should See

### Successful Startup
```
✓ Container template-doctor-mongodb  Started
✓ Container template-doctor-combined Started

template-doctor-combined  | {"level":"INFO","msg":"MongoDB connected successfully"}
template-doctor-combined  | {"level":"INFO","msg":"Server listening on port 3000"}
```

### Application Homepage
```
http://localhost:3000

┌─────────────────────────────────┐
│   Template Doctor               │
│   Analyze Azure Developer       │
│   CLI (azd) Templates          │
│                                 │
│   [Sign in with GitHub]        │
└─────────────────────────────────┘
```

### After Login
You should see:
- Your GitHub avatar/username in top right
- Dashboard with template analysis options
- No error messages

---

## 🚢 Production Deployment

For deploying to Azure Container Apps:

1. Create production GitHub OAuth app (callback: `https://your-app.azurewebsites.net/callback.html`)
2. Run: `azd init && azd up`
3. Bicep automatically provisions Cosmos DB with System-Assigned Managed Identity (SAMI)

See [Production Deployment Guide](docs/deployment/PRODUCTION_DATABASE_MANAGED_IDENTITY.md) for details.

> **Note:** The Bicep templates automatically configure System-Assigned Managed Identity (SAMI) for the Container App to access Cosmos DB. If you're using `azd provision` and need to grant azd access to your existing Cosmos DB, you'll need a User-Assigned Managed Identity (UAMI) - see the deployment guide for details.

---

Made with ❤️ by the Template Doctor team
