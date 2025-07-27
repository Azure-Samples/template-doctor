// Test script for the GitHub issue handler
// This simulates how the github-issue-handler.js might be used in a real environment

// Import the handler script (in a real environment, this would be done via script tag)
const fs = require('fs');
const path = require('path');

// Read the handler script
const handlerScriptPath = path.join(__dirname, 'templates', 'github-issue-handler.js');
const handlerScript = fs.readFileSync(handlerScriptPath, 'utf8');

// Create a minimal mock environment
global.window = {
  templateDoctor: {}
};

// Create mock fetch function that simulates GitHub API responses
global.fetch = async (url, options) => {
  console.log(`Mock fetch called with URL: ${url}`);
  console.log('Request options:', options);
  
  // Parse the request body
  const body = JSON.parse(options.body);
  console.log('Request body:', body);
  
  // Simulate different responses based on the URL or other conditions
  if (url.includes('github-issue')) {
    // Simulate disabled issues response
    return {
      ok: false,
      status: 410,
      json: async () => ({
        message: "Issues are disabled for this repo",
        documentation_url: "https://docs.github.com/v3/issues/",
        status: "410",
        code: "ISSUES_DISABLED"
      })
    };
  }
  
  // Default success response
  return {
    ok: true,
    json: async () => ({ html_url: 'https://github.com/org/repo/issues/1', number: 1 })
  };
};

// Add console.error mock
const originalConsoleError = console.error;
console.error = (...args) => {
  originalConsoleError('CAPTURED ERROR LOG:', ...args);
};

// Evaluate the handler script
eval(handlerScript);

// Now test the GitHub issue handler
async function testHandler() {
  console.log('Testing createGitHubIssue function...');
  
  // Define test data
  const url = 'http://localhost:3000/api/github-issue';
  const data = {
    repoUrl: 'https://github.com/org/repo',
    title: 'Test Issue',
    body: 'This is a test issue'
  };
  
  // Define success and error callbacks
  const onSuccess = (result) => {
    console.log('SUCCESS CALLBACK RECEIVED:', result);
  };
  
  const onError = (error, isHtml) => {
    console.log('ERROR CALLBACK RECEIVED:');
    console.log('Is HTML content:', isHtml);
    console.log(error);
  };
  
  // Call the function
  try {
    await window.templateDoctor.github.createIssue(url, data, onSuccess, onError);
    console.log('Function completed');
  } catch (error) {
    console.error('Function threw error:', error);
  }
}

// Run the test
testHandler();
