// Cosmos DB with MongoDB API for Template Doctor
// Provisions serverless Cosmos DB with Managed Identity RBAC

param location string = resourceGroup().location
param environmentName string
param logAnalyticsWorkspaceId string

// Generate unique resource name
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))

// Cosmos DB Account with MongoDB API
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: 'cosmos-${resourceToken}'
  location: location
  kind: 'MongoDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    enableAutomaticFailover: false
    enableMultipleWriteLocations: false
    isVirtualNetworkFilterEnabled: false
    publicNetworkAccess: 'Enabled'
    capabilities: [
      {
        name: 'EnableMongo'
      }
      {
        name: 'EnableServerless'
      }
      {
        name: 'DisableRateLimitingResponses' // Prevent 429 throttling in dev
      }
    ]
    apiProperties: {
      serverVersion: '4.2' // MongoDB 4.2 compatible
    }
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    backupPolicy: {
      type: 'Continuous'
      continuousModeProperties: {
        tier: 'Continuous7Days' // 7-day point-in-time restore
      }
    }
  }
  tags: {
    environment: environmentName
    service: 'template-doctor'
  }
}

// MongoDB Database
resource mongoDatabase 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases@2024-05-15' = {
  parent: cosmosAccount
  name: 'template-doctor'
  properties: {
    resource: {
      id: 'template-doctor'
    }
  }
}

// Collections are created via MongoDB driver code (not Bicep) for:
// - templates
// - scans  
// - validation_runs

// NOTE: Role assignment is done in a separate module (cosmos-role-assignment.bicep)
// to avoid circular dependency between Cosmos DB and Container App

// Diagnostic Settings for Monitoring
resource diagnosticSettings 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'cosmos-diagnostics'
  scope: cosmosAccount
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        category: 'MongoRequests'
        enabled: true
      }
      {
        category: 'QueryRuntimeStatistics'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'Requests'
        enabled: true
      }
    ]
  }
}

// Outputs for application configuration
// SECURITY: Only expose non-sensitive metadata
// Connection strings should be retrieved securely via Key Vault or Managed Identity
output cosmosAccountName string = cosmosAccount.name
output cosmosDatabaseName string = mongoDatabase.name
output cosmosAccountId string = cosmosAccount.id

// NOTE: Connection strings are NOT exposed as outputs for security reasons
// Use one of these secure methods instead:
// 1. Managed Identity with DefaultAzureCredential (recommended)
// 2. Store connection string in Key Vault and reference as secret
// 3. Use Azure CLI: az cosmosdb keys list --type connection-strings
