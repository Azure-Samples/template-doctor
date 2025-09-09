// Callback page entrypoint migrated from legacy inline script + runtime-config.js + config-loader.js
import './scripts/runtime-config';
// (placeholder) import './js-shims'; // for future polyfills if needed

// We rely on the legacy ConfigLoader for now (migrated version could be added later).
// Because runtime-config awaits ConfigLoader if present, we load config loader dynamically first.

async function ensureConfigLoader() {
  if ((window as any).ConfigLoader?.loadConfig) return;
  // Load the legacy config-loader.js by injecting a script tag (kept during migration window).
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'js/config-loader.js';
    s.onload = () => resolve();
    s.onerror = (e) => reject(new Error('Failed to load legacy config-loader.js'));
    document.head.appendChild(s);
  });
}

function getBasePath(): string {
  const pathname = window.location.pathname || '/';
  const withoutFile = /\.[a-zA-Z0-9]+$/.test(pathname)
    ? pathname.substring(0, pathname.lastIndexOf('/'))
    : pathname;
  if (withoutFile === '/') return '';
  return withoutFile.endsWith('/') ? withoutFile.slice(0, -1) : withoutFile;
}

async function loadConfig(): Promise<any> {
  try {
    await ensureConfigLoader();
    if ((window as any).ConfigLoader?.loadConfig) {
      const cfg = await (window as any).ConfigLoader.loadConfig();
      return cfg;
    }
  } catch (err) {
    console.warn('[callback] config load failed, continuing with defaults', err);
  }
  return {};
}

async function processCallback() {
  const loadingInfo = document.getElementById('process-info');
  if (loadingInfo) loadingInfo.textContent = 'Loading configuration...';
  const config = await loadConfig();
  if (loadingInfo) loadingInfo.textContent = 'Configuration loaded, processing...';

  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  const error = urlParams.get('error');
  const errorDescription = urlParams.get('error_description');

  function redirect(delayMs: number) {
    setTimeout(() => {
      const basePath = getBasePath();
      window.location.href = window.location.origin + basePath + '/index.html';
    }, delayMs);
  }

  if (error) {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';
    const errEl = document.getElementById('error-message');
    if (errEl) {
      errEl.textContent = `Error: ${error}${errorDescription ? ' - ' + errorDescription : ''}`;
      errEl.style.display = 'block';
    }
    sessionStorage.setItem('auth_error', errorDescription || error);
    redirect(3000);
    return;
  }

  if (code && state) {
    if (loadingInfo) loadingInfo.textContent = 'Authorization code received, redirecting...';
    sessionStorage.setItem('gh_auth_code', code);
    sessionStorage.setItem('gh_auth_state', state);
    redirect(0);
    return;
  }

  // Lenient mode: proceed even if state is missing but code is present (some users reported callback with only ?code=...)
  if (code && !state) {
    console.warn('[callback] Authorization code received WITHOUT state parameter. Proceeding leniently.');
    sessionStorage.setItem('gh_auth_code', code);
    sessionStorage.setItem('gh_auth_state', 'missing');
    sessionStorage.setItem('auth_warning', 'OAuth state parameter missing in callback');
    if (loadingInfo) loadingInfo.textContent = 'Authorization code received (no state), redirecting...';
    redirect(0);
    return;
  }

  // No code or explicit error => treat as error condition
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';
  const errEl = document.getElementById('error-message');
  if (errEl) {
    errEl.textContent = 'Error: No authorization code received from GitHub.';
    errEl.style.display = 'block';
  }
  sessionStorage.setItem('auth_error', 'No authorization code received from GitHub.');
  redirect(3000);
}

window.addEventListener('load', () => {
  processCallback().catch((err) => {
    console.error('[callback] unexpected error', err);
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';
    const errEl = document.getElementById('error-message');
    if (errEl) {
      errEl.textContent = `Error during authentication: ${err instanceof Error ? err.message : String(err)}`;
      errEl.style.display = 'block';
    }
    sessionStorage.setItem('auth_error', `Error during callback processing: ${err instanceof Error ? err.message : String(err)}`);
    const basePath = getBasePath();
    setTimeout(() => {
      window.location.href = window.location.origin + basePath + '/index.html';
    }, 5000);
  });
});
