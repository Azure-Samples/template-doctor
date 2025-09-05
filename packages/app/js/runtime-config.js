// Lightweight runtime config loader for Template Doctor
// Looks for a config.json alongside index.html and exposes window.TemplateDoctorConfig
// Shape example: { "apiBase": "https://your-functions.azurewebsites.net" }

(function () {
  const DEFAULTS = {
    // Keep a working default for now; override via config.json in production
    // Prefer same-origin by default; override via config.json in production
    apiBase: `${window.location.origin}`,
    // Enforce versioned API calls (migration to /api/v4/*)
    apiVersion: 'v4',
    defaultRuleSet: 'dod',
    requireAuthForResults: true,
    autoSaveResults: false,
    archiveEnabled: false,
    archiveCollection: 'aigallery',
    // Optional: explicit workflow host repo to dispatch to (owner/repo)
    dispatchTargetRepo: '',
  };

  // Initialize with defaults so consumers have something synchronously
  window.TemplateDoctorConfig = Object.assign({}, DEFAULTS);
  window.TemplateDoctorRuntime = { lastMode: 'unknown', fallbackUsed: false };

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
        if (config.DISPATCH_TARGET_REPO) {
          mapped.dispatchTargetRepo = config.DISPATCH_TARGET_REPO;
        }
        // Map frontend overrides
        if (config.DEFAULT_RULE_SET) {
          mapped.defaultRuleSet = String(config.DEFAULT_RULE_SET).toLowerCase();
        }
        if (
          typeof config.REQUIRE_AUTH_FOR_RESULTS !== 'undefined' &&
          config.REQUIRE_AUTH_FOR_RESULTS !== null
        ) {
          const v = String(config.REQUIRE_AUTH_FOR_RESULTS).trim().toLowerCase();
          mapped.requireAuthForResults = /^(1|true|yes|on)$/i.test(v);
        }
        if (typeof config.AUTO_SAVE_RESULTS !== 'undefined' && config.AUTO_SAVE_RESULTS !== null) {
          const v2 = String(config.AUTO_SAVE_RESULTS).trim().toLowerCase();
          mapped.autoSaveResults = /^(1|true|yes|on)$/i.test(v2);
        }

        // Map apiVersion if nested under backend
        if (!mapped.apiVersion && mapped.backend && mapped.backend.apiVersion) {
          mapped.apiVersion = mapped.backend.apiVersion;
        }
        window.TemplateDoctorConfig = Object.assign({}, DEFAULTS, mapped);
        document.dispatchEvent(new CustomEvent('template-config-loaded'));
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
          if (cfg.defaultRuleSet) {
            mapped.defaultRuleSet = String(cfg.defaultRuleSet).toLowerCase();
          }
          if (typeof cfg.requireAuthForResults === 'boolean') {
            mapped.requireAuthForResults = cfg.requireAuthForResults;
          }
          if (typeof cfg.autoSaveResults === 'boolean') {
            mapped.autoSaveResults = cfg.autoSaveResults;
          }
          if (typeof cfg.archiveEnabled === 'boolean') {
            mapped.archiveEnabled = cfg.archiveEnabled;
          }
          if (typeof cfg.archiveCollection === 'string') {
            mapped.archiveCollection = cfg.archiveCollection;
          }
          if (typeof cfg.dispatchTargetRepo === 'string') {
            mapped.dispatchTargetRepo = cfg.dispatchTargetRepo;
          }
          if (!mapped.apiVersion && mapped.backend && mapped.backend.apiVersion) {
            mapped.apiVersion = mapped.backend.apiVersion;
          }
            window.TemplateDoctorConfig = Object.assign({}, DEFAULTS, mapped);
            document.dispatchEvent(new CustomEvent('template-config-loaded'));
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
