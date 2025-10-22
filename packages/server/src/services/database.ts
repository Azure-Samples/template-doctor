/**
 * Database Service for Template Doctor
 *
 * Provides MongoDB connectivity to Cosmos DB using Managed Identity (RBAC).
 * Implements connection pooling, automatic reconnection, and index management.
 *
 * Collections:
 * - analysis: Template analysis results
 * - azdtests: Azure Developer CLI deployment test results
 * - rulesets: Analysis ruleset configurations
 * - configuration: Application configuration key-value pairs
 */

import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import { DefaultAzureCredential } from '@azure/identity';
import { createLogger } from '../shared/logger.js';

const logger = createLogger('database');

// ===== TypeScript Interfaces =====

/**
 * Analysis collection - stores template analysis scan results
 */
export interface Analysis {
  _id?: ObjectId;
  repoUrl: string;
  owner: string;
  repo: string;
  ruleSet: string;
  timestamp: number;
  scanDate: Date;
  compliance: {
    percentage: number;
    passed: number;
    issues: number;
  };
  categories?: Record<
    string,
    {
      enabled: boolean;
      issues: any[];
      compliant: any[];
      percentage: number;
    }
  >;
  issues: Array<{
    id: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    error: string;
    category?: string;
  }>;
  compliant: Array<{
    id: string;
    category: string;
    message: string;
    details?: any;
  }>;
  analysisResult: any; // Full analyzer output
  createdBy?: string; // GitHub username who triggered the analysis (e.g., "anfibiacreativa")
  scannedBy?: string[];
  upstreamTemplate?: string;
  archiveRequested?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Repos collection - stores repository metadata with latest analysis and AZD test
 * This is the primary collection for V2 schema (repo-centric design)
 */
export interface Repo {
  _id?: ObjectId;
  repoUrl: string; // Unique - primary key
  owner: string;
  repo: string;

  // Latest analysis summary (denormalized for fast queries)
  latestAnalysis?: {
    scanDate: Date;
    ruleSet: string;
    compliancePercentage: number;
    passed: number;
    issues: number;
    analysisId: ObjectId; // Reference to full analysis document
    createdBy?: string; // GitHub username of last scanner
  };

  // Latest AZD test result (embedded, only keep most recent)
  latestAzdTest?: {
    testId: string;
    timestamp: Date;
    status: 'pending' | 'running' | 'success' | 'failed';
    duration?: number; // milliseconds
    result?: {
      deploymentTime?: number;
      resourcesCreated?: number;
      azdUpSuccess?: boolean;
      azdDownSuccess?: boolean;
      errors?: string[];
      warnings?: string[];
      endpoints?: Array<{ name: string; url: string }>;
    };
  };

  // Repository metadata
  upstreamTemplate?: string;
  archiveRequested?: boolean;
  tags?: string[];

  createdAt: Date;
  updatedAt: Date;
}

/**
 * AZD Tests collection - stores Azure Developer CLI deployment test results
 */
export interface AzdTest {
  _id?: ObjectId;
  repoUrl: string;
  owner: string;
  repo: string;
  testId: string;
  timestamp: number;
  status: 'pending' | 'running' | 'success' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  duration?: number; // milliseconds
  result?: {
    deploymentTime?: number;
    resourcesCreated?: number;
    errors?: string[];
    warnings?: string[];
    logs?: string;
    azdUpSuccess?: boolean;
    azdDownSuccess?: boolean;
  };
  error?: string;
  createdAt: Date;
}

/**
 * Rulesets collection - analysis ruleset configurations
 */
export interface Ruleset {
  _id?: ObjectId;
  name: string; // Unique key, e.g., "dod", "security", "performance"
  displayName: string;
  description: string;
  rules: Array<{
    id: string;
    enabled: boolean;
    severity: 'error' | 'warning' | 'info';
    category?: string;
    description?: string;
  }>;
  isDefault?: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Configuration collection - application config key-value pairs
 */
export interface Configuration {
  _id?: ObjectId;
  key: string; // Unique config key
  value: any; // JSON value
  category?: string; // e.g., "features", "limits", "oauth"
  description?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * WorkflowConfig collection - GitHub Actions workflow configurations
 */
export interface WorkflowConfigDocument {
  _id?: ObjectId;
  id: string; // Unique workflow ID
  name: string; // Display name
  workflowFile: string; // GitHub workflow filename
  description?: string;
  artifactCompressed: boolean;
  artifactNamePattern?: string;
  streamLogs: boolean;
  customParser?: string;
  resultTemplate?: string;
  defaultInputs?: Record<string, string>;
  timeout?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// ===== Database Service Class =====

class DatabaseService {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private connectionString: string = '';
  private isConnected: boolean = false;

  /**
   * Connect to MongoDB (local or Cosmos DB)
   * Supports both local MongoDB (MONGODB_URI) and Cosmos DB with Managed Identity (COSMOS_ENDPOINT)
   */
  async connect(): Promise<void> {
    if (this.isConnected && this.client && this.db) {
      logger.info('Already connected');
      return;
    }

    const mongoUri = process.env.MONGODB_URI;
    const cosmosEndpoint = process.env.COSMOS_ENDPOINT;
    const databaseName =
      process.env.COSMOS_DATABASE_NAME || process.env.MONGODB_DATABASE || 'template-doctor';

    // Local MongoDB (e.g., MongoDB Compass)
    if (mongoUri) {
      logger.info(
        { endpoint: mongoUri.replace(/\/\/.*@/, '//***@') },
        'Connecting to local MongoDB',
      );

      try {
        this.client = new MongoClient(mongoUri, {
          maxPoolSize: 10,
          minPoolSize: 2,
          serverSelectionTimeoutMS: 5000,
        });

        await this.client.connect();
        this.db = this.client.db(databaseName);
        this.isConnected = true;

        logger.info({ databaseName }, 'Connected to local MongoDB database');

        // Create indexes (async, non-blocking)
        this.createIndexes().catch((err) => logger.error({ err }, 'Index creation failed'));

        // Graceful shutdown handlers
        process.on('SIGTERM', () => this.disconnect());
        process.on('SIGINT', () => this.disconnect());

        return;
      } catch (error: any) {
        this.isConnected = false;
        logger.error({ err: error }, 'Local MongoDB connection failed');
        throw error;
      }
    }

    // Cosmos DB with Managed Identity
    if (cosmosEndpoint) {
      logger.info({ cosmosEndpoint }, 'Connecting to Cosmos DB');

      try {
        // Acquire access token using Managed Identity
        const credential = new DefaultAzureCredential();
        const tokenResponse = await credential.getToken('https://cosmos.azure.com/.default');

        if (!tokenResponse || !tokenResponse.token) {
          throw new Error('Failed to acquire access token from Managed Identity');
        }

        // Build MongoDB connection string with token as username
        // Cosmos DB MongoDB API accepts MI token as username
        const token = tokenResponse.token;
        this.connectionString = `mongodb://${encodeURIComponent(token)}:${encodeURIComponent(token)}@${cosmosEndpoint.replace('https://', '')}:10255/?ssl=true&replicaSet=globaldb&retrywrites=false&maxIdleTimeMS=120000&appName=@${databaseName}@`;

        // Create MongoDB client with connection pooling
        this.client = new MongoClient(this.connectionString, {
          maxPoolSize: 10,
          minPoolSize: 2,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        });

        await this.client.connect();
        this.db = this.client.db(databaseName);
        this.isConnected = true;

        logger.info({ databaseName }, 'Connected to Cosmos DB database');

        // Create indexes (async, non-blocking)
        this.createIndexes().catch((err) => logger.error({ err }, 'Index creation failed'));

        // Set up token refresh (every 1 hour)
        this.scheduleTokenRefresh();

        // Graceful shutdown handlers
        process.on('SIGTERM', () => this.disconnect());
        process.on('SIGINT', () => this.disconnect());

        return;
      } catch (error: any) {
        this.isConnected = false;
        logger.error({ err: error }, 'Cosmos DB connection failed');
        throw error;
      }
    }

    throw new Error(
      'No database configuration found. Set MONGODB_URI for local MongoDB or COSMOS_ENDPOINT for Cosmos DB',
    );
  }

  /**
   * Create indexes for performance optimization
   */
  private async createIndexes(): Promise<void> {
    if (!this.db) return;

    logger.info('Creating indexes...');

    try {
      // Repos collection indexes (V2 schema - primary collection)
      await this.repos.createIndex({ repoUrl: 1 }, { unique: true, background: true });
      await this.repos.createIndex({ owner: 1, repo: 1 }, { background: true });
      await this.repos.createIndex(
        { 'latestAnalysis.compliancePercentage': -1 },
        { background: true },
      );
      await this.repos.createIndex({ 'latestAnalysis.scanDate': -1 }, { background: true });

      // Analysis collection indexes (V2 schema - historical results)
      await this.analysis.createIndex({ repoUrl: 1, scanDate: -1 }, { background: true });
      await this.analysis.createIndex({ owner: 1, repo: 1 }, { background: true });
      await this.analysis.createIndex({ scanDate: -1 }, { background: true });
      await this.analysis.createIndex({ 'compliance.percentage': -1 }, { background: true });
      await this.analysis.createIndex({ createdBy: 1 }, { background: true });

      // AZD Tests collection indexes
      await this.azdTests.createIndex({ repoUrl: 1, timestamp: -1 }, { background: true });
      await this.azdTests.createIndex({ status: 1, startedAt: -1 }, { background: true });

      // Rulesets collection indexes
      await this.rulesets.createIndex({ name: 1 }, { unique: true, background: true });

      // Configuration collection indexes
      await this.configuration.createIndex({ key: 1 }, { unique: true, background: true });
      await this.configuration.createIndex({ category: 1 }, { background: true });

      logger.info('Indexes created successfully');
    } catch (error: any) {
      logger.error({ err: error }, 'Index creation error');
    }
  }

  /**
   * Refresh MI token periodically (every 1 hour)
   */
  private scheduleTokenRefresh(): void {
    setInterval(async () => {
      logger.info('Refreshing MI token...');
      try {
        await this.disconnect();
        await this.connect();
        logger.info('Token refreshed and reconnected');
      } catch (error: any) {
        logger.error({ err: error }, 'Token refresh failed');
      }
    }, 3600000); // 1 hour
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.isConnected = false;
      logger.info('Disconnected');
    }
  }

  /**
   * Health check - tests database connectivity
   */
  async healthCheck(): Promise<{
    connected: boolean;
    type?: string;
    database?: string;
    latency?: number;
    error?: string;
  }> {
    if (!this.db) {
      return { connected: false, error: 'Database not initialized' };
    }

    try {
      const start = Date.now();
      await this.db.admin().ping();
      const latency = Date.now() - start;
      const type = process.env.MONGODB_URI ? 'local-mongodb' : 'cosmos-db';
      const database = this.db.databaseName;
      return { connected: true, type, database, latency };
    } catch (error: any) {
      return { connected: false, error: error?.message };
    }
  }

  // ===== Collection Accessors =====

  /**
   * Analysis collection
   */
  /**
   * Analysis collection (V2: historical results, keep last 10 per repo)
   */
  get analysis(): Collection<Analysis> {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection<Analysis>('analysis');
  }

  /**
   * Repos collection (V2: primary collection for repository metadata)
   */
  get repos(): Collection<Repo> {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection<Repo>('repos');
  }

  /**
   * AZD Tests collection
   */
  get azdTests(): Collection<AzdTest> {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection<AzdTest>('azdtests');
  }

  /**
   * Rulesets collection
   */
  get rulesets(): Collection<Ruleset> {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection<Ruleset>('rulesets');
  }

  /**
   * Configuration collection
   */
  get configuration(): Collection<Configuration> {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection<Configuration>('configuration');
  }

  /**
   * Workflow configurations collection
   */
  get workflowConfigs(): Collection<WorkflowConfigDocument> {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection<WorkflowConfigDocument>('workflow_configs');
  }
}

// Singleton instance
export const database = new DatabaseService();
