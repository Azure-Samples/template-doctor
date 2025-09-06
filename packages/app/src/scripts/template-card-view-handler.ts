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
    // Insert before footer if possible, else append to body
    const footer = document.querySelector('footer, .site-footer');
    if (footer?.parentNode) footer.parentNode.insertBefore(analysisSection, footer);
    else document.body.appendChild(analysisSection);
    console.debug('[template-card-view-handler] Created missing #analysis-section');
  }

  let resultsContainer = document.getElementById('results-container');
  if (!resultsContainer) {
    resultsContainer = document.createElement('div');
    resultsContainer.id = 'results-container';
    resultsContainer.className = 'results-container';
    analysisSection.appendChild(resultsContainer);
    console.debug('[template-card-view-handler] Created missing #results-container');
  }

  let reportDiv = document.getElementById('report');
  if (!reportDiv) {
    reportDiv = document.createElement('div');
    reportDiv.id = 'report';
    resultsContainer.appendChild(reportDiv);
    console.debug('[template-card-view-handler] Created missing #report');
  }

  // Force visibility overrides (legacy inline styles may hide these)
  (analysisSection as HTMLElement).style.display = 'block';
  (resultsContainer as HTMLElement).style.display = 'block';
  (reportDiv as HTMLElement).style.display = 'block';
  (analysisSection as HTMLElement).removeAttribute('aria-hidden');
  (resultsContainer as HTMLElement).removeAttribute('aria-hidden');
}

function handleTemplateCardView(e: Event) {
  const detail: any = (e as CustomEvent).detail;
  if (!detail || !detail.template) return;
  const tmpl = detail.template;
  const repoUrl = tmpl.repoUrl;
  if (!repoUrl) return;

  console.debug('[template-card-view-handler] Received event for repo', repoUrl);

  ensureAnalysisContainers();

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
