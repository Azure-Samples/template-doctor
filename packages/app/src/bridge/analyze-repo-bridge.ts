// Bridge replacing legacy js/app.js global analyzeRepo implementation.
// Provides window.analyzeRepo with a minimal UI wiring using existing TS modules.
// Phases: 1) co-exist with legacy, 2) remove legacy script tag, 3) prune unused globals.

interface AnalyzeResult { repoUrl: string; ruleSet: string; compliance?: any; [k: string]: any }

function safeGet(id: string): HTMLElement | null { return document.getElementById(id); }

function setDisplay(el: HTMLElement | null, value: string) { if (el) el.style.display = value; }

function notify(type: 'info'|'success'|'error'|'warning', title: string, message: string, duration?: number) {
  const ns: any = (window as any).NotificationSystem;
  if (!ns) return;
  const fn = type === 'info'? ns.showInfo : type === 'success'? ns.showSuccess : type === 'error'? ns.showError : ns.showWarning;
  try { fn(title, message, duration); } catch {}
}

async function analyzeRepo(repoUrl: string, ruleSet = 'dod'): Promise<AnalyzeResult | void> {
  if (!repoUrl) { console.error('[bridge] analyzeRepo missing repoUrl'); return; }
  const cfg: any = (window as any).TemplateDoctorConfig || {};
  if ((!ruleSet || ruleSet === 'dod') && typeof cfg.defaultRuleSet === 'string') {
    ruleSet = cfg.defaultRuleSet;
  }

  if (ruleSet === 'show-modal') {
    const modal = (window as any).showRuleSetModal || (window as any).RulesetModal?.show;
    if (typeof modal === 'function') modal(repoUrl);
    else console.warn('[bridge] ruleset modal not available');
    return;
  }

  // UI refs (do NOT mutate visibility until auth guard passes)
  const searchSection = safeGet('search-section');
  let analysisSection = safeGet('analysis-section');
  let resultsContainer = safeGet('results-container');
  let loadingContainer = safeGet('loading-container');
  const errorSection = safeGet('error-section');
  const errorMessage = safeGet('error-message');

  // Create analysis section lazily if missing (post-auth only)
  if (!analysisSection) {
    const section = document.createElement('section');
    section.id = 'analysis-section';
    section.className = 'analysis-section';
    section.innerHTML = `
      <div class="analysis-header">
        <button id="back-button" class="back-button"><i class="fas fa-arrow-left"></i> Back to Search</button>
        <div class="repo-info"><h3 id="repo-name">Repository Name</h3><span id="repo-url">Repository URL</span></div>
      </div>
      <div class="loading-container" id="loading-container" style="display:none">
        <div class="loading-spinner"></div>
        <p>Analyzing repository... This may take a moment.</p>
      </div>
      <div id="results-container" class="results-container" style="display:none"></div>
    `;
    const footer = document.querySelector('footer, .site-footer');
    if (footer?.parentNode) footer.parentNode.insertBefore(section, footer); else document.body.appendChild(section);
    analysisSection = section;
    resultsContainer = safeGet('results-container');
    loadingContainer = safeGet('loading-container');
    console.debug('[bridge] dynamically created #analysis-section');
  }

  // Auth guard: prevent unauthorized invocation (e.g., stray global call before login)
  const auth: any = (window as any).GitHubAuth;
  if (auth && typeof auth.isAuthenticated === 'function' && !auth.isAuthenticated()) {
    notify('warning', 'Login Required', 'Please login with GitHub before analyzing a repository.', 4000);
    // Ensure analysis section stays hidden
    setDisplay(analysisSection, 'none');
    return;
  }
  if (analysisSection) {
    // Mark ready only when authenticated
    try { analysisSection.setAttribute('data-auth-ready', 'true'); } catch {}
  }

  // Proceed with UI transition only after guard passes
  setDisplay(searchSection, 'none');
  setDisplay(analysisSection, 'block');
  setDisplay(resultsContainer, 'none');
  setDisplay(loadingContainer, 'flex');
  setDisplay(errorSection, 'none');

  const repoName = repoUrl.split('github.com/')[1] || repoUrl;
  const rn = safeGet('repo-name'); if (rn) rn.textContent = repoName;
  const ru = safeGet('repo-url'); if (ru) ru.textContent = repoUrl;

  notify('info', 'Analysis Started', `Analyzing ${repoName} (${ruleSet})`, 2500);

  try {
    const analyzer: any = (window as any).TemplateAnalyzer;
    const dashboard: any = (window as any).DashboardRenderer;
    if (!analyzer || !dashboard) throw new Error('Core services not initialized');
    const result = await analyzer.analyzeTemplate(repoUrl, ruleSet);
    setDisplay(loadingContainer, 'none');
    if (resultsContainer) {
      setDisplay(resultsContainer, 'block');
      try { dashboard.render(result, resultsContainer); } catch (e) { console.error('[bridge] dashboard render failed', e); }
    }
    notify('success', 'Analysis Complete', repoName, 4000);
    return result;
  } catch (err: any) {
    console.error('[bridge] analyzeRepo failed', err);
    setDisplay(loadingContainer, 'none');
    if (errorSection && errorMessage) {
      setDisplay(errorSection, 'block');
      errorMessage.textContent = err?.message || 'Analysis failed';
    }
    notify('error', 'Analysis Failed', err?.message || 'Unknown error', 6000);
    throw err;
  }
}

// Install global if absent or if legacy placeholder exists.
if (!(window as any).analyzeRepo || (window as any).analyzeRepo.__legacy) {
  (window as any).analyzeRepo = analyzeRepo;
  (window as any).analyzeRepo.__bridge = true;
  document.dispatchEvent(new CustomEvent('analyze-repo-ready'));
  console.debug('[bridge] analyzeRepo bridge installed');
}

export {}; // module
