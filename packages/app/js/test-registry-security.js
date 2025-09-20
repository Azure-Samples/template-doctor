// Test script for Container Registry security detection
// Create a minimal browser environment
global.window = {};
global.console = console;

const fs = require('fs');
const analyzerPath = './analyzer.js';

// Load the analyzer script content
const analyzerContent = fs.readFileSync(analyzerPath, 'utf8');

// Extract the Analyzer class code
let analyzerClassCode = analyzerContent.match(/class Analyzer {[\s\S]*?}[\s\S]*?}/)[0];

// Create a simplified version of the Analyzer class for testing
const testAnalyzer = `
${analyzerClassCode}

// Test with a Container Registry Bicep file
const bicepContent = \`
resource containerRegistry 'Microsoft.ContainerRegistry/registries@2021-06-01-preview' = {
  name: 'myRegistry'
  location: resourceGroup().location
  sku: {
    name: 'Premium'
  }
  properties: {
    adminUserEnabled: false  // Good practice
  }
}
\`;

// Initialize the analyzer with mock config
const analyzer = new Analyzer();
analyzer.getConfig = () => ({ 
  bicepChecks: { 
    securityBestPractices: { 
      checkAnonymousAccess: true, 
      detectInsecureAuth: true 
    } 
  } 
});

// Run the analysis
const issues = [];
const compliant = [];
analyzer.analyzeAuthenticationMethods(bicepContent, 'registry-access.bicep', issues, compliant);

// Display results
console.log('Issues found:', issues.length);
issues.forEach((issue, index) => {
  console.log(\`Issue \${index + 1}:\`, issue.message);
  console.log('Is Security Issue:', issue.securityIssue === true ? 'Yes' : 'No');
  console.log('-'.repeat(50));
});

console.log('Compliant items:', compliant.length);
compliant.forEach((item, index) => {
  console.log(\`Compliant \${index + 1}:\`, item.message);
  console.log('-'.repeat(50));
});
`;

// Write to a temporary test file
const testFilePath = './temp-registry-test.js';
fs.writeFileSync(testFilePath, testAnalyzer);

// Execute the test
require('./temp-registry-test.js');

// Clean up
fs.unlinkSync(testFilePath);