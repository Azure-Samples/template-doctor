/**
 * Workflow Configuration Loader
 * 
 * Loads workflow configurations from the database (setup endpoint)
 * and registers them with the generic workflow system.
 */

import { database } from './database.js';
import { WorkflowConfig } from '../types/workflow.js';
import { registerWorkflowConfig } from '../routes/generic-workflow.js';

/**
 * Default workflow configurations
 * These are registered on startup and can be customized via setup endpoint
 */
const DEFAULT_WORKFLOWS: WorkflowConfig[] = [
  {
    id: 'azd-validation',
    name: 'AZD Template Validation',
    workflowFile: 'validation-template.yml',
    description: 'Validates Azure Developer CLI (azd) templates with deployment testing',
    artifactCompressed: true,
    artifactNamePattern: '*-validation-result',
    streamLogs: true,
    customParser: 'azd-validation',
    resultTemplate: '/templates/azd-validation-result.html',
    defaultInputs: {
      customValidators: 'azd-up,azd-down',
    },
    timeout: 600000, // 10 minutes
  },
  {
    id: 'docker-image-scan',
    name: 'Docker Image Security Scan',
    workflowFile: 'validation-docker-image.yml',
    description: 'Scans Docker images for security vulnerabilities using Trivy',
    artifactCompressed: true,
    artifactNamePattern: '*-scan-results',
    streamLogs: false,
    customParser: 'json',
    resultTemplate: '/templates/docker-scan-result.html',
    defaultInputs: {},
    timeout: 300000, // 5 minutes
  },
  {
    id: 'ossf-scorecard',
    name: 'OSSF Scorecard Analysis',
    workflowFile: 'validation-ossf.yml',
    description: 'Evaluates repository security posture with OpenSSF Scorecard',
    artifactCompressed: true,
    artifactNamePattern: '*-scorecard',
    streamLogs: false,
    customParser: 'json',
    resultTemplate: '/templates/ossf-scorecard-result.html',
    defaultInputs: {},
    timeout: 300000, // 5 minutes
  },
];

/**
 * Initialize workflow configurations from database
 * Falls back to defaults if database not available
 */
export async function initializeWorkflowConfigs(): Promise<void> {
  try {
    // Try to load from database
    const collection = database.workflowConfigs;

    // Create index on id
    await collection.createIndex({ id: 1 }, { unique: true });

    const now = new Date();

    // Upsert default workflows
    for (const workflow of DEFAULT_WORKFLOWS) {
      await collection.updateOne(
        { id: workflow.id },
        {
          $setOnInsert: {
            ...workflow,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true },
      );
    }

    // Load all workflows and register them
    const workflows = await collection.find({}).toArray();

    console.log('[workflow-config-loader] Loaded workflows from database', {
      count: workflows.length,
      ids: workflows.map((w) => w.id),
    });

    for (const workflow of workflows) {
      // Remove MongoDB _id field before registering
      const { _id, ...config } = workflow as any;
      registerWorkflowConfig(config as WorkflowConfig);
    }
  } catch (error) {
    console.error('[workflow-config-loader] Failed to load from database, using defaults', {
      error,
    });

    // Fallback to hardcoded defaults
    for (const workflow of DEFAULT_WORKFLOWS) {
      registerWorkflowConfig(workflow);
    }
  }
}

/**
 * Get workflow configuration from database
 */
export async function getWorkflowConfig(id: string): Promise<WorkflowConfig | null> {
  try {
    const collection = database.workflowConfigs;
    const config = await collection.findOne({ id });
    if (config) {
      const { _id, ...cleanConfig } = config as any;
      return cleanConfig as WorkflowConfig;
    }
    return null;
  } catch (error) {
    console.error('[workflow-config-loader] Failed to get workflow config', { id, error });
    return null;
  }
}

/**
 * Save/update workflow configuration to database
 */
export async function saveWorkflowConfig(config: WorkflowConfig): Promise<void> {
  const collection = database.workflowConfigs;
  const now = new Date();

  await collection.updateOne(
    { id: config.id },
    {
      $set: {
        ...config,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  );

  // Re-register with the route handler
  registerWorkflowConfig(config);

  console.log('[workflow-config-loader] Saved workflow config', { id: config.id });
}

/**
 * Delete workflow configuration from database
 */
export async function deleteWorkflowConfig(id: string): Promise<boolean> {
  const collection = database.workflowConfigs;
  const result = await collection.deleteOne({ id });

  console.log('[workflow-config-loader] Deleted workflow config', {
    id,
    deleted: result.deletedCount > 0,
  });

  return result.deletedCount > 0;
}

/**
 * Get all workflow configurations
 */
export async function getAllWorkflowConfigs(): Promise<WorkflowConfig[]> {
  try {
    const collection = database.workflowConfigs;
    const configs = await collection.find({}).toArray();
    return configs.map((config: any) => {
      const { _id, ...cleanConfig } = config;
      return cleanConfig as WorkflowConfig;
    });
  } catch (error) {
    console.error('[workflow-config-loader] Failed to get all configs', { error });
    return DEFAULT_WORKFLOWS;
  }
}
