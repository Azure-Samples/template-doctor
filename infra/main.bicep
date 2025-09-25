@description('The location for all resources')
param location string = resourceGroup().location

@description('The name of the application')
param name string

@description('The environment name (e.g., dev, staging, prod)')
param environmentName string

@description('Tags to apply to all resources')
param tags object = {}

// Generate a unique name for the Static Web App
var staticWebAppName = '${name}-${environmentName}'

// Deploy Azure Static Web App using Azure Verified Module
module doctorswa 'br/public:avm/res/web/static-site:0.3.0' = {
  name: 'staticweb'
  params: {
    name: staticWebAppName
    location: location
    provider: 'Custom'
    tags: union(tags, { 'azd-service-name': 'doctor' })
  }
}

// Output the Static Web App URL and deployment token
@description('The URL of the deployed Static Web App')
output AZURE_STATIC_WEB_APPS_URL string = 'https://${doctorswa.outputs.defaultHostname}'

@description('The Static Web App name')
output STATIC_WEB_APP_NAME string = doctorswa.outputs.name

@description('The Static Web App resource ID')
output STATIC_WEB_APP_RESOURCE_ID string = doctorswa.outputs.resourceId
