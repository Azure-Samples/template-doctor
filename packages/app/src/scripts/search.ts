// Minimal search module (transitional)
// Provides just enough behavior for Playwright test expecting a .repo-item to appear
// when the user searches for a repository. It searches within window.templatesData.

interface TemplateEntryLike { repoUrl: string; relativePath?: string }

function performSearch(query: string) {
  const container = document.getElementById('search-results');
  if (!container) return;
  container.innerHTML = '';
  const q = query.trim().toLowerCase();
  if (!q) return;
  const data: TemplateEntryLike[] = Array.isArray((window as any).templatesData) ? (window as any).templatesData : [];
  const matches = data.filter(d => (d.repoUrl && d.repoUrl.toLowerCase().includes(q)) || (d.relativePath && d.relativePath.toLowerCase().includes(q)));
  if (matches.length === 0) return;
  for (const m of matches.slice(0, 5)) {
    const div = document.createElement('div');
  div.className = 'repo-item';
  div.setAttribute('data-test','repo-item');
    const repoName = m.repoUrl.includes('github.com/') ? m.repoUrl.split('github.com/')[1] : (m.relativePath || m.repoUrl);
    div.innerHTML = `<div class="repo-name">${repoName}</div>`;
    container.appendChild(div);
  }
  // Signal to tests that results are ready
  (window as any).__lastSearchResultsCount = matches.length;
  document.dispatchEvent(new CustomEvent('search-results-ready', { detail: { count: matches.length } }));
}

function attachSearch() {
  const input = document.getElementById('repo-search') as HTMLInputElement | null;
  const btn = document.getElementById('search-button');
  if (!input || !btn) return; // elements may not yet be present; will retry shortly
  if ((btn as any)._searchBound) return; // idempotent
  (btn as any)._searchBound = true;
  const handler = () => performSearch(input.value);
  btn.addEventListener('click', handler);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') handler(); });
}

function init() {
  attachSearch();
  // Retry a few times if elements injected later
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    attachSearch();
    if (attempts >= 10) clearInterval(interval);
  }, 300);
  // Re-attach after template data load events (in case search section becomes visible later)
  document.addEventListener('template-data-loaded', () => {
    setTimeout(() => {
      attachSearch();
      // If user already typed a query (or tests pre-filled), auto-run search to avoid race with click binding.
      const input = document.getElementById('repo-search') as HTMLInputElement | null;
      if (input && input.value.trim()) {
        performSearch(input.value);
      }
    }, 0);
  });
  // Test hook: allow triggering search via custom event
  document.addEventListener('perform-test-search', (e: Event) => {
    try {
      const ce = e as CustomEvent<{ query?: string }>;
      performSearch(ce.detail?.query || '');
    } catch {/* ignore */}
  });
  (window as any).__searchModuleReady = true;
  document.dispatchEvent(new CustomEvent('search-module-ready'));
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  queueMicrotask(init);
} else {
  document.addEventListener('DOMContentLoaded', init);
}

export {}; // module scope