// Test dashboard renderer security pill detection

// Create a mock issue with the security issue flag
const securityIssue = {
  id: 'bicep-missing-auth-containerRegistry-registry-access.bicep',
  severity: 'warning',
  message: 'Recommendation: Add Managed Identity for Container Registry in registry-access.bicep',
  error: 'File registry-access.bicep contains Container Registry resource without Managed Identity authentication',
  recommendation: 'Configure Managed Identity for secure access to Container Registry in this specific module.',
  securityIssue: true
};

// Simulate the logic from dashboard-renderer.js
function detectSecurityIssue(issue) {
  const hasSecurityFlag = issue.securityIssue === true;
  const hasBicepAuthId = issue.id?.includes('bicep-alternative-auth') || issue.id?.includes('bicep-missing-auth');
  const hasSecurityRecommendation = issue.message?.includes('Recommendation');
  const hasManagedIdentityMessage = issue.message?.includes('Managed Identity');
  const hasSecurity = issue.message?.includes('security') || issue.message?.includes('Security');
  
  // Use the explicit securityIssue flag if present, otherwise use our detection logic
  const isSecurityIssue = hasSecurityFlag || hasBicepAuthId || hasSecurityRecommendation || hasManagedIdentityMessage || hasSecurity;
  
  return {
    isSecurityIssue,
    hasSecurityFlag,
    hasBicepAuthId,
    hasSecurityRecommendation,
    hasManagedIdentityMessage,
    hasSecurity
  };
}

// Test with our mock issue
const result = detectSecurityIssue(securityIssue);

console.log("Security Issue Detection Test:");
console.log("=============================");
console.log("Issue ID:", securityIssue.id);
console.log("Issue Message:", securityIssue.message);
console.log("Detection Results:");
console.log("- Has explicit securityIssue flag:", result.hasSecurityFlag ? "Yes" : "No");
console.log("- Has bicep auth ID pattern:", result.hasBicepAuthId ? "Yes" : "No");
console.log("- Has 'Recommendation' in message:", result.hasSecurityRecommendation ? "Yes" : "No");
console.log("- Has 'Managed Identity' in message:", result.hasManagedIdentityMessage ? "Yes" : "No");
console.log("- Has 'security'/'Security' in message:", result.hasSecurity ? "Yes" : "No");
console.log("- FINAL RESULT - Is Security Issue:", result.isSecurityIssue ? "Yes" : "No");
console.log("\nIf FINAL RESULT is 'Yes', the security pill will be displayed in the UI");