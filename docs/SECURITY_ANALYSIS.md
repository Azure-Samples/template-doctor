# Security Analysis in Template Doctor

Template Doctor now includes advanced security analysis features for Azure Bicep templates. These features help identify potential security risks and promote best practices for Azure resource authentication.

## Key Security Features

### 1. Managed Identity Detection

Managed Identity is the recommended authentication mechanism for Azure services. Template Doctor checks for the proper use of Managed Identity in Bicep files by identifying patterns like:

```bicep
resource webApp 'Microsoft.Web/sites@2022-03-01' = {
  // ...
  identity: {
    type: 'SystemAssigned'
  }
  // ...
}
```

or

```bicep
resource functionApp 'Microsoft.Web/sites@2022-03-01' = {
  // ...
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${userAssignedIdentity.id}': {}
    }
  }
  // ...
}
```

### 2. Insecure Authentication Detection

Template Doctor identifies potentially insecure authentication methods in Bicep templates, including:

- **Connection Strings with Credentials**: Embedded credentials in connection strings
- **Access Keys**: Primary/secondary keys that could be leaked
- **SAS Tokens**: Shared Access Signatures that may be overly permissive
- **Storage Account Keys**: Direct use of storage account keys
- **KeyVault Secrets without Managed Identity**: Accessing KeyVault without using Managed Identity

Example of insecure pattern:

```bicep
resource appService 'Microsoft.Web/sites@2022-03-01' = {
  // ...
  properties: {
    siteConfig: {
      appSettings: [
        {
          name: 'StorageConnectionString'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
      ]
    }
  }
  // ...
}
```

Recommended secure pattern using Managed Identity:

```bicep
resource appService 'Microsoft.Web/sites@2022-03-01' = {
  // ...
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    siteConfig: {
      appSettings: [
        {
          name: 'StorageAccountName'
          value: storageAccount.name
        }
      ]
    }
  }
  // ...
}

resource storageRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, appService.id, 'storage-blob-data-contributor')
  scope: storageAccount
  properties: {
    principalId: appService.identity.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe') // Storage Blob Data Contributor
    principalType: 'ServicePrincipal'
  }
}
```

### 3. Anonymous Access Detection

Template Doctor identifies Azure resources that typically require authentication but may be configured for anonymous access. This includes resources like:

- Storage Accounts
- Key Vault
- Cosmos DB
- SQL Server
- App Services
- API Management
- Cognitive Services
- AKS Clusters
- Redis Cache
- Search Services

When these resources are found without any authentication method specified, Template Doctor will suggest implementing Managed Identity to ensure secure access.

## Configuration

These security checks can be enabled or disabled in the ruleset configuration files:

```json
"bicepChecks": {
  "requiredResources": ["Microsoft.Resources/resourceGroups", "Microsoft.KeyVault/vaults"],
  "securityBestPractices": {
    "preferManagedIdentity": true,
    "detectInsecureAuth": true,
    "checkAnonymousAccess": true
  }
}
```

- **preferManagedIdentity**: Recommend using Managed Identity as the preferred authentication method
- **detectInsecureAuth**: Check for insecure authentication methods and recommend alternatives
- **checkAnonymousAccess**: Identify resources that may have anonymous access

## Best Practices

1. **Always use Managed Identity**: Configure Managed Identity for Azure services that support it
2. **Avoid embedding secrets**: Don't embed connection strings or access keys in Bicep templates
3. **Use role-based access control (RBAC)**: Assign appropriate RBAC roles to Managed Identities
4. **KeyVault integration**: Store secrets in KeyVault and access them using Managed Identity
5. **Restrict public access**: Configure firewalls and network rules to restrict access to resources

By following these best practices and addressing the issues identified by Template Doctor, you can significantly improve the security of your Azure deployments.