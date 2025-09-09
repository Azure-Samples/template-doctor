// @ts-nocheck
// Migrated from js/config-loader.js (behavior preserved)

async function loadEnvironmentVariables() {
  try {
    const isLocalhost = window.location.hostname === 'localhost';
    // Detect if the caller explicitly requested a Functions port (query param or global var).
    // We keep a separate flag so the mere DEFAULT value (7071) does not bias ordering when running
    // inside the unified container (e.g., :4000) where we should try same-origin first.
    let localPort: any = 7071;
    let explicitFuncPort = false;
    if ((window as any).LOCAL_FUNCTIONS_PORT) {
      localPort = (window as any).LOCAL_FUNCTIONS_PORT;
      explicitFuncPort = true;
    } else if (typeof (window as any).TemplateDoctorConfig?.LOCAL_FUNCTIONS_PORT === 'number') {
      localPort = (window as any).TemplateDoctorConfig.LOCAL_FUNCTIONS_PORT;
      explicitFuncPort = true;
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('funcPort')) {
        localPort = urlParams.get('funcPort');
        explicitFuncPort = true;
      }
    }
    // Paths
    const devPath = '/api/v4/client-settings'; // Functions or dev proxy
    const containerPath = '/v4/client-settings'; // Unified container mount
    let tried: string[] = [];
    let response: Response | null = null;
    // Strategy:
    // 1. If localhost & current port looks like Functions (7071) OR explicit funcPort provided -> try devPath absolute.
    // 2. Otherwise (likely unified container via localhost:4000) first try containerPath relative.
    // 3. Fallback attempts: the other style, then plain relative devPath.
    const currentPort = window.location.port;
    const candidates: string[] = [];
    if (isLocalhost) {
      if (currentPort === '7071') {
        // Classic split dev scenario: frontend (maybe vite) + functions host; prioritize functions host.
        candidates.push(`http://localhost:${localPort}${devPath}`);
        candidates.push(containerPath);
        candidates.push(devPath);
      } else {
        // Unified container or alternate local port (e.g., 4000, 5173, 8080). Prefer same-origin first.
        candidates.push(containerPath);
        candidates.push(devPath);
        // Only probe the functions host explicitly if the user provided an override.
        if (explicitFuncPort) {
          candidates.push(`http://localhost:${localPort}${devPath}`);
        }
      }
    } else {
      // Deployed / remote: container style first, then legacy path.
      candidates.push(containerPath, devPath);
    }
    // If SERVE_FRONTEND flag present globally, prioritize containerPath first
    try {
      if ((window as any).TemplateDoctorConfig?.SERVE_FRONTEND || (window as any).SERVE_FRONTEND) {
        candidates.unshift(containerPath);
      }
    } catch {}
    let data: any = {};
    for (const url of candidates) {
      if (tried.includes(url)) continue;
      tried.push(url);
      try {
        console.log('[config-loader] attempting client-settings fetch:', url);
        response = await fetch(url, { cache: 'no-store' });
        if (response.ok) {
          data = await response.json();
          console.log('[config-loader] loaded client-settings from', url, 'keys:', Object.keys(data));
          break;
        } else {
          console.warn('[config-loader] non-OK response', response.status, 'for', url);
        }
      } catch (e) {
        console.warn('[config-loader] fetch error for', url, e);
      }
    }
    if (!response || !response.ok) {
      console.error('[config-loader] failed all client-settings attempts', { tried });
      throw new Error('Failed to load client settings from v4 API');
    }
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
