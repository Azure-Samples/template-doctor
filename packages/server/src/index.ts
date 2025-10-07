import express, { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
    easyAuthMiddleware,
    corsMiddleware,
    errorHandler,
    notFoundHandler,
} from "./middleware/index.js";

// ESM equivalents for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000; // Default to 3000 for OAuth compatibility

// Middleware
// Use built-in CORS for now (can switch to custom corsMiddleware if needed)
app.use(cors());
app.use(express.json());

// Add EasyAuth middleware to extract authentication info from headers
// This runs on all requests and populates req.easyAuth
app.use(easyAuthMiddleware);

// Serve static files from frontend build (if available)
// Use FRONTEND_DIST_PATH env var if set (for Docker), otherwise calculate relative path
const staticPath =
    process.env.FRONTEND_DIST_PATH || path.join(__dirname, "../../app/dist");
app.use(express.static(staticPath));

// Health check
app.get("/api/health", (req: Request, res: Response) => {
    const authReq = req as any; // Cast to access easyAuth
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        env: {
            hasGitHubToken: !!process.env.GITHUB_TOKEN,
            hasWorkflowToken: !!process.env.GH_WORKFLOW_TOKEN,
            hasAnalyzerToken: !!process.env.GITHUB_TOKEN_ANALYZER,
        },
        easyAuth: {
            enabled: !!authReq.easyAuth,
            authenticated: authReq.easyAuth?.isAuthenticated || false,
            username: authReq.easyAuth?.username || null,
            provider: authReq.easyAuth?.provider || null,
        },
    });
});

// Import routes
import { analyzeRouter } from "./routes/analyze.js";
import { authRouter } from "./routes/auth.js";
import { configRouter } from "./routes/config.js";
import { validationRouter } from "./routes/validation.js";
import { githubRouter } from "./routes/github.js";
import { analysisRouter } from "./routes/analysis.js";
import { actionsRouter } from "./routes/actions.js";
import { miscRouter } from "./routes/misc.js";

// Register API routes under /api/v4
app.use("/api/v4", analyzeRouter);
app.use("/api/v4", authRouter);
app.use("/api/v4", configRouter);
app.use("/api/v4", validationRouter);
app.use("/api/v4", githubRouter);
app.use("/api/v4", analysisRouter);
app.use("/api/v4", actionsRouter);
app.use("/api/v4", miscRouter);

// Error handlers (must be after all routes)
app.use(notFoundHandler);
app.use(errorHandler);

// Fallback to serve index.html for client-side routing (SPA)
app.get("*", (req: Request, res: Response) => {
    if (!req.path.startsWith("/api")) {
        res.sendFile(path.join(staticPath, "index.html"));
    } else {
        res.status(404).json({ error: "API endpoint not found" });
    }
});

// Start server
app.listen(port, () => {
    console.log(`🚀 Template Doctor server running on port ${port}`);
    console.log(`📊 Health check: http://localhost:${port}/api/health`);
    console.log(
        `🔑 GitHub Token configured: ${!!process.env.GH_WORKFLOW_TOKEN || !!process.env.GITHUB_TOKEN}`,
    );
    console.log(`📁 Serving static files from: ${staticPath}`);
});

export default app;
