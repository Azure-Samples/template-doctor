// Centralized API route builder with version support.
// Usage: ApiRoutes.build('analyze-template') -> /api/analyze-template or /api/v4/analyze-template when apiVersion='v4'.
// options: { versionOverride?: string, query?: Record<string,string|number|boolean|null|undefined> }
(function() {
  function normalizeBase(rawBase) {
    if (!rawBase) return '';
    return String(rawBase).replace(/\/$/, '');
  }

  function getApiBase() {
    const cfg = window.TemplateDoctorConfig || {};
    if (cfg.apiBase) return normalizeBase(cfg.apiBase);
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (isLocal) return 'http://localhost:7071';
    return normalizeBase(window.location.origin);
  }

  function getVersionPrefix(path, version) {
    if (!version) return '/api';
    // Avoid double versioning (e.g., user passes already versioned path)
    const trimmed = path.replace(/^\//, '');
    if (trimmed.startsWith(`api/${version}/`) || trimmed === `api/${version}`) {
      return '/api';
    }
    return `/api/${version}`;
  }

  function build(path, options) {
    const cfg = window.TemplateDoctorConfig || {};
    // Support both legacy top-level apiVersion and new backend.apiVersion placement.
    const version =
      (options && options.versionOverride) ||
      cfg.apiVersion ||
      (cfg.backend && cfg.backend.apiVersion) ||
      '';
    const trimmed = String(path || '').replace(/^\//, '');
    const prefix = getVersionPrefix(trimmed, version);
    const base = getApiBase();
    let url = `${base}${prefix}/${trimmed}`.replace(/([^:])\/+/g, '$1/');
    const query = options && options.query;
    if (query && typeof query === 'object') {
      const qp = Object.entries(query)
        .filter(([_, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
      if (qp) url += (url.includes('?') ? '&' : '?') + qp;
    }
    return url;
  }

  function currentVersion() {
    if (!window.TemplateDoctorConfig) return null;
    return (
      window.TemplateDoctorConfig.apiVersion ||
      (window.TemplateDoctorConfig.backend && window.TemplateDoctorConfig.backend.apiVersion) ||
      null
    );
  }

  window.ApiRoutes = { build, currentVersion };
})();
