// @ts-nocheck
// Migrated from js/api-routes.js (behavior preserved)
(function(){
  function normalizeBase(rawBase){
    if(!rawBase) return '';
    return String(rawBase).replace(/\/$/,'');
  }
  function getApiBase(){
    const cfg = (window as any).TemplateDoctorConfig || {};
    if (cfg.apiBase) return normalizeBase(cfg.apiBase);
    const isLocal = ['localhost','127.0.0.1'].includes(window.location.hostname);
    if (isLocal) {
      if (window.location.port === '7071') return 'http://localhost:7071';
      return normalizeBase(window.location.origin);
    }
    return normalizeBase(window.location.origin);
  }
  function getVersionPrefix(path, version){
    if(!version) return '/api';
    const trimmed = path.replace(/^\//,'');
    if (trimmed.startsWith(`api/${version}/`) || trimmed === `api/${version}`) {
      return '/api';
    }
    return `/api/${version}`;
  }
  function build(path, options){
    const cfg = (window as any).TemplateDoctorConfig || {};
    const version = (options && options.versionOverride) || cfg.apiVersion || (cfg.backend && cfg.backend.apiVersion) || '';
    const trimmed = String(path||'').replace(/^\//,'');
    const prefix = getVersionPrefix(trimmed, version);
    const base = getApiBase();
    let url = `${base}${prefix}/${trimmed}`.replace(/([^:])\/+/, '$1/');
    // If same-origin unified container and versioned API (v4), prefer /v4 instead of /api/v4 duplication
    if (base === normalizeBase(window.location.origin) && version && /^v\d+/.test(version)) {
      // Replace /api(/vN)? with /vN if not already containing /vN/
      if (!/\/v\d+\//.test(url)) {
        url = url.replace(/\/api(?:\/v\d+)?\//, `/${version}/`);
      }
    }
    const query = options && options.query;
    if (query && typeof query === 'object') {
      const qp = Object.entries(query)
        .filter(([,v]) => v !== undefined && v !== null && v !== '')
        .map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
      if (qp) url += (url.includes('?') ? '&' : '?') + qp;
    }
    return url;
  }
  function currentVersion(){
    if(!(window as any).TemplateDoctorConfig) return null;
    const cfg = (window as any).TemplateDoctorConfig;
    return cfg.apiVersion || (cfg.backend && cfg.backend.apiVersion) || null;
  }
  (window as any).ApiRoutes = { build, currentVersion };
})();
export {};
