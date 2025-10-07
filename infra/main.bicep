// Main Bicep template for Template Doctor Azure Container App deployment with EasyAuth
targetScope = 'resourceGroup'

@description('Name of the Container Apps environment')
param environmentName string = 'template-doctor-env'

@description('Name of the container app')
param containerAppName string = 'template-doctor'

@description('Location for all resources')
param location string = resourceGroup().location

@description('Container image for the application')
param containerImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('Target port for the container')
param targetPort int = 3000

@description('GitHub OAuth Client ID for EasyAuth')
@secure()
param githubClientId string

@description('GitHub OAuth Client Secret for EasyAuth')
@secure()
param githubClientSecret string

@description('GitHub Token for API calls')
@secure()
param githubToken string

@description('GitHub Workflow Token')
@secure()
param ghWorkflowToken string

@description('Allowed GitHub usernames for setup endpoint (comma-separated)')
param setupAllowedUsers string = ''

@description('Configuration Gist ID')
param configGistId string = ''

@description('Default ruleset')
param defaultRuleSet string = 'dod'

@description('Require authentication for results')
param requireAuthForResults bool = true

@description('Enable archiving')
param archiveEnabled bool = false

@description('Archive collection name')
param archiveCollection string = 'aigallery'

@description('Dispatch target repository')
param dispatchTargetRepo string = 'Template-Doctor/template-doctor'

@description('Enable AI issue assistance')
param issueAiEnabled bool = false

// Create Log Analytics workspace
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${environmentName}-logs'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// Create Container Apps Environment
resource environment 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: environmentName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// Create User Assigned Managed Identity
resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${containerAppName}-identity'
  location: location
}

// Container App with EasyAuth enabled
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: containerAppName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      ingress: {
        external: true
        targetPort: targetPort
        transport: 'auto'
        allowInsecure: false
      }
      secrets: [
        {
          name: 'github-client-id'
          value: githubClientId
        }
        {
          name: 'github-client-secret'
          value: githubClientSecret
        }
        {
          name: 'github-token'
          value: githubToken
        }
        {
          name: 'gh-workflow-token'
          value: ghWorkflowToken
        }
      ]
    }
    template: {
      containers: [
        {
          name: containerAppName
          image: containerImage
          env: [
            {
              name: 'PORT'
              value: string(targetPort)
            }
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'GITHUB_CLIENT_ID'
              secretRef: 'github-client-id'
            }
            {
              name: 'GITHUB_CLIENT_SECRET'
              secretRef: 'github-client-secret'
            }
            {
              name: 'GITHUB_TOKEN'
              secretRef: 'github-token'
            }
            {
              name: 'GH_WORKFLOW_TOKEN'
              secretRef: 'gh-workflow-token'
            }
            {
              name: 'DEFAULT_RULE_SET'
              value: defaultRuleSet
            }
            {
              name: 'REQUIRE_AUTH_FOR_RESULTS'
              value: string(requireAuthForResults)
            }
            {
              name: 'ARCHIVE_ENABLED'
              value: string(archiveEnabled)
            }
            {
              name: 'ARCHIVE_COLLECTION'
              value: archiveCollection
            }
            {
              name: 'DISPATCH_TARGET_REPO'
              value: dispatchTargetRepo
            }
            {
              name: 'ISSUE_AI_ENABLED'
              value: string(issueAiEnabled)
            }
            {
              name: 'SETUP_ALLOWED_USERS'
              value: setupAllowedUsers
            }
            {
              name: 'CONFIG_GIST_ID'
              value: configGistId
            }
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/health'
                port: targetPort
                scheme: 'HTTP'
              }
              initialDelaySeconds: 10
              periodSeconds: 10
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/api/health'
                port: targetPort
                scheme: 'HTTP'
              }
              initialDelaySeconds: 5
              periodSeconds: 5
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '10'
              }
            }
          }
        ]
      }
    }
  }
}

// EasyAuth configuration for GitHub authentication
resource authConfig 'Microsoft.App/containerApps/authConfigs@2023-05-01' = {
  name: 'current'
  parent: containerApp
  properties: {
    platform: {
      enabled: true
    }
    globalValidation: {
      unauthenticatedClientAction: 'RedirectToLoginPage'
      redirectToProvider: 'github'
    }
    identityProviders: {
      gitHub: {
        enabled: true
        registration: {
          clientId: githubClientId
          clientSecretSettingName: 'github-client-secret'
        }
        login: {
          scopes: [
            'read:user'
            'public_repo'
          ]
        }
      }
    }
    login: {
      preserveUrlFragmentsForLogins: true
      allowedExternalRedirectUrls: []
      cookieExpiration: {
        convention: 'IdentityProviderDerived'
      }
      nonce: {
        validateNonce: true
      }
    }
  }
}

// Outputs
output containerAppFQDN string = containerApp.properties.configuration.ingress.fqdn
output containerAppUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output managedIdentityPrincipalId string = managedIdentity.properties.principalId
output managedIdentityClientId string = managedIdentity.properties.clientId
