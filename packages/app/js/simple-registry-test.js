// Simple mock test for the container registry security detection

// Create a mock Analyzer class with just the methods we need
class MockAnalyzer {
  constructor() {
    this.config = {
      bicepChecks: {
        securityBestPractices: {
          checkAnonymousAccess: true,
          detectInsecureAuth: true
        }
      }
    };
  }

  getConfig() {
    return this.config;
  }

  checkForManagedIdentity(content) {
    const patterns = [
      /identity:\s*\{\s*type:\s*['"]SystemAssigned['"]/i,
      /identity:\s*\{\s*type:\s*['"]UserAssigned['"]/i,
      /identity:\s*\{\s*type:\s*['"]SystemAssigned,UserAssigned['"]/i,
      /['"]identity['"]\s*:\s*\{\s*['"]type['"]\s*:\s*['"]SystemAssigned['"]/i,
      /['"]identity['"]\s*:\s*\{\s*['"]type['"]\s*:\s*['"]UserAssigned['"]/i,
      /['"]identity['"]\s*:\s*\{\s*['"]type['"]\s*:\s*['"]SystemAssigned,UserAssigned['"]/i,
      /managedIdentities:\s*\{\s*systemAssigned:\s*true/i,
      /managedIdentities:\s*\{\s*userAssignedResourceIds:/i,
    ];

    return patterns.some((pattern) => pattern.test(content));
  }

  detectAuthenticationMethods(content) {
    return []; // Simplified for this test
  }

  detectResourcesRequiringAuth(content) {
    const resources = [];
    const resourcePatterns = [
      { pattern: /Microsoft\.KeyVault\/vaults/i, name: 'Key Vault' },
      { pattern: /resource\s+\w+\s+'Microsoft\.KeyVault\/vaults/i, name: 'Key Vault' },
      { pattern: /type\s*:\s*['"]Microsoft\.KeyVault\/vaults['"]/i, name: 'Key Vault' },
      { pattern: /Microsoft\.ContainerRegistry\/registries/i, name: 'Container Registry' },
      { pattern: /resource\s+\w+\s+'Microsoft\.ContainerRegistry\/registries/i, name: 'Container Registry' },
      { pattern: /type\s*:\s*['"]Microsoft\.ContainerRegistry\/registries['"]/i, name: 'Container Registry' }
    ];

    for (const { pattern, name } of resourcePatterns) {
      if (pattern.test(content)) {
        resources.push(name);
      }
    }

    return resources;
  }

  analyzeAuthenticationMethods(content, file, issues, compliant) {
    // Skip if security checks are not enabled in config
    const config = this.getConfig();
    const securityChecks = config.bicepChecks?.securityBestPractices;
    if (!securityChecks) {
      return;
    }

    // Check for Managed Identity
    const hasManagedIdentity = this.checkForManagedIdentity(content);

    // Check for other authentication methods (sensitive patterns)
    const authMethods = this.detectAuthenticationMethods(content);
    
    // Check for resources requiring auth (KeyVault, Container Registry, etc.)
    const resourcesRequiringAuth = this.detectResourcesRequiringAuth(content);
    const hasKeyVault = resourcesRequiringAuth.includes('Key Vault');
    const hasContainerRegistry = resourcesRequiringAuth.includes('Container Registry');
    
    // Only proceed with checks if we've detected sensitive authentication patterns or security-sensitive resources
    const hasSensitiveAuth = authMethods.length > 0;
    const hasSecuritySensitiveResource = hasKeyVault || hasContainerRegistry;
    
    if (hasManagedIdentity) {
      compliant.push({
        id: `bicep-uses-managed-identity-${file}`,
        category: 'bicepSecurity',
        message: `Good practice: ${file} uses Managed Identity for Azure authentication`,
        details: {
          file: file,
          authMethod: 'ManagedIdentity',
        },
      });
    }

    // Only suggest Managed Identity if this specific file contains sensitive auth patterns
    if (securityChecks.detectInsecureAuth && hasSensitiveAuth) {
      const authMethodsList = authMethods.join(', ');

      issues.push({
        id: `bicep-alternative-auth-${file}`,
        severity: 'warning',
        message: `Recommendation: Replace ${authMethodsList} with Managed Identity in ${file}`,
        error: `File ${file} uses ${authMethodsList} for authentication instead of Managed Identity`,
        recommendation: `Consider replacing ${authMethodsList} with Managed Identity in this specific module for better security.`,
        securityIssue: true,  // Mark as security issue explicitly
      });
    }

    // Suggest adding auth if this specific module has KeyVault but no Managed Identity
    if (securityChecks.checkAnonymousAccess && !hasManagedIdentity && hasKeyVault) {
      issues.push({
        id: `bicep-missing-auth-keyVault-${file}`,
        severity: 'warning',
        message: `Recommendation: Add Managed Identity for Key Vault in ${file}`,
        error: `File ${file} contains Key Vault resource without Managed Identity authentication`,
        recommendation: `Configure Managed Identity for secure access to Key Vault in this specific module.`,
        securityIssue: true,  // Mark as security issue explicitly
      });
    }
    
    // Suggest adding auth if this specific module has Container Registry but no Managed Identity
    if (securityChecks.checkAnonymousAccess && !hasManagedIdentity && hasContainerRegistry) {
      issues.push({
        id: `bicep-missing-auth-containerRegistry-${file}`,
        severity: 'warning',
        message: `Recommendation: Add Managed Identity for Container Registry in ${file}`,
        error: `File ${file} contains Container Registry resource without Managed Identity authentication`,
        recommendation: `Configure Managed Identity for secure access to Container Registry in this specific module.`,
        securityIssue: true,  // Mark as security issue explicitly
      });
    }
  }
}

// Test for Container Registry detection
console.log("Testing Container Registry Security Detection");
console.log("============================================");

// Test case 1: Container Registry without Managed Identity
const registryWithoutMI = `
resource containerRegistry 'Microsoft.ContainerRegistry/registries@2021-06-01-preview' = {
  name: 'myRegistry'
  location: resourceGroup().location
  sku: {
    name: 'Premium'
  }
  properties: {
    adminUserEnabled: false
  }
}`;

const issues1 = [];
const compliant1 = [];
const analyzer1 = new MockAnalyzer();
analyzer1.analyzeAuthenticationMethods(registryWithoutMI, 'registry-access.bicep', issues1, compliant1);

console.log("Test Case 1: Container Registry without Managed Identity");
console.log(`Issues found: ${issues1.length}`);
issues1.forEach((issue, i) => {
  console.log(`  Issue ${i+1}: ${issue.message}`);
  console.log(`  Is Security Issue: ${issue.securityIssue === true ? 'Yes' : 'No'}`);
});
console.log(`Compliant items: ${compliant1.length}`);
console.log("\n");

// Test case 2: Container Registry with Managed Identity
const registryWithMI = `
resource containerRegistry 'Microsoft.ContainerRegistry/registries@2021-06-01-preview' = {
  name: 'myRegistry'
  location: resourceGroup().location
  sku: {
    name: 'Premium'
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    adminUserEnabled: false
  }
}`;

const issues2 = [];
const compliant2 = [];
const analyzer2 = new MockAnalyzer();
analyzer2.analyzeAuthenticationMethods(registryWithMI, 'registry-access.bicep', issues2, compliant2);

console.log("Test Case 2: Container Registry with Managed Identity");
console.log(`Issues found: ${issues2.length}`);
issues2.forEach((issue, i) => {
  console.log(`  Issue ${i+1}: ${issue.message}`);
});
console.log(`Compliant items: ${compliant2.length}`);
compliant2.forEach((item, i) => {
  console.log(`  Compliant ${i+1}: ${item.message}`);
});