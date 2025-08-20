// Global AppConfig loader
// Loads packages/app/config.json and exposes a normalized window.AppConfig early for other modules.

(function () {
  function getBasePath() {
    const pathname = window.location.pathname || '/';
    const withoutFile = pathname.match(/\.[a-zA-Z0-9]+$/)
      ? pathname.substring(0, pathname.lastIndexOf('/'))
      : pathname;
    if (withoutFile === '/') return '';
    return withoutFile.endsWith('/') ? withoutFile.slice(0, -1) : withoutFile;
  }

  async function loadAppConfig() {
    const basePath = getBasePath();
    try {
      const res = await fetch(`${basePath}/config.json`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const cfg = await res.json();

      const normalized = {
        title: cfg?.app?.title || 'Template Doctor',
        ownerOrg: cfg?.app?.ownerOrg || 'DevDiv Microsoft',
        deploymentTool: cfg?.app?.deploymentTool || 'none', // 'azd' | 'none'
        customComplianceEnabled: !!cfg?.app?.customComplianceEnabled,
        customComplianceGistUrl: cfg?.app?.customComplianceGistUrl || '',
        backend: cfg?.backend || {},
      };

      window.AppConfig = normalized;

      // Apply branding immediately if DOM is ready enough
      try {
        if (normalized.title) {
          document.title = `${normalized.title} - GitHub Pages`;
          const h1 = document.querySelector('header .logo h1');
          if (h1) h1.textContent = normalized.title;
        }
        if (normalized.ownerOrg) {
          const copyright = document.querySelector('footer .copyright');
          if (copyright) {
            const year = new Date().getFullYear();
            copyright.textContent = `©${year} - ${normalized.ownerOrg}`;
          }
        }
      } catch (_) {}

      return normalized;
    } catch (e) {
      // Minimal defaults if config.json is missing
      window.AppConfig = {
        title: 'Template Doctor',
        ownerOrg: 'DevDiv Microsoft',
        deploymentTool: 'none',
        customComplianceEnabled: false,
        customComplianceGistUrl: '',
      };
      return window.AppConfig;
    }
  }

  // kick off load immediately
  loadAppConfig();
})();
