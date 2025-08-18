#!/usr/bin/env node

/**
 * Container App Verification Script
 * 
 * This script verifies the setup required for Azure Container Apps integration:
 * 1. Required environment variables
 * 2. Container App job existence
 * 3. Managed identity configuration
 */

const { ContainerAppsAPIClient } = require('@azure/arm-appcontainers');
const { DefaultAzureCredential, ClientSecretCredential } = require('@azure/identity');
const { WebSiteManagementClient } = require('@azure/arm-appservice');
const { ManagedServiceIdentityClient } = require('@azure/arm-msi');
const { AuthorizationManagementClient } = require('@azure/arm-authorization');
const { readFileSync } = require('fs');
const { join } = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Status icons
const icons = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: '🔍'
};

// Function to log with colors
function log(message, type = 'info') {
  let color = colors.white;
  let icon = icons.info;
  
  switch (type) {
    case 'success':
      color = colors.green;
      icon = icons.success;
      break;
    case 'error':
      color = colors.red;
      icon = icons.error;
      break;
    case 'warning':
      color = colors.yellow;
      icon = icons.warning;
      break;
    case 'info':
      color = colors.cyan;
      icon = icons.info;
      break;
  }
  
  console.log(`${color}${icon} ${message}${colors.reset}`);
}

// Function to load local environment variables from local.settings.json
function loadLocalSettings() {
  try {
    const localSettingsPath = join(__dirname, '..', 'packages', 'functions-aca', 'local.settings.json');
    const settings = JSON.parse(readFileSync(localSettingsPath, 'utf8'));
    return settings.Values || {};
  } catch (error) {
    log(`Could not load local.settings.json: ${error.message}`, 'warning');
    return {};
  }
}

// Function to get Azure Functions app settings
async function getFunctionAppSettings(credential, subscriptionId, resourceGroupName, functionAppName) {
  try {
    const webSiteClient = new WebSiteManagementClient(credential, subscriptionId);
    const settings = await webSiteClient.webApps.listApplicationSettings(resourceGroupName, functionAppName);
    return settings.properties || {};
  } catch (error) {
    log(`Could not get Function App settings: ${error.message}`, 'error');
    return {};
  }
}

// Main verification function
async function verifySetup() {
  log('Starting Azure Container Apps integration verification', 'info');
  
  // Step 1: Check environment variables
  let isLocal = false;
  let requiredEnvVars = ['AZURE_SUBSCRIPTION_ID', 'ACA_RESOURCE_GROUP', 'ACA_JOB_NAME'];
  let missingEnvVars = [];
  let envVars = {};
  
  // First try to get from process.env (if running in Azure or local with env vars set)
  requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      missingEnvVars.push(varName);
    } else {
      envVars[varName] = process.env[varName];
    }
  });
  
  // If any are missing, try to load from local.settings.json
  if (missingEnvVars.length > 0) {
    log('Some environment variables are missing from process.env, checking local.settings.json', 'info');
    isLocal = true;
    const localSettings = loadLocalSettings();
    
    missingEnvVars = [];
    requiredEnvVars.forEach(varName => {
      if (localSettings[varName]) {
        envVars[varName] = localSettings[varName];
      } else if (!envVars[varName]) {
        missingEnvVars.push(varName);
      }
    });
  }
  
  // Report on environment variables
  if (missingEnvVars.length > 0) {
    log(`Missing required environment variables: ${missingEnvVars.join(', ')}`, 'error');
    log('Please set these variables in your Azure Function App settings or local.settings.json', 'info');
    return false;
  } else {
    log('All required environment variables are set:', 'success');
    requiredEnvVars.forEach(varName => {
      const value = envVars[varName];
      // Mask subscription ID partially for security
      const displayValue = varName === 'AZURE_SUBSCRIPTION_ID' 
        ? `${value.substring(0, 8)}...${value.substring(value.length - 4)}`
        : value;
      log(`  ${varName}: ${displayValue}`, 'info');
    });
  }
  
  // Step 2: Verify Azure credentials
  log('\nVerifying Azure credentials', 'info');
  
  let credential;
  try {
    credential = new DefaultAzureCredential();
    log('Using DefaultAzureCredential for authentication', 'info');
  } catch (error) {
    log(`DefaultAzureCredential initialization failed: ${error.message}`, 'error');
    log('Please make sure you are logged in with Azure CLI or have appropriate environment variables set', 'info');
    return false;
  }
  
  // Step 3: Check if the container app job exists
  log('\nVerifying Container App job exists', 'info');
  
  try {
    const subscriptionId = envVars.AZURE_SUBSCRIPTION_ID;
    const resourceGroup = envVars.ACA_RESOURCE_GROUP;
    const jobName = envVars.ACA_JOB_NAME;
    
    const containerAppClient = new ContainerAppsAPIClient(credential, subscriptionId);
    
    try {
      log(`Checking if job '${jobName}' exists in resource group '${resourceGroup}'`, 'info');
      const job = await containerAppClient.jobs.get(resourceGroup, jobName);
      
      if (job) {
        log(`Container App job '${jobName}' exists`, 'success');
        log(`Job details:`, 'info');
        log(`  Location: ${job.location}`, 'info');
        log(`  Provisioning state: ${job.properties?.provisioningState || 'Unknown'}`, 'info');
        log(`  Type: ${job.type}`, 'info');
        
        // Check template configuration
        if (job.properties?.template?.containers?.length > 0) {
          const container = job.properties.template.containers[0];
          log(`  Container image: ${container.image}`, 'info');
          log(`  Container resources:`, 'info');
          log(`    CPU: ${container.resources?.cpu || 'Not specified'}`, 'info');
          log(`    Memory: ${container.resources?.memory || 'Not specified'}`, 'info');
        } else {
          log(`  No container template found in job configuration`, 'warning');
        }
      } else {
        log(`Container App job '${jobName}' not found`, 'error');
        return false;
      }
    } catch (error) {
      log(`Error checking Container App job: ${error.message}`, 'error');
      if (error.statusCode === 404) {
        log(`Container App job '${jobName}' does not exist in resource group '${resourceGroup}'`, 'error');
        log(`Please create the Container App job before using the integration`, 'info');
      }
      return false;
    }
    
    // Step 4: Check managed identity configuration
    log('\nVerifying managed identity configuration', 'info');
    
    // First, find out the function app name
    let functionAppName;
    if (isLocal) {
      log('Running locally, skipping managed identity check', 'warning');
      log('When deploying to Azure, make sure the Function App has a managed identity with permissions to access Container Apps', 'info');
    } else {
      try {
        // Try to get the function app name from the environment (should be added for production)
        functionAppName = process.env.FUNCTION_APP_NAME;
        
        if (!functionAppName) {
          // Try to get function app name from local.settings.json or other configuration
          log('FUNCTION_APP_NAME environment variable not set, trying to determine function app name', 'warning');
          
          // Try to get it from the Static Web App configuration
          try {
            const swaConfigPath = join(__dirname, '..', 'swa-cli.config.json');
            const swaConfig = JSON.parse(readFileSync(swaConfigPath, 'utf8'));
            functionAppName = swaConfig.api?.app || null;
            
            if (functionAppName) {
              log(`Found function app name from SWA config: ${functionAppName}`, 'info');
            }
          } catch (configError) {
            log(`Could not determine function app name from SWA config: ${configError.message}`, 'warning');
          }
          
          // If still not found, try using Azure CLI to list function apps
          if (!functionAppName) {
            try {
              log('Attempting to list function apps using Azure CLI', 'info');
              const functionAppsJson = execSync(`az functionapp list --subscription ${subscriptionId} --query "[].{name:name, resourceGroup:resourceGroup}" -o json`, { encoding: 'utf8' });
              const functionApps = JSON.parse(functionAppsJson);
              
              if (functionApps.length > 0) {
                log(`Found ${functionApps.length} function apps in subscription:`, 'info');
                functionApps.forEach((app, index) => {
                  log(`  ${index + 1}. ${app.name} (Resource Group: ${app.resourceGroup})`, 'info');
                });
                
                // If there's only one function app, use it
                if (functionApps.length === 1) {
                  functionAppName = functionApps[0].name;
                  log(`Using the only function app found: ${functionAppName}`, 'info');
                } else {
                  log('Multiple function apps found. Please specify FUNCTION_APP_NAME in environment variables', 'warning');
                  
                  // Try to find a function app with "template-doctor" in the name
                  const templateDoctorApp = functionApps.find(app => app.name.includes('template-doctor'));
                  if (templateDoctorApp) {
                    functionAppName = templateDoctorApp.name;
                    log(`Using function app with 'template-doctor' in the name: ${functionAppName}`, 'info');
                  }
                }
              } else {
                log('No function apps found in the subscription', 'error');
              }
            } catch (cliError) {
              log(`Error using Azure CLI to list function apps: ${cliError.message}`, 'error');
            }
          }
        }
        
        if (functionAppName) {
          log(`Checking managed identity for function app: ${functionAppName}`, 'info');
          
          // Get function app details to check identity
          const webSiteClient = new WebSiteManagementClient(credential, subscriptionId);
          const functionApp = await webSiteClient.webApps.get(resourceGroup, functionAppName);
          
          if (functionApp.identity) {
            log(`Function App has identity configuration:`, 'success');
            log(`  Type: ${functionApp.identity.type}`, 'info');
            
            if (functionApp.identity.type === 'SystemAssigned') {
              log(`  Principal ID: ${functionApp.identity.principalId}`, 'info');
              
              // Check if the managed identity has permissions to Container Apps
              log(`Checking role assignments for managed identity`, 'info');
              
              const authClient = new AuthorizationManagementClient(credential, subscriptionId);
              const scope = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}`;
              
              try {
                const roleAssignments = await authClient.roleAssignments.listForScope(scope);
                
                const relevantRoles = roleAssignments.filter(role => 
                  role.principalId === functionApp.identity.principalId
                );
                
                if (relevantRoles.length > 0) {
                  log(`Found ${relevantRoles.length} role assignments for the managed identity:`, 'success');
                  
                  for (const role of relevantRoles) {
                    try {
                      const roleDefinition = await authClient.roleDefinitions.getById(role.roleDefinitionId);
                      log(`  Role: ${roleDefinition.roleName || role.roleDefinitionId}`, 'info');
                    } catch {
                      log(`  Role: ${role.roleDefinitionId}`, 'info');
                    }
                  }
                  
                  // Check for Container Apps contributor role
                  const containerAppsContributor = relevantRoles.some(async role => {
                    try {
                      const roleDefinition = await authClient.roleDefinitions.getById(role.roleDefinitionId);
                      return roleDefinition.roleName === 'Container Apps Contributor' || 
                             roleDefinition.roleName === 'Contributor' ||
                             roleDefinition.roleName === 'Owner';
                    } catch {
                      return false;
                    }
                  });
                  
                  if (containerAppsContributor) {
                    log('Managed identity has appropriate permissions to access Container Apps', 'success');
                  } else {
                    log('Managed identity may not have appropriate permissions to access Container Apps', 'warning');
                    log('Please assign "Container Apps Contributor" role to the managed identity', 'info');
                  }
                } else {
                  log('No role assignments found for the managed identity', 'error');
                  log('Please assign "Container Apps Contributor" role to the managed identity', 'info');
                }
              } catch (roleError) {
                log(`Error checking role assignments: ${roleError.message}`, 'error');
              }
            } else if (functionApp.identity.type === 'UserAssigned') {
              log(`  User Assigned Identities: ${Object.keys(functionApp.identity.userAssignedIdentities || {}).join(', ')}`, 'info');
              log('User-assigned managed identities are supported, but require additional verification', 'warning');
              log('Please ensure the user-assigned identity has "Container Apps Contributor" role', 'info');
            } else {
              log(`  No principal ID found for identity type ${functionApp.identity.type}`, 'warning');
            }
          } else {
            log('Function App does not have managed identity configured', 'error');
            log('Please enable system-assigned managed identity for the Function App', 'info');
          }
        } else {
          log('Could not determine function app name, skipping managed identity check', 'error');
          log('Please set FUNCTION_APP_NAME environment variable or check your Azure configuration', 'info');
        }
      } catch (error) {
        log(`Error checking managed identity: ${error.message}`, 'error');
      }
    }
  } catch (error) {
    log(`Error during verification: ${error.message}`, 'error');
    return false;
  }
  
  log('\nVerification complete', 'info');
  return true;
}

// Execute verification
verifySetup().then(success => {
  if (success) {
    log('\nAll checks completed. Some warnings may need attention.', 'info');
    process.exit(0);
  } else {
    log('\nVerification failed. Please address the issues above.', 'error');
    process.exit(1);
  }
}).catch(error => {
  log(`Unhandled error: ${error.message}`, 'error');
  process.exit(1);
});
