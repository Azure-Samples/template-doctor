// @ts-nocheck
// Migrated from js/config-loader.js (behavior preserved)

async function loadEnvironmentVariables() {
  try {
    const isLocalhost = window.location.hostname === 'localhost';
    let localPort: any = 7071;
    if ((window as any).LOCAL_FUNCTIONS_PORT) {
      localPort = (window as any).LOCAL_FUNCTIONS_PORT;
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('funcPort')) {
        localPort = urlParams.get('funcPort');
      }
    }
    const versionedPath = '/api/v4/client-settings';
    const configUrl = isLocalhost ? `http://localhost:${localPort}${versionedPath}` : versionedPath;
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

async function loadConfig() {
  const configJson = await loadConfigJson();
  const envVars = await loadEnvironmentVariables();
  const config: any = { ...configJson };
  if (envVars && typeof envVars === 'object') {
    if (envVars.backend && typeof envVars.backend === 'object') {
      const mergedBackend: any = { ...(config.backend || {}) };
      if (typeof envVars.backend.baseUrl === 'string' && envVars.backend.baseUrl.trim().length > 0) {
        mergedBackend.baseUrl = envVars.backend.baseUrl;
      }
      if (typeof envVars.backend.functionKey === 'string' && envVars.backend.functionKey.trim().length > 0) {
        mergedBackend.functionKey = envVars.backend.functionKey;
      }
      if (typeof envVars.backend.apiVersion === 'string' && envVars.backend.apiVersion.trim().length > 0) {
        mergedBackend.apiVersion = envVars.backend.apiVersion.trim();
      }
      config.backend = mergedBackend;
    }
    if (envVars.GITHUB_CLIENT_ID) {
      config.githubOAuth = {
        ...(config.githubOAuth || {}),
        clientId: envVars.GITHUB_CLIENT_ID,
        scope: (config.githubOAuth && config.githubOAuth.scope) || 'repo read:user',
        redirectUri: (config.githubOAuth && config.githubOAuth.redirectUri) || '',
      };
    }
    if (typeof envVars.DEFAULT_RULE_SET === 'string' && envVars.DEFAULT_RULE_SET.trim().length > 0) {
      config.DEFAULT_RULE_SET = envVars.DEFAULT_RULE_SET;
    }
    if (typeof envVars.REQUIRE_AUTH_FOR_RESULTS === 'string' && envVars.REQUIRE_AUTH_FOR_RESULTS.trim().length > 0) {
      config.REQUIRE_AUTH_FOR_RESULTS = envVars.REQUIRE_AUTH_FOR_RESULTS;
    }
    if (typeof envVars.AUTO_SAVE_RESULTS === 'string' && envVars.AUTO_SAVE_RESULTS.trim().length > 0) {
      config.AUTO_SAVE_RESULTS = envVars.AUTO_SAVE_RESULTS;
    }
    if (typeof envVars.ARCHIVE_ENABLED === 'string' && envVars.ARCHIVE_ENABLED.trim().length > 0) {
      config.ARCHIVE_ENABLED = envVars.ARCHIVE_ENABLED;
    }
    if (typeof envVars.ARCHIVE_COLLECTION === 'string' && envVars.ARCHIVE_COLLECTION.trim().length > 0) {
      config.ARCHIVE_COLLECTION = envVars.ARCHIVE_COLLECTION;
    }
    if (typeof envVars.DISPATCH_TARGET_REPO === 'string' && envVars.DISPATCH_TARGET_REPO.trim().length > 0) {
      config.DISPATCH_TARGET_REPO = envVars.DISPATCH_TARGET_REPO;
    }
  }
  console.log('Consolidated config:', config);
  return config;
}

;(window as any).ConfigLoader = { loadConfig };
export {};
