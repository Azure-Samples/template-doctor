// Main infrastructure template for Template Doctor
// Deploys Cosmos DB (MongoDB API) + Container App

targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the environment (e.g., dev, test, prod)')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
param location string

// GitHub configuration (read from .env file by azd)
@secure()
@description('GitHub OAuth Client ID - set in .env as GITHUB_CLIENT_ID')
param githubClientId string = ''

@secure()
@description('GitHub OAuth Client Secret - set in .env as GITHUB_CLIENT_SECRET')
param githubClientSecret string = ''

@secure()
@description('GitHub Personal Access Token - set in .env as GITHUB_TOKEN (scopes: repo, workflow, read:org)')
param githubToken string = ''

@secure()
@description('GitHub Workflow Token - set in .env as GH_WORKFLOW_TOKEN (for workflow dispatch)')
param ghWorkflowToken string = ''

@description('Comma-separated list of GitHub usernames with admin access')
param adminGitHubUsers string = ''

// Tags to apply to all resources
var tags = {
  'azd-env-name': environmentName
  app: 'template-doctor'
}

// Generate abbreviated location name for resource naming
var abbrs = loadJsonContent('./abbreviations.json')
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))

// Resource Group
resource rg 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: '${abbrs.resourcesResourceGroups}${environmentName}'
  location: location
  tags: tags
}

// Cosmos DB Module - Deploy FIRST (no dependencies)
module cosmos './database.bicep' = {
  name: 'cosmos-db-deployment'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
    logAnalyticsWorkspaceId: containerAppsEnvironment.outputs.logAnalyticsWorkspaceId
  }
  dependsOn: [
    containerAppsEnvironment
  ]
}

// Container Apps Environment
module containerAppsEnvironment 'core/host/container-apps-environment.bicep' = {
  name: 'container-apps-environment'
  scope: rg
  params: {
    name: '${abbrs.appManagedEnvironments}${resourceToken}'
    location: location
    tags: tags
  }
}

// Container Registry
module containerRegistry 'core/host/container-registry.bicep' = {
  name: 'container-registry'
  scope: rg
  params: {
    name: '${abbrs.containerRegistryRegistries}${resourceToken}'
    location: location
    tags: tags
  }
}

// Container App
module containerApp 'core/host/container-app.bicep' = {
  name: 'container-app'
  scope: rg
  params: {
    name: '${abbrs.appContainerApps}web-${resourceToken}'
    location: location
    tags: tags
    containerAppsEnvironmentName: containerAppsEnvironment.outputs.name
    containerRegistryName: containerRegistry.outputs.name
    githubClientId: githubClientId
    githubClientSecret: githubClientSecret
    githubToken: githubToken
    ghWorkflowToken: ghWorkflowToken
    env: concat([
      {
        name: 'COSMOS_ENDPOINT'
        value: 'https://${cosmos.outputs.cosmosAccountName}.documents.azure.com'
      }
      {
        name: 'COSMOS_DATABASE_NAME'
        value: cosmos.outputs.cosmosDatabaseName
      }
      {
        name: 'NODE_ENV'
        value: 'production'
      }
      {
        name: 'PORT'
        value: '3000'
      }
      {
        name: 'FRONTEND_DIST_PATH'
        value: '/app/app/dist'
      }
      {
        name: 'GITHUB_TOKEN_ANALYZER'
        secretRef: 'github-token'
      }
      {
        name: 'ADMIN_GITHUB_USERS'
        value: adminGitHubUsers
      }
      {
        name: 'DEFAULT_RULE_SET'
        value: 'dod'
      }
      {
        name: 'REQUIRE_AUTH_FOR_RESULTS'
        value: 'true'
      }
      {
        name: 'AUTO_SAVE_RESULTS'
        value: 'false'
      }
      {
        name: 'ARCHIVE_ENABLED'
        value: 'false'
      }
      {
        name: 'ARCHIVE_COLLECTION'
        value: 'aigallery'
      }
      {
        name: 'DISPATCH_TARGET_REPO'
        value: 'Template-Doctor/template-doctor'
      }
      {
        name: 'ISSUE_AI_ENABLED'
        value: 'false'
      }
    ], githubClientId != '' ? [{
      name: 'GITHUB_CLIENT_ID'
      secretRef: 'github-client-id'
    }] : [], githubClientSecret != '' ? [{
      name: 'GITHUB_CLIENT_SECRET'
      secretRef: 'github-client-secret'
    }] : [], githubToken != '' ? [{
      name: 'GITHUB_TOKEN'
      secretRef: 'github-token'
    }] : [], ghWorkflowToken != '' ? [{
      name: 'GH_WORKFLOW_TOKEN'
      secretRef: 'gh-workflow-token'
    }] : [])
    secrets: []
    targetPort: 3000
    enableIngress: true
    external: true
  }
}

// Grant Container App's Managed Identity access to Cosmos DB
// This must be a separate module to avoid circular dependency
module cosmosRoleAssignment './cosmos-role-assignment.bicep' = {
  name: 'cosmos-role-assignment'
  scope: rg
  params: {
    cosmosAccountName: cosmos.outputs.cosmosAccountName
    principalId: containerApp.outputs.principalId
  }
}

// Outputs
output AZURE_LOCATION string = location
output AZURE_RESOURCE_GROUP string = rg.name
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = containerRegistry.outputs.loginServer
output AZURE_CONTAINER_REGISTRY_NAME string = containerRegistry.outputs.name
output AZURE_CONTAINER_APPS_ENVIRONMENT_NAME string = containerAppsEnvironment.outputs.name
output AZURE_CONTAINER_APPS_ENVIRONMENT_ID string = containerAppsEnvironment.outputs.id
output SERVICE_WEB_NAME string = containerApp.outputs.name
output SERVICE_WEB_URI string = containerApp.outputs.uri
output SERVICE_WEB_IMAGE_NAME string = '${containerRegistry.outputs.loginServer}/template-doctor/web-${environmentName}:latest'
output SERVICE_WEB_IDENTITY_PRINCIPAL_ID string = containerApp.outputs.principalId
output COSMOS_ACCOUNT_NAME string = cosmos.outputs.cosmosAccountName
output COSMOS_DATABASE_NAME string = cosmos.outputs.cosmosDatabaseName
output COSMOS_ENDPOINT string = 'https://${cosmos.outputs.cosmosAccountName}.documents.azure.com'
