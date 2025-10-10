# Express Server Migration Status

**Last Updated**: 2025-01-30  
**Status**: Phase 1 Complete - Core endpoints migrated

## Overview

Migrating all Azure Functions from `packages/api/` to Express routes in `packages/server/`.

**Reason**: Azure Functions TypeScript deployment couldn't read environment variables in production, despite working in vanilla JS. Express + Docker provides reliable env var access and simpler deployment.

## Progress: 3 of 20+ endpoints (15%)

### ✅ Phase 1: Core Functionality (COMPLETE)

| Endpoint              | Route                             | Status | Notes                            |
| --------------------- | --------------------------------- | ------ | -------------------------------- |
| Health Check          | `GET /health`                     | ✅     | Basic server health              |
| GitHub OAuth          | `POST /api/v4/github-oauth-token` | ✅     | Token exchange for login         |
| Runtime Config        | `GET /api/v4/client-settings`     | ✅     | Frontend configuration           |
| **Template Analysis** | `POST /api/v4/analyze-template`   | ✅     | **Full analyzer logic migrated** |

**Phase 1 Deliverables**:

- Express server foundation with TypeScript
- Core authentication and analysis working
- Fork-first repository access strategy
- Batch analysis support
- SAML token handling
- All shared utilities copied (analyzer-core, github, platform, shared)

### ⏳ Phase 2: Validation Workflow (0/6)

| Endpoint            | Azure Function            | Priority | Complexity |
| ------------------- | ------------------------- | -------- | ---------- |
| Validate Template   | `validation-template`     | HIGH     | Medium     |
| Validation Status   | `validation-status`       | HIGH     | Low        |
| Validation Callback | `validation-callback`     | HIGH     | Medium     |
| Validation Cancel   | `validation-cancel`       | MEDIUM   | Low        |
| Docker Image Check  | `validation-docker-image` | MEDIUM   | Medium     |
| OSSF Check          | `validation-ossf`         | MEDIUM   | Medium     |

### ⏳ Phase 3: GitHub Integration (0/4)

| Endpoint         | Azure Function         | Priority | Complexity |
| ---------------- | ---------------------- | -------- | ---------- |
| Fork Repository  | `repo-fork`            | HIGH     | Medium     |
| Action Trigger   | `action-trigger`       | MEDIUM   | Medium     |
| Action Status    | `action-run-status`    | MEDIUM   | Low        |
| Action Artifacts | `action-run-artifacts` | MEDIUM   | Low        |

### ⏳ Phase 4: Issue & Content Management (0/3)

| Endpoint           | Azure Function       | Priority | Complexity |
| ------------------ | -------------------- | -------- | ---------- |
| Create Issue       | `issue-create`       | MEDIUM   | Medium     |
| AI Issue Proxy     | `issue-ai-proxy`     | LOW      | Medium     |
| Archive Collection | `archive-collection` | LOW      | Medium     |

### ⏳ Phase 5: Batch & Misc (0/4)

| Endpoint        | Azure Function             | Priority | Complexity |
| --------------- | -------------------------- | -------- | ---------- |
| Batch Scan      | `batch-scan-start`         | LOW      | Medium     |
| Submit Analysis | `submit-analysis-dispatch` | LOW      | Medium     |
| Add Template PR | `add-template-pr`          | LOW      | High       |
| Setup           | `setup`                    | LOW      | Low        |

## Migration Checklist (Per Endpoint)

- [ ] Read Azure Function source in `packages/api/<function-name>/index.js`
- [ ] Create Express route in appropriate `src/routes/<category>.ts`
- [ ] Convert Azure Functions types (`HttpRequest`, `Context`) to Express (`Request`, `Response`)
- [ ] Remove `wrapHttp()` wrapper - use direct `res.status().json()`
- [ ] Replace `context.log()` with `console.log()` / `console.error()`
- [ ] Update environment variable access (already using `process.env.*`)
- [ ] Register router in `src/routes/index.ts`
- [ ] Add smoke test to `test-server.sh`
- [ ] Update this document with completion status

## Code Patterns

### Azure Functions (OLD)

```typescript
import type { HttpRequest, Context } from "@azure/functions";
import { wrapHttp } from "./shared/http";

export const handler = wrapHttp(async (req: HttpRequest, ctx: Context) => {
    ctx.log("Processing request");
    if (req.method !== "POST") {
        return { status: 405, body: { error: "Method not allowed" } };
    }
    return { status: 200, body: { success: true } };
});
```

### Express (NEW)

```typescript
import { Router, Request, Response } from "express";

export const myRouter = Router();

myRouter.post("/my-endpoint", async (req: Request, res: Response) => {
    console.log("Processing request");
    try {
        res.status(200).json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error?.message });
    }
});
```

## Testing Strategy

1. **Local Development**:

    ```bash
    # Terminal 1: Start Express server
    cd packages/server
    npm run dev

    # Terminal 2: Run smoke tests
    ./test-server.sh
    ```

2. **Integration Testing**:
    - Point frontend `config.local.json` to `http://localhost:7071`
    - Test OAuth login flow
    - Test template analysis with real repository

3. **Production Validation**:
    - Build Docker container
    - Deploy to Azure Container Apps
    - Verify environment variables accessible
    - Test all endpoints with production data

## Known Issues & Solutions

### Issue: Environment Variables Not Accessible (Azure Functions)

**Status**: ✅ RESOLVED  
**Solution**: Migrated to Express with `dotenv` package

### Issue: Complex Config Loading (Azure Functions)

**Status**: ✅ RESOLVED  
**Solution**: Single `.env` file loaded at server startup

### Issue: OAuth Redirect Port Mismatch

**Status**: ✅ RESOLVED  
**Solution**: Express server uses same port 7071 as Azure Functions

## Deployment Plan

### Phase 1: Local Testing (CURRENT)

- [x] Express server running locally
- [x] Core endpoints functional
- [ ] Full smoke test suite passing
- [ ] Frontend connected and tested

### Phase 2: Container Build

- [ ] Build Docker image
- [ ] Test container locally
- [ ] Push to container registry

### Phase 3: Azure Deployment

- [ ] Create Azure Container Apps resource
- [ ] Configure secrets/environment variables
- [ ] Deploy container
- [ ] Update frontend production config to point to container URL

### Phase 4: Cut Over

- [ ] Run production validation tests
- [ ] Update DNS/routing if needed
- [ ] Deprecate Azure Functions endpoints
- [ ] Archive `packages/api` directory

## Timeline Estimate

- ✅ Phase 1 (Core): **COMPLETE**
- ⏳ Phase 2 (Validation): 2-3 hours
- ⏳ Phase 3 (GitHub): 2-3 hours
- ⏳ Phase 4 (Issues): 1-2 hours
- ⏳ Phase 5 (Misc): 2-3 hours
- ⏳ Testing & Deployment: 2-4 hours

**Total Remaining**: ~10-15 hours of development + testing

## References

- Azure Functions code: `packages/api/*/index.js`
- Express routes: `packages/server/src/routes/*.ts`
- Shared utilities: `packages/server/src/{shared,github,platform,analyzer-core}/`
- Environment variables: `packages/server/.env.example`
- Smoke tests: `packages/server/test-server.sh`
