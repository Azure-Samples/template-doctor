# EasyAuth Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          USER AUTHENTICATION FLOW                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌───────────┐
│  Browser  │
└─────┬─────┘
      │ 1. Visit https://template-doctor.azurecontainerapps.io
      │
      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Azure Container Apps (EasyAuth)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │  2. EasyAuth Platform (Azure-managed)                        │          │
│  │     - Checks for authentication cookie                       │          │
│  │     - No cookie? → Redirect to GitHub OAuth                  │          │
│  │     - Has cookie? → Inject headers & forward request         │          │
│  └──────────────────────────────────────────────────────────────┘          │
│                              │                                              │
│                              ▼                                              │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │  3. GitHub OAuth (if not authenticated)                      │          │
│  │     - User authorizes app                                    │          │
│  │     - GitHub redirects to /.auth/login/github/callback       │          │
│  │     - EasyAuth exchanges code for token                      │          │
│  │     - Sets HTTP-only auth cookie                             │          │
│  └──────────────────────────────────────────────────────────────┘          │
│                              │                                              │
│                              ▼                                              │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │  4. Request with EasyAuth Headers                            │          │
│  │     X-MS-CLIENT-PRINCIPAL: eyJ1c2VyS...                      │          │
│  │     X-MS-CLIENT-PRINCIPAL-ID: 12345                          │          │
│  │     X-MS-CLIENT-PRINCIPAL-NAME: octocat                      │          │
│  │     X-MS-CLIENT-PRINCIPAL-IDP: github                        │          │
│  └──────────────────────────────────────────────────────────────┘          │
│                              │                                              │
│                              ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    Express Application                               │  │
│  │  ┌────────────────────────────────────────────────────────────────┐  │  │
│  │  │  5. easyAuthMiddleware (on every request)                      │  │  │
│  │  │     - Extracts headers                                         │  │  │
│  │  │     - Parses X-MS-CLIENT-PRINCIPAL (base64 JSON)              │  │  │
│  │  │     - Populates req.easyAuth object                           │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  │                              │                                        │  │
│  │                              ▼                                        │  │
│  │  ┌────────────────────────────────────────────────────────────────┐  │  │
│  │  │  6. Route Handler (with optional auth check)                   │  │  │
│  │  │                                                                │  │  │
│  │  │  // Public route                                              │  │  │
│  │  │  app.get('/api/health', (req, res) => {                       │  │  │
│  │  │    res.json({ authenticated: req.easyAuth?.isAuthenticated }) │  │  │
│  │  │  })                                                            │  │  │
│  │  │                                                                │  │  │
│  │  │  // Protected route                                           │  │  │
│  │  │  app.post('/api/v4/analyze', requireEasyAuth, (req, res) => { │  │  │
│  │  │    const user = req.easyAuth.username                         │  │  │
│  │  │    // ... handle request                                      │  │  │
│  │  │  })                                                            │  │  │
│  │  │                                                                │  │  │
│  │  │  // Admin-only route                                          │  │  │
│  │  │  app.post('/api/v4/setup', requireAllowedUser(), (req, res) => │  │  │
│  │  │    const user = req.easyAuth.username                         │  │  │
│  │  │    // ... handle admin request                                │  │  │
│  │  │  })                                                            │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  │                              │                                        │  │
│  │                              ▼                                        │  │
│  │  ┌────────────────────────────────────────────────────────────────┐  │  │
│  │  │  7. Response                                                   │  │  │
│  │  │     - JSON data or HTML                                        │  │  │
│  │  │     - Errors handled by errorHandler middleware               │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           COMPONENT DIAGRAM                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│                     Azure Container Apps Environment                      │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  EasyAuth Platform (Azure-managed)                                  │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │ │
│  │  │ GitHub OAuth │  │ Token Store  │  │ Session Management       │ │ │
│  │  │ Integration  │  │              │  │ (HTTP-only cookies)      │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                    │                                      │
│                                    ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  Container App Instance (1-3 replicas)                              │ │
│  │  ┌───────────────────────────────────────────────────────────────┐ │ │
│  │  │  Express Server                                               │ │ │
│  │  │  ┌────────────────┐  ┌────────────────┐  ┌─────────────────┐ │ │ │
│  │  │  │  Middleware    │  │  Route Handlers│  │  Static Files   │ │ │ │
│  │  │  │                │  │                │  │                 │ │ │ │
│  │  │  │  - easyAuth    │  │  - /api/v4/*  │  │  - Frontend SPA │ │ │ │
│  │  │  │  - cors        │  │  - /health     │  │  - index.html   │ │ │ │
│  │  │  │  - error       │  │  - /setup      │  │  - assets/      │ │ │ │
│  │  │  └────────────────┘  └────────────────┘  └─────────────────┘ │ │ │
│  │  └───────────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                    │                                      │
│                                    ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  Azure Resources                                                    │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │ │
│  │  │  Log Analytics   │  │  Managed Identity│  │  Secrets (Vault) │ │ │
│  │  │  Workspace       │  │  (UAMI)          │  │  - GitHub tokens │ │ │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        PROTECTED RESOURCES                                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌────────────────────┬──────────────────┬──────────────────────────────────┐
│      Resource      │  Authentication  │       Authorization              │
├────────────────────┼──────────────────┼──────────────────────────────────┤
│  /                 │  ✅ Required     │  Any authenticated user          │
│  (Tiles)           │                  │                                  │
├────────────────────┼──────────────────┼──────────────────────────────────┤
│  /leaderboards     │  ✅ Required     │  Any authenticated user          │
├────────────────────┼──────────────────┼──────────────────────────────────┤
│  /setup            │  ✅ Required     │  Must be in SETUP_ALLOWED_USERS  │
├────────────────────┼──────────────────┼──────────────────────────────────┤
│  /api/health       │  ❌ Public       │  N/A                             │
├────────────────────┼──────────────────┼──────────────────────────────────┤
│  /api/v4/analyze   │  ✅ Required     │  Any authenticated user          │
├────────────────────┼──────────────────┼──────────────────────────────────┤
│  /api/v4/setup     │  ✅ Required     │  Must be in SETUP_ALLOWED_USERS  │
└────────────────────┴──────────────────┴──────────────────────────────────┘

Note: With EasyAuth's globalValidation set to RedirectToLoginPage:
- Unauthenticated users are redirected to GitHub login BEFORE reaching the app
- Only authenticated requests reach the Express server
- Additional authorization checks (e.g., SETUP_ALLOWED_USERS) are enforced in code

┌─────────────────────────────────────────────────────────────────────────────┐
│                     LOCAL VS PRODUCTION COMPARISON                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┬────────────────────────┬─────────────────────────┐
│      Aspect          │   Local Development    │   Production (Azure)    │
├──────────────────────┼────────────────────────┼─────────────────────────┤
│  Authentication      │  OAuth (browser-based) │  EasyAuth (Azure)       │
├──────────────────────┼────────────────────────┼─────────────────────────┤
│  Token Storage       │  localStorage          │  HTTP-only cookie       │
├──────────────────────┼────────────────────────┼─────────────────────────┤
│  Login Flow          │  Manual button click   │  Auto redirect          │
├──────────────────────┼────────────────────────┼─────────────────────────┤
│  EasyAuth Headers    │  Not present           │  Injected by Azure      │
├──────────────────────┼────────────────────────┼─────────────────────────┤
│  req.easyAuth        │  { authenticated: false}│  { authenticated: true, │
│                      │                        │    username: "octocat" }│
├──────────────────────┼────────────────────────┼─────────────────────────┤
│  Protected Pages     │  Check localStorage    │  Azure redirects        │
├──────────────────────┼────────────────────────┼─────────────────────────┤
│  Port                │  4000 (dev), 3000 (pv) │  443 (HTTPS)            │
└──────────────────────┴────────────────────────┴─────────────────────────┘
```
