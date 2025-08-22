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

  // Try to fetch config.json to override defaults at runtime
  try {
    fetch('config.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
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
      })
      .catch(() => {
        console.log('[runtime-config] failed to load config.json, using defaults');
      });
  } catch {}
})();