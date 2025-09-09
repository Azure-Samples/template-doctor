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
    const versionedPath = '/api/v4/client-settings';
    const configUrl = isLocalhost
      ? `http://localhost:${localPort}${versionedPath}`
      : versionedPath;
    console.log('[config-loader] fetching environment config (v4 only):', configUrl);

    const response = await fetch(configUrl);
    if (!response.ok) {
      console.error('[config-loader] failed to fetch required v4 client-settings endpoint', response.status);
      throw new Error('Failed to load client settings from v4 API');
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
    const response = await fetch('./config.json', { cache: 'no-store' });
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

  // Start with config.json
  const config = { ...configJson };

  // If the environment endpoint provided a backend section, merge it
  if (envVars && typeof envVars === 'object') {
    // Merge backend baseUrl and functionKey if provided by env (non-empty only)
    if (envVars.backend && typeof envVars.backend === 'object') {
      const mergedBackend = { ...(config.backend || {}) };
      if (
        typeof envVars.backend.baseUrl === 'string' &&
        envVars.backend.baseUrl.trim().length > 0
      ) {
        mergedBackend.baseUrl = envVars.backend.baseUrl;
      }
      if (
        typeof envVars.backend.functionKey === 'string' &&
        envVars.backend.functionKey.trim().length > 0
      ) {
        mergedBackend.functionKey = envVars.backend.functionKey;
      }
      if (
        typeof envVars.backend.apiVersion === 'string' &&
        envVars.backend.apiVersion.trim().length > 0
      ) {
        mergedBackend.apiVersion = envVars.backend.apiVersion.trim();
      }
      config.backend = mergedBackend;
    }
    // Merge OAuth client id if present
    if (envVars.GITHUB_CLIENT_ID) {
      config.githubOAuth = {
        ...(config.githubOAuth || {}),
        clientId: envVars.GITHUB_CLIENT_ID,
        // Preserve existing scope/redirect if present
        scope: (config.githubOAuth && config.githubOAuth.scope) || 'repo read:user',
        redirectUri: (config.githubOAuth && config.githubOAuth.redirectUri) || '',
      };
    }
    // Frontend behavior flags from env (strings); leave mapping to runtime-config.js
    if (
      typeof envVars.DEFAULT_RULE_SET === 'string' &&
      envVars.DEFAULT_RULE_SET.trim().length > 0
    ) {
      config.DEFAULT_RULE_SET = envVars.DEFAULT_RULE_SET;
    }
    if (
      typeof envVars.REQUIRE_AUTH_FOR_RESULTS === 'string' &&
      envVars.REQUIRE_AUTH_FOR_RESULTS.trim().length > 0
    ) {
      config.REQUIRE_AUTH_FOR_RESULTS = envVars.REQUIRE_AUTH_FOR_RESULTS;
    }
    if (
      typeof envVars.AUTO_SAVE_RESULTS === 'string' &&
      envVars.AUTO_SAVE_RESULTS.trim().length > 0
    ) {
      config.AUTO_SAVE_RESULTS = envVars.AUTO_SAVE_RESULTS;
    }
    if (typeof envVars.ARCHIVE_ENABLED === 'string' && envVars.ARCHIVE_ENABLED.trim().length > 0) {
      config.ARCHIVE_ENABLED = envVars.ARCHIVE_ENABLED;
    }
    if (
      typeof envVars.ARCHIVE_COLLECTION === 'string' &&
      envVars.ARCHIVE_COLLECTION.trim().length > 0
    ) {
      config.ARCHIVE_COLLECTION = envVars.ARCHIVE_COLLECTION;
    }
    if (
      typeof envVars.DISPATCH_TARGET_REPO === 'string' &&
      envVars.DISPATCH_TARGET_REPO.trim().length > 0
    ) {
      config.DISPATCH_TARGET_REPO = envVars.DISPATCH_TARGET_REPO;
    }
  }

  // Additional env variables can be merged above as needed

  console.log('Consolidated config:', config);
  return config;
}

// Export the config loader
window.ConfigLoader = {
  loadConfig,
};
