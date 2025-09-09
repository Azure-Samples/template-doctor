// Listens for `template-card-view` events (dispatched by template-list.ts) and loads the report
// using the existing ReportLoader + DashboardRenderer pipeline.

declare global {
  interface Window {
    ReportLoader?: { loadReport: (repoUrl: string, options?: any) => Promise<any> };
    TemplateCardViewHandlerReady?: boolean;
    __debugTriggerTemplateCardView?: (repoUrl: string) => void;
  }
}

function ensureAnalysisContainers() {
  // Robust creation of required DOM nodes for report loading even if legacy markup not yet present.
  let analysisSection = document.getElementById('analysis-section');
  if (!analysisSection) {
    analysisSection = document.createElement('section');
    analysisSection.id = 'analysis-section';
    analysisSection.className = 'analysis-section';
    analysisSection.innerHTML = `
      <div class="analysis-header">
        <button id="back-button" class="back-button"><i class="fas fa-arrow-left"></i> Back to Search</button>
        <div class="repo-info">
          <h3 id="repo-name">Repository Name</h3>
          <span id="repo-url">Repository URL</span>
        </div>
      </div>
      <div class="loading-container" id="loading-container" style="display:none">
        <div class="loading-spinner"></div>
        <p>Analyzing repository... This may take a moment.</p>
      </div>
      <div id="results-container" class="results-container" style="display:none"></div>
      <div class="error-container" id="analysis-error" style="display:none"><p class="error-text"></p></div>
    `;
    const footer = document.querySelector('footer, .site-footer');
    if (footer?.parentNode) footer.parentNode.insertBefore(analysisSection, footer);
    else document.body.appendChild(analysisSection);
    console.debug('[template-card-view-handler] Created full #analysis-section structure');
  }

  let resultsContainer = document.getElementById('results-container');
  if (!resultsContainer) {
    resultsContainer = document.createElement('div');
    resultsContainer.id = 'results-container';
    resultsContainer.className = 'results-container';
    analysisSection.appendChild(resultsContainer);
  }

  let reportDiv = document.getElementById('report');
  if (!reportDiv) {
    reportDiv = document.createElement('div');
    reportDiv.id = 'report';
    resultsContainer.appendChild(reportDiv);
  }

  // Only reveal if authenticated; otherwise keep hidden until login.
  const auth: any = (window as any).GitHubAuth;
  const authed = auth && typeof auth.isAuthenticated === 'function' && auth.isAuthenticated();
  if (authed) {
    (analysisSection as HTMLElement).style.display = 'block';
    (resultsContainer as HTMLElement).style.display = 'block';
    (reportDiv as HTMLElement).style.display = 'block';
    (analysisSection as HTMLElement).removeAttribute('aria-hidden');
    (resultsContainer as HTMLElement).removeAttribute('aria-hidden');
    try { analysisSection.setAttribute('data-auth-ready','true'); } catch {}
  } else {
    (analysisSection as HTMLElement).style.display = 'none';
    (resultsContainer as HTMLElement).style.display = 'none';
  }
}

function handleTemplateCardView(e: Event) {
  const detail: any = (e as CustomEvent).detail;
  if (!detail || !detail.template) return;
  const tmpl = detail.template;
  const repoUrl = tmpl.repoUrl;
  if (!repoUrl) return;

  console.debug('[template-card-view-handler] Received event for repo', repoUrl);

  ensureAnalysisContainers();
  // Abort if not authenticated
  const auth: any = (window as any).GitHubAuth;
  if (auth && typeof auth.isAuthenticated === 'function' && !auth.isAuthenticated()) {
    console.debug('[template-card-view-handler] Ignoring view request while unauthenticated');
    return;
  }

  // After ensuring, safely reference nodes
  const analysisSection = document.getElementById('analysis-section');
  const resultsContainer = document.getElementById('results-container');
  const reportDiv = document.getElementById('report');
  if (analysisSection) analysisSection.style.display = 'block';
  if (resultsContainer) resultsContainer.style.display = 'block';
  if (reportDiv) {
    reportDiv.innerHTML = '<div class="loading-message">Loading report...</div>';
  } else {
    console.warn('[template-card-view-handler] Failed to create/find #report after ensureAnalysisContainers');
  }
  if (!window.ReportLoader) {
    console.warn('[template-card-view-handler] ReportLoader not available');
    return;
  }
  window.ReportLoader.loadReport(repoUrl).catch((err) => {
    if (reportDiv) reportDiv.innerHTML = `<div class="error-message">Failed to load report: ${err.message || err}</div>`;
  });
}

document.addEventListener('template-card-view', handleTemplateCardView);

// Proactively ensure base containers once DOM is interactive; avoids race where event is dispatched
// before handler created #report (especially in tests that click immediately).
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  queueMicrotask(() => { try { ensureAnalysisContainers(); } catch(_){} });
} else {
  document.addEventListener('DOMContentLoaded', () => { try { ensureAnalysisContainers(); } catch(_){} });
}

// Expose a manual trigger helper for tests / debugging.
try {
  (window as any).__debugTriggerTemplateCardView = (repoUrl: string) => {
    const t = { repoUrl };
    document.dispatchEvent(new CustomEvent('template-card-view', { detail: { template: t } }));
  };
} catch(_) {}

// Delegated click listener to avoid race where cards are rendered before per-card listeners attached
// or where tests click before handler readiness is confirmed.
document.addEventListener('click', (ev) => {
  const target = ev.target as HTMLElement | null;
  if (!target) return;
  const btn = target.closest('.view-report-btn');
  if (!btn) return;
  const card = btn.closest('.template-card') as HTMLElement | null;
  if (!card) return;
  const repoUrl = card.dataset.repoUrl;
  if (!repoUrl) return;
  console.debug('[template-card-view-handler] Delegated click for repo', repoUrl);
  // Build a synthetic template object from existing global data if possible
  let template: any = { repoUrl };
  try {
    if (Array.isArray((window as any).templatesData)) {
      const match = (window as any).templatesData.find((t: any) => (t.repoUrl || '').toLowerCase() === repoUrl.toLowerCase());
      if (match) template = match;
    }
  } catch(_) {}
  handleTemplateCardView(new CustomEvent('template-card-view', { detail: { template } }) as any);
});

// Mark readiness for tests / other scripts to await
try {
  (window as any).TemplateCardViewHandlerReady = true;
  document.dispatchEvent(new CustomEvent('template-card-view-handler-ready'));
} catch (_) {}

console.debug('[TemplateDoctor] template-card-view-handler initialized');

export {};
