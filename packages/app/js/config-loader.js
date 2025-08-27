// Config loader for Template Doctor
// Loads configuration from multiple sources and consolidates them

/**
 * Configuration can be loaded from multiple sources:
 * 1. config.json file in the app directory
 * 2. Environment variables via the runtime-config API
 * 
 * For local development, the port for the Azure Functions API can be configured:
 * - Set window.LOCAL_FUNCTIONS_PORT in JavaScript
 * - Add ?funcPort=xxxx to the URL query parameters
 */

// Load environment variables if they exist
async function loadEnvironmentVariables() {
  // For client-side code, we can't directly access process.env
  // We'll use a server-side endpoint to get environment variables
  try {
    const isLocalhost = window.location.hostname === 'localhost';
    
    // Allow port override via window.LOCAL_FUNCTIONS_PORT or ?funcPort=xxxx
    let localPort = 7071; // Default Azure Functions port
    if (window.LOCAL_FUNCTIONS_PORT) {
      localPort = window.LOCAL_FUNCTIONS_PORT;
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('funcPort')) {
        localPort = urlParams.get('funcPort');
      }
    }
    
    // Use local Functions port in pure localhost dev, otherwise use SWA-managed /api proxy
    const configUrl = isLocalhost
      ? `http://localhost:${localPort}/api/runtime-config`
      : '/api/runtime-config';
    
    const response = await fetch(configUrl);
    if (!response.ok) {
      console.warn('Unable to fetch environment config', response.status);
      return {};
    }
    
    const data = await response.json();
    console.log('Loaded environment config:', Object.keys(data));
    return data;
  } catch (error) {
    console.warn('Error loading environment variables:', error);
    return {};
  }
}

// Load config.json
async function loadConfigJson() {
  try {
    const response = await fetch('./config.json');
    if (!response.ok) {
      console.warn('Unable to fetch config.json', response.status);
      return {};
    }
    
    const data = await response.json();
    console.log('Loaded config.json:', Object.keys(data));
    return data;
  } catch (error) {
    console.warn('Error loading config.json:', error);
    return {};
  }
}

// Consolidate configurations with environment variables taking precedence
async function loadConfig() {
  const configJson = await loadConfigJson();
  const envVars = await loadEnvironmentVariables();
  
  // Deep merge
  const config = { ...configJson };
  
  // Override OAuth client ID from environment if available
  if (envVars.GITHUB_CLIENT_ID && config.githubOAuth) {
    config.githubOAuth.clientId = envVars.GITHUB_CLIENT_ID;
  }
  
  // Add additional environment variables as needed
  
  console.log('Consolidated config:', config);
  return config;
}

// Export the config loader
window.ConfigLoader = {
  loadConfig
};