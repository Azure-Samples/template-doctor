import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

// ESM equivalents for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local (if exists) and .env
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config(); // Also load from root .env as fallback

export const app: Express = express();
const defaultPort = process.env.PORT || 3000; // Default to 3000 for OAuth compatibility

// Structured logging middleware
import { httpLogger } from './shared/logger.js';

// Rate limiting middleware
import { standardRateLimit } from "./middleware/rate-limit.js";

// Middleware
app.use(httpLogger); // HTTP request/response logging
app.use(cors());
app.use(express.json());

// Apply standard rate limiting to all API routes
app.use('/api', standardRateLimit);

// Serve static files from frontend build (if available)
// Use FRONTEND_DIST_PATH env var if set (for Docker), otherwise calculate relative path
const staticPath = process.env.FRONTEND_DIST_PATH || path.join(__dirname, '../../app/dist');
app.use(express.static(staticPath));

// Health check
app.get('/api/health', async (req: Request, res: Response) => {
  const { database } = await import('./services/database.js');
  const dbHealth = await database.healthCheck();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbHealth,
    env: {
      hasGitHubToken: !!process.env.GITHUB_TOKEN,
      hasWorkflowToken: !!process.env.GH_WORKFLOW_TOKEN,
      hasAnalyzerToken: !!process.env.GITHUB_TOKEN_ANALYZER,
      hasMongoDbUri: !!process.env.MONGODB_URI,
      hasCosmosEndpoint: !!process.env.COSMOS_ENDPOINT,
      BUILD_TAG: process.env.BUILD_TAG || 'unknown',
      BUILD_TIMESTAMP: process.env.BUILD_TIMESTAMP || 'unknown',
    },
  });
});

// Import routes
import { analyzeRouter } from './routes/analyze.js';
import { authRouter } from './routes/auth.js';
import { configRouter } from './routes/config.js';
import { validationRouter } from './routes/validation.js';
import { githubRouter } from './routes/github.js';
import { analysisRouter } from './routes/analysis.js';
import { actionsRouter } from './routes/actions.js';
import { miscRouter } from './routes/misc.js';
import { resultsRouter } from './routes/results.js';
import { adminConfigRouter } from './routes/admin-config.js';
import { adminRouter } from './routes/admin.js';
import leaderboardsRouter from './routes/leaderboards.js';
import { azdTestRouter } from './routes/azd-test.js';
import { genericWorkflowRouter } from './routes/generic-workflow.js';

// Initialize database connection
import { database } from './services/database.js';
import { createLogger } from './shared/logger.js';

const startupLogger = createLogger('startup');

(async () => {
  try {
    // Connect to database if MongoDB URI or Cosmos endpoint is configured
    if (process.env.MONGODB_URI || process.env.COSMOS_ENDPOINT) {
      const dbType = process.env.MONGODB_URI ? 'Local MongoDB' : 'Cosmos DB';
      startupLogger.info({ dbType }, 'Connecting to database...');
      await database.connect();
      startupLogger.info('Database connected');
    } else {
      startupLogger.warn('No database configured - database features disabled');
      startupLogger.warn('Set MONGODB_URI (local) or COSMOS_ENDPOINT (Cosmos DB)');
    }
  } catch (error: any) {
    startupLogger.error({ err: error }, 'Database connection failed');
    startupLogger.error('Database features will be unavailable');
  }
})();

// Register API routes under /api/v4
app.use('/api/v4', analyzeRouter);
app.use('/api/v4', authRouter);
app.use('/api/v4', configRouter);
app.use('/api/v4', validationRouter);
app.use('/api/v4', githubRouter);
app.use('/api/v4', analysisRouter);
app.use('/api/v4', actionsRouter);
app.use('/api/v4', miscRouter);
app.use('/api/v4', resultsRouter);
app.use('/api/v4', azdTestRouter); // AZD deployment test results
app.use('/api/v4', genericWorkflowRouter); // Generic workflow execution system
app.use('/api/v4/admin', adminConfigRouter); // Admin configuration endpoints
app.use('/api/admin', adminRouter); // Debug and inspection endpoints
app.use('/api/v4/leaderboards', leaderboardsRouter); // Leaderboards analytics

// Explicit routes for HTML pages (without .html extension)
app.get('/leaderboards', (req: Request, res: Response) => {
  res.sendFile(path.join(staticPath, 'leaderboards.html'));
});

app.get('/setup', (req: Request, res: Response) => {
  res.sendFile(path.join(staticPath, 'setup.html'));
});

app.get('/callback', (req: Request, res: Response) => {
  res.sendFile(path.join(staticPath, 'callback.html'));
});

// Fallback to serve index.html ONLY for routes that look like pages (no file extension)
// This allows static files (.json, .js, .css, etc.) to be served by express.static
app.get('*', (req: Request, res: Response) => {
  // If path starts with /api, return 404
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }

  // If path has a file extension (e.g., .json, .js, .css), let static middleware handle it
  // by passing to next middleware (which will 404 if file doesn't exist)
  const hasFileExtension = /\.[a-zA-Z0-9]+$/.test(req.path);
  if (hasFileExtension) {
    return res.status(404).send('File not found');
  }

  // Otherwise, serve index.html for client-side routing
  res.sendFile(path.join(staticPath, 'index.html'));
});

export function startServer(port: number = Number(defaultPort)): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = app.listen(port, async () => {
      startupLogger.info({ port }, 'Template Doctor server running');
      startupLogger.info({ url: `http://localhost:${port}/api/health` }, 'Health check endpoint');
      startupLogger.info(
        {
          configured: !!process.env.GH_WORKFLOW_TOKEN || !!process.env.GITHUB_TOKEN,
        },
        'GitHub Token configured',
      );
      startupLogger.info({ staticPath }, 'Serving static files');

      // Initialize default configuration settings
      try {
        startupLogger.info('Initializing configuration defaults...');
        const { ConfigurationStorage } = await import('./services/configuration-storage.js');
        await ConfigurationStorage.initializeDefaults();
        startupLogger.info('Configuration initialized');
      } catch (error) {
        startupLogger.error({ err: error }, 'Failed to initialize configuration');
      }

      // Initialize workflow configurations
      try {
        startupLogger.info('Initializing workflow configurations...');
        const { initializeWorkflowConfigs } = await import('./services/workflow-config-loader.js');
        await initializeWorkflowConfigs();
        startupLogger.info('Workflow configurations initialized');
      } catch (error) {
        startupLogger.error({ err: error }, 'Failed to initialize workflow configurations');
      }

      resolve(server);
    });
  });
}

// Auto start unless under test environment
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST_WORKER_ID) {
  startServer();
}

export default app;
