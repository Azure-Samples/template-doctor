// Lightweight runtime config loader for Template Doctor
// Looks for a config.json alongside index.html and exposes window.TemplateDoctorConfig
// Shape example: { "apiBase": "https://your-functions.azurewebsites.net" }

(function () {
  const DEFAULTS = {
    // Keep a working default for now; override via config.json in production
    // Prefer same-origin by default; override via config.json in production
    apiBase: `${window.location.origin}`,
  };

  // Initialize with defaults so consumers have something synchronously
  window.TemplateDoctorConfig = Object.assign({}, DEFAULTS);

  // Use the ConfigLoader if available, otherwise fallback to direct fetch
  const loadConfig = async () => {
    try {
      if (window.ConfigLoader && window.ConfigLoader.loadConfig) {
        // Use our new unified ConfigLoader
        const config = await window.ConfigLoader.loadConfig();
        console.log('[runtime-config] loaded config via ConfigLoader');
        
        // Back-compat mapping: support both top-level { apiBase } and nested { backend: { baseUrl, functionKey } }
        const mapped = { ...config };
        if (!mapped.apiBase && config.backend && typeof config.backend.baseUrl === 'string') {
          mapped.apiBase = config.backend.baseUrl;
        }
        if (config.backend && typeof config.backend.functionKey === 'string') {
          mapped.functionKey = config.backend.functionKey;
        }
        
        // Also check for direct environment variables
        if (config.API_BASE_URL) {
          mapped.apiBase = config.API_BASE_URL;
        }
        if (config.FUNCTION_KEY) {
          mapped.functionKey = config.FUNCTION_KEY;
        }
        
        window.TemplateDoctorConfig = Object.assign({}, DEFAULTS, mapped);
        return;
      }
      
      // Fallback to direct fetch
      const response = await fetch('config.json', { cache: 'no-store' });
      if (response.ok) {
        const cfg = await response.json();
        if (cfg && typeof cfg === 'object') {
          // Back-compat mapping: support both top-level { apiBase } and nested { backend: { baseUrl, functionKey } }
          const mapped = { ...cfg };
          if (!mapped.apiBase && cfg.backend && typeof cfg.backend.baseUrl === 'string') {
            mapped.apiBase = cfg.backend.baseUrl;
          }
          if (cfg.backend && typeof cfg.backend.functionKey === 'string') {
            mapped.functionKey = cfg.backend.functionKey;
          }
          window.TemplateDoctorConfig = Object.assign({}, DEFAULTS, mapped);
          console.log('[runtime-config] loaded config.json');
        } else {
          console.log('[runtime-config] no config.json found, using defaults');
        }
      }
    } catch (error) {
      console.error('[runtime-config] error loading config:', error);
      console.log('[runtime-config] using default configuration');
    }
  };

  // Execute the config loading
  loadConfig().catch(() => {
    console.log('[runtime-config] failed to load config, using defaults');
  });
})();