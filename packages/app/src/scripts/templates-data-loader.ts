// Migrated template data loader (from legacy js/templates-data-loader.js)
// Responsibilities:
//  - Wait for GitHubAuth to be ready
//  - If authenticated, load results/index-data.js (populates window.templatesData)
//  - On load success/failure OR unauthenticated, ensure window.templatesData is an array
//  - Dispatch a single 'template-data-loaded' CustomEvent (idempotent)
//  - React to auth-state-changed events (load lazily after user logs in)
//  - Provide a small diagnostic API on window.TemplateDataLoader for debugging/tests

// Rely on existing global.d.ts declarations for GitHubAuthLike and the template-list's ScannedTemplateEntry.
// We only augment with TemplateDataLoader; avoid redeclaring types to prevent conflicts.
declare global {
  interface Window {
    TemplateDataLoader?: {
      loadIfNeeded: () => void;
      forceReload: () => void;
      isLoaded: () => boolean;
      _state: () => { attempted: boolean; loaded: boolean; authenticatedAtLoad: boolean };
    };
  }
}

interface LoaderState {
  attempted: boolean; // attempted to fetch index-data.js at least once
  loaded: boolean; // window.templatesData array established (even if empty)
  authenticatedAtLoad: boolean; // whether user was authed during initial attempt
  loadingScriptTag?: HTMLScriptElement | null;
  dispatched: boolean; // whether template-data-loaded event was dispatched
}

const state: LoaderState = {
  attempted: false,
  loaded: false,
  authenticatedAtLoad: false,
  dispatched: false,
};

let authPollAttempts = 0;
const MAX_AUTH_POLL = 50; // ~5s at 100ms intervals (matches legacy semantics)

function log(...args: any[]) {
  // Use a namespaced debug line for easier filtering
  console.debug('[TemplateDataLoader]', ...args);
}

function dispatchOnce() {
  if (state.dispatched) return;
  state.dispatched = true;
  try {
    document.dispatchEvent(new CustomEvent('template-data-loaded'));
  } catch (e) {
    console.warn('[TemplateDataLoader] Failed to dispatch template-data-loaded event', e);
  }
}

function ensureArray() {
  if (!Array.isArray(window.templatesData)) {
    window.templatesData = [];
  }
  state.loaded = true;
}

function handleLoadSuccess() {
  log('index-data.js loaded');
  if (!Array.isArray(window.templatesData)) {
    log('window.templatesData missing or not an array after script load; initializing to []');
  }
  ensureArray();
  dispatchOnce();
}

function handleLoadError(err?: any) {
  log('Failed to load index-data.js (non-fatal)', err?.message || err);
  ensureArray();
  dispatchOnce();
}

function injectScript() {
  if (state.attempted) {
    log('injectScript called but already attempted; skipping');
    // Still ensure event is dispatched if prior attempt left window.templatesData unset
    if (!state.dispatched) dispatchOnce();
    return;
  }
  state.attempted = true;
  state.authenticatedAtLoad = !!(window.GitHubAuth && window.GitHubAuth.isAuthenticated?.());
  if (!state.authenticatedAtLoad) {
    log('Not authenticated at load attempt; setting empty templatesData');
    ensureArray();
    dispatchOnce();
    return;
  }
  try {
    const script = document.createElement('script');
    script.src = 'results/index-data.js';
    script.async = true;
    script.onload = () => handleLoadSuccess();
    script.onerror = (e) => handleLoadError(e);
    state.loadingScriptTag = script;
    document.head.appendChild(script);
    log('Injected script tag for results/index-data.js');
  } catch (e) {
    handleLoadError(e);
  }
}

function loadIfNeeded() {
  if (state.loaded || state.attempted) return;
  injectScript();
}

function forceReload() {
  // Reset state and try again (used only for diagnostics / tests)
  if (state.loadingScriptTag && state.loadingScriptTag.parentNode) {
    state.loadingScriptTag.parentNode.removeChild(state.loadingScriptTag);
  }
  state.attempted = false;
  state.loaded = false;
  state.authenticatedAtLoad = false;
  state.loadingScriptTag = null;
  state.dispatched = false;
  injectScript();
}

function pollForAuthAndLoad() {
  if (window.GitHubAuth && window.GitHubAuth.isAuthenticated) {
    if (window.GitHubAuth.isAuthenticated()) {
      log('Auth ready & authenticated; proceeding to load results');
      injectScript();
      return;
    } else {
      log('Auth ready but user not authenticated yet; setting empty list & dispatching');
      ensureArray();
      dispatchOnce();
      return;
    }
  }
  authPollAttempts++;
  if (authPollAttempts >= MAX_AUTH_POLL) {
    log('Auth object not detected after polling; proceeding with empty data');
    ensureArray();
    dispatchOnce();
    return;
  }
  setTimeout(pollForAuthAndLoad, 100);
}

// Listen for auth-state-changed to lazy-load data after login if we had not loaded yet
document.addEventListener('auth-state-changed', (e: any) => {
  try {
    const authenticated = !!e?.detail?.authenticated;
    log('auth-state-changed event received', authenticated);
    if (authenticated && !state.loaded) {
      // Retry loading if we previously short-circuited (not attempted or had empty array due to unauth)
      if (!state.attempted || (state.attempted && !state.authenticatedAtLoad)) {
        injectScript();
      }
    } else if (!authenticated && !state.loaded) {
      ensureArray();
      dispatchOnce();
    }
  } catch (err) {
    log('Error handling auth-state-changed', err);
  }
});

// Expose diagnostic API
window.TemplateDataLoader = {
  loadIfNeeded,
  forceReload,
  isLoaded: () => state.loaded,
  _state: () => ({
    attempted: state.attempted,
    loaded: state.loaded,
    authenticatedAtLoad: state.authenticatedAtLoad,
  }),
};

// Kick off polling once DOM is interactive (legacy script executed immediately; we replicate near-start timing)
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  queueMicrotask(pollForAuthAndLoad);
} else {
  document.addEventListener('DOMContentLoaded', () => pollForAuthAndLoad());
}

export {}; // module scope sentinel
