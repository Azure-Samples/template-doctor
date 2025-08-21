// Lightweight runtime config loader for Template Doctor
// Looks for a config.json alongside index.html and exposes window.TemplateDoctorConfig
// Shape example: { "apiBase": "https://your-functions.azurewebsites.net" }

(function () {
  const DEFAULTS = {
    // Keep a working default for now; override via config.json in production
    apiBase: 'https://template-doctor-standalone-nv.azurewebsites.net',
  };

  // Initialize with defaults so consumers have something synchronously
  window.TemplateDoctorConfig = Object.assign({}, DEFAULTS);

  // Try to fetch config.json to override defaults at runtime
  try {
    fetch('config.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (cfg && typeof cfg === 'object') {
          window.TemplateDoctorConfig = Object.assign({}, DEFAULTS, cfg);
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
