// Minimal Template List Renderer (transitional)
// Extracted subset of legacy app.js logic to satisfy tests expecting .template-card elements.
// Focus: render scanned templates from window.templatesData when available & authenticated.

interface ScannedTemplateEntry {
  repoUrl: string;
  relativePath: string;
  compliance: { percentage: number; issues: number; passed: number };
  timestamp: string;
  scannedBy?: string[];
  ruleSet?: string; // optional for future parity
  customConfig?: { gistUrl?: string };
}

// Uses the shared GitHubAuthLike from global.d.ts

declare global {
  interface Window {
    templatesData?: ScannedTemplateEntry[];
    TemplateList?: TemplateListAPI;
  }
}

interface TemplateListAPI {
  init: () => void;
  render: () => void;
  isRendered: () => boolean;
  refresh: () => void; // re-render (used if templatesData changes dynamically)
  getCount: () => number;
}

const SECTION_ID = 'scanned-templates-section';
const GRID_ID = 'template-grid';
const PAGINATION_CLASS = 'pagination';
const PAGE_SIZE = 6; // mimic legacy pagination sizing

let rendered = false;
let currentPage = 1;

function ensureSection(): HTMLElement | null {
  let section = document.getElementById(SECTION_ID);
  if (!section) {
    // Create a minimal section (reduced markup compared to legacy for now).
    section = document.createElement('section');
    section.id = SECTION_ID;
    section.className = 'scanned-templates-section';
    section.innerHTML = `
      <div class="section-header">
        <h2>Previously Scanned Templates</h2>
      </div>
      <div class="section-content">
        <div id="${GRID_ID}" class="template-grid"></div>
      </div>`;
    const searchSection = document.getElementById('search-section');
    if (searchSection?.parentNode) {
      searchSection.parentNode.insertBefore(section, searchSection.nextSibling);
    } else {
      document.body.appendChild(section);
    }
  }
  return section;
}

function createCard(t: ScannedTemplateEntry): HTMLElement {
  const repoName = t.repoUrl.includes('github.com/') ? t.repoUrl.split('github.com/')[1] : t.repoUrl;
  const templateId = `template-${(t.relativePath || 'unknown').split('/')[0]}`.replace(/[^a-zA-Z0-9-]/g, '-');
  const lastScanner = t.scannedBy && t.scannedBy.length ? t.scannedBy[t.scannedBy.length - 1] : 'Unknown';
  const ruleSet = t.ruleSet || 'dod';
  const ruleSetDisplay = ruleSet === 'dod' ? 'DoD' : ruleSet === 'partner' ? 'Partner' : ruleSet === 'docs' ? 'Docs' : 'Custom';
  const gistUrl = ruleSet === 'custom' ? t.customConfig?.gistUrl : '';
  const card = document.createElement('div');
  card.className = 'template-card';
  card.id = templateId;
  card.dataset.repoUrl = t.repoUrl;
  card.dataset.dashboardPath = t.relativePath;
  card.dataset.ruleSet = ruleSet;
  card.innerHTML = `
    <div class="card-header">
      <h3 data-tooltip="${repoName}" class="has-permanent-tooltip">${repoName}</h3>
      <span class="scan-date">Last scanned by <strong>${lastScanner}</strong> on ${new Date(t.timestamp).toLocaleDateString()}</span>
    </div>
    <div class="card-body">
      ${gistUrl ? `<a href="${gistUrl}" target="_blank" class="ruleset-badge ${ruleSet}-badge">${ruleSetDisplay}</a>` : `<div class="ruleset-badge ${ruleSet}-badge">${ruleSetDisplay}</div>`}
      <div class="compliance-bar">
        <div class="compliance-fill" style="width: ${t.compliance.percentage}%"></div>
        <span class="compliance-value">${t.compliance.percentage}%</span>
      </div>
      <div class="stats">
        <div class="stat-item issues">${t.compliance.issues} issues</div>
        <div class="stat-item passed">${t.compliance.passed} passed</div>
      </div>
    </div>
    <div class="card-footer">
      <button class="view-report-btn" data-action="view">View Report</button>
      <button class="rescan-btn" data-action="rescan">Rescan</button>
      <button class="validate-btn" data-action="validate">Run Validation</button>
    </div>`;

  // For now only stub the view button needed by near-future tests.
  const footer = card.querySelector('.card-footer');
  footer?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target || target.tagName !== 'BUTTON') return;
    const action = target.getAttribute('data-action');
    if (action === 'view') {
      document.dispatchEvent(new CustomEvent('template-card-view', { detail: { template: t } }));
    } else if (action === 'rescan') {
      document.dispatchEvent(new CustomEvent('template-card-rescan', { detail: { template: t } }));
    } else if (action === 'validate') {
      document.dispatchEvent(new CustomEvent('template-card-validate', { detail: { template: t } }));
    }
  });
  return card;
}

function renderPage(page: number, data: ScannedTemplateEntry[], grid: Element) {
  grid.innerHTML = '';
  const start = (page - 1) * PAGE_SIZE;
  data.slice(start, start + PAGE_SIZE).forEach((entry) => grid.appendChild(createCard(entry)));
}

function renderPagination(total: number, section: HTMLElement) {
  let container = section.querySelector(`.${PAGINATION_CLASS}`) as HTMLElement | null;
  if (!container) {
    container = document.createElement('div');
    container.className = PAGINATION_CLASS;
    container.innerHTML = `
      <button class="prev-page" disabled>&laquo; Prev</button>
      <span class="page-info"></span>
      <button class="next-page" disabled>Next &raquo;</button>`;
    section.appendChild(container);
  }
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const prev = container.querySelector('.prev-page') as HTMLButtonElement;
  const next = container.querySelector('.next-page') as HTMLButtonElement;
  const info = container.querySelector('.page-info') as HTMLElement;
  info.textContent = `Page ${currentPage} of ${totalPages || 1}`;
  prev.disabled = currentPage <= 1;
  next.disabled = currentPage >= totalPages;
  prev.onclick = () => {
    if (currentPage > 1) {
      currentPage--;
      refresh();
    }
  };
  next.onclick = () => {
    if (currentPage < totalPages) {
      currentPage++;
      refresh();
    }
  };
  container.style.display = totalPages > 1 ? 'flex' : 'none';
}

function render() {
  if (!window.GitHubAuth || !window.GitHubAuth.isAuthenticated()) return;
  const data = window.templatesData;
  if (!Array.isArray(data) || data.length === 0) return;
  const section = ensureSection();
  const grid = section?.querySelector(`#${GRID_ID}`);
  if (!grid) return;
  renderPage(currentPage, data, grid);
  renderPagination(data.length, section as HTMLElement);
  if (!rendered) {
    rendered = true;
    document.dispatchEvent(
      new CustomEvent('template-cards-rendered', { detail: { count: data.length } }),
    );
  }
}

function refresh() {
  if (!rendered) return render();
  const section = document.getElementById(SECTION_ID);
  if (!section) return;
  const grid = section.querySelector(`#${GRID_ID}`);
  if (!grid) return;
  if (!Array.isArray(window.templatesData)) return;
  renderPage(currentPage, window.templatesData, grid);
  renderPagination(window.templatesData.length, section);
}

function tryRenderSoon() {
  // Attempt a few times in case auth/scripts arrive slightly later.
  let attempts = 0;
  const max = 10;
  const interval = setInterval(() => {
    attempts++;
    if (rendered) {
      clearInterval(interval);
      return;
    }
    try {
      render();
      if (rendered) clearInterval(interval);
    } catch (e) {
      // swallow transient errors
    }
    if (attempts >= max) clearInterval(interval);
  }, 300);
}

function init() {
  render();
  document.addEventListener('template-data-loaded', () => {
    if (!rendered) render();
    else refresh();
  });
  document.addEventListener('template-data-updated', () => {
    // external event to force refresh after data mutation
    refresh();
  });
  tryRenderSoon();
}

window.TemplateList = { init, render, isRendered: () => rendered, refresh, getCount: () => (Array.isArray(window.templatesData) ? window.templatesData.length : 0) };

// Auto-init after DOM is ready if loaded late in the document lifecycle
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  queueMicrotask(() => init());
} else {
  document.addEventListener('DOMContentLoaded', () => init());
}

export {}; // ensure module scope
