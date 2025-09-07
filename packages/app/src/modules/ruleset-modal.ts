// TypeScript migration of legacy ruleset-modal.js
// Provides a modal allowing the user to pick a ruleset (DoD / Partner / Docs / Custom JSON or Gist)
// and optionally enable a one-off archive override. Exposes `window.showRulesetModal` for backward compat.

interface RulesetModalElements {
  modal: HTMLElement;
  form: HTMLFormElement | null;
  analyzeBtn: HTMLButtonElement | null;
  customConfigContainer: HTMLElement | null;
  customConfigInput: HTMLTextAreaElement | null;
  gistUrlInput: HTMLInputElement | null;
  fetchGistBtn: HTMLButtonElement | null;
  archiveOverrideContainer: HTMLElement | null;
  archiveOverrideCheckbox: HTMLInputElement | null;
  archiveOverrideHint: HTMLElement | null;
}

function ensureModal(): RulesetModalElements {
  let existing = document.getElementById('ruleset-modal');
  if (!existing) {
    existing = document.createElement('div');
    existing.id = 'ruleset-modal';
    existing.className = 'modal';
    existing.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Select Configuration</h2>
          <span class="close" role="button" aria-label="Close ruleset selection modal">&times;</span>
        </div>
        <div class="modal-body">
          <p>Select the configuration ruleset to use for analyzing this template:</p>
          <form id="ruleset-form">
            <div class="form-group">
              <label>
                <input type="radio" name="ruleset" value="dod" checked>
                <strong>DoD - Default</strong>
              </label>
              <p class="ruleset-description">The full Definition of Done ruleset with all requirements.</p>
            </div>
            <div class="form-group">
              <label>
                <input type="radio" name="ruleset" value="partner">
                <strong>Partner</strong>
              </label>
              <p class="ruleset-description">A simplified ruleset for partner templates.</p>
            </div>
            <div class="form-group">
              <label>
                <input type="radio" name="ruleset" value="docs">
                <strong>Documentation</strong>
              </label>
              <p class="ruleset-description">A ruleset focused on https://aka.ms/samples guidance.</p>
            </div>
            <div class="form-group">
              <label>
                <input type="radio" name="ruleset" value="custom">
                <strong>Custom</strong>
              </label>
              <p class="ruleset-description">Use a custom configuration ruleset.</p>
            </div>
            <div id="custom-config-container" style="display:none;">
              <div class="custom-config-tabs">
                <button type="button" class="tab-btn active" data-tab="paste">Paste JSON</button>
                <button type="button" class="tab-btn" data-tab="gist">GitHub Gist URL</button>
              </div>
              <div id="paste-tab" class="tab-content active">
                <textarea id="custom-config-json" rows="10" placeholder="Paste your custom ruleset configuration in JSON format..."></textarea>
              </div>
              <div id="gist-tab" class="tab-content">
                <div class="gist-input-container">
                  <input type="text" id="gist-url" placeholder="Enter a GitHub Gist URL (e.g., https://gist.github.com/username/gistid)" class="gist-input" />
                  <button type="button" id="fetch-gist-btn" class="btn btn-small">Fetch Gist</button>
                </div>
              </div>
              <p class="helper-text">JSON format should match the structure of the DoD ruleset. <a href="https://gist.github.com/anfibiacreativa/d8f29b232397069ec3157c8be799c1ac" target="_blank" rel="noopener noreferrer">Learn More</a></p>
            </div>
          </form>
          <div id="archive-override-container" class="form-group" style="display:none; margin-top:12px;">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="archive-override" />
              <span>
                Also save metadata to the centralized archive for this analysis
                <span id="archive-override-hint" style="display:block; font-size:12px; color:#666; margin-top:4px;"></span>
              </span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button id="analyze-with-ruleset-btn" class="btn">Analyze Template</button>
        </div>
      </div>`;
    document.body.appendChild(existing);
  }

  // Collect element references
  const modal = existing as HTMLElement;
  const form = modal.querySelector('#ruleset-form') as HTMLFormElement | null;
  const analyzeBtn = modal.querySelector('#analyze-with-ruleset-btn') as HTMLButtonElement | null;
  const customConfigContainer = modal.querySelector('#custom-config-container') as HTMLElement | null;
  const customConfigInput = modal.querySelector('#custom-config-json') as HTMLTextAreaElement | null;
  const gistUrlInput = modal.querySelector('#gist-url') as HTMLInputElement | null;
  const fetchGistBtn = modal.querySelector('#fetch-gist-btn') as HTMLButtonElement | null;
  const archiveOverrideContainer = modal.querySelector('#archive-override-container') as HTMLElement | null;
  const archiveOverrideCheckbox = modal.querySelector('#archive-override') as HTMLInputElement | null;
  const archiveOverrideHint = modal.querySelector('#archive-override-hint') as HTMLElement | null;

  setupHandlers({
    modal,
    form,
    analyzeBtn,
    customConfigContainer,
    customConfigInput,
    gistUrlInput,
    fetchGistBtn,
    archiveOverrideContainer,
    archiveOverrideCheckbox,
    archiveOverrideHint,
  });

  return {
    modal,
    form,
    analyzeBtn,
    customConfigContainer,
    customConfigInput,
    gistUrlInput,
    fetchGistBtn,
    archiveOverrideContainer,
    archiveOverrideCheckbox,
    archiveOverrideHint,
  };
}

function setupHandlers(refs: RulesetModalElements) {
  const {
    modal,
    form,
    analyzeBtn,
    customConfigContainer,
    customConfigInput,
    gistUrlInput,
    fetchGistBtn,
    archiveOverrideContainer,
    archiveOverrideCheckbox,
    archiveOverrideHint,
  } = refs;

  // Avoid duplicate bindings by tagging modal
  if ((modal as any).__rulesetHandlersBound) return;
  (modal as any).__rulesetHandlersBound = true;

  // Close button
  const closeBtn = modal.querySelector('.close') as HTMLElement | null;
  if (closeBtn) {
    closeBtn.addEventListener('click', () => (modal.style.display = 'none'));
  }

  // Outside click to close
  window.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  // Tab switching
  const tabBtns = Array.from(modal.querySelectorAll<HTMLButtonElement>('.tab-btn'));
  const tabContents = Array.from(modal.querySelectorAll<HTMLElement>('.tab-content'));
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      tabBtns.forEach((b) => b.classList.remove('active'));
      tabContents.forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      const id = btn.getAttribute('data-tab');
      const content = id ? modal.querySelector(`#${id}-tab`) : null;
      if (content) content.classList.add('active');
    });
  });

  // Radio change -> toggle custom config container
  if (form) {
    const radios = Array.from(form.querySelectorAll<HTMLInputElement>('input[type="radio"][name="ruleset"]'));
    radios.forEach((r) => {
      r.addEventListener('change', () => {
        if (r.value === 'custom') {
          if (customConfigContainer) customConfigContainer.style.display = 'block';
          // Load previously saved config
          try {
            const saved = localStorage.getItem('td_custom_ruleset');
            if (saved && customConfigInput) {
              const parsed = JSON.parse(saved);
              customConfigInput.value = JSON.stringify(parsed, null, 2);
              if (parsed.gistUrl && gistUrlInput) gistUrlInput.value = parsed.gistUrl;
            }
          } catch {
            if (customConfigInput) customConfigInput.value = '';
          }
        } else if (customConfigContainer) {
          customConfigContainer.style.display = 'none';
        }
      });
    });
  }

  // Gist fetch
  if (fetchGistBtn) {
    fetchGistBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!gistUrlInput) return;
      const gistUrl = gistUrlInput.value.trim();
      if (!gistUrl) {
        notify('warning', 'Missing URL', 'Please enter a GitHub Gist URL.', 3000);
        return;
      }
      let gistId = '';
      try {
        const parts = gistUrl.split('/');
        gistId = parts[parts.length - 1];
        if (!gistId) throw new Error('Could not extract Gist ID');
      } catch (err: any) {
        notify('error', 'Invalid Gist URL', err?.message || 'Invalid format', 5000);
        return;
      }
      fetchGistBtn.disabled = true;
      const prev = fetchGistBtn.textContent;
      fetchGistBtn.textContent = 'Loading…';
      try {
        const resp = await fetch(`https://api.github.com/gists/${gistId}`);
        if (!resp.ok) throw new Error(`Failed: ${resp.status}`);
        const data = await resp.json();
        const files = data.files || {};
        const first: any = Object.values(files)[0];
        if (!first || !first.content) throw new Error('No files in Gist');
        const parsed = JSON.parse(first.content);
        if (customConfigInput) customConfigInput.value = JSON.stringify(parsed, null, 2);
        // switch to paste tab
        tabBtns.forEach((b) => b.classList.remove('active'));
        tabContents.forEach((c) => c.classList.remove('active'));
        const pasteBtn = modal.querySelector('.tab-btn[data-tab="paste"]') as HTMLElement | null;
        const pasteTab = modal.querySelector('#paste-tab') as HTMLElement | null;
        pasteBtn?.classList.add('active');
        pasteTab?.classList.add('active');
        notify('success', 'Gist Loaded', 'Custom configuration loaded.', 3000);
      } catch (err: any) {
        notify('error', 'Gist Loading Failed', err?.message || 'Error fetching gist', 5000);
      } finally {
        fetchGistBtn.disabled = false;
        fetchGistBtn.textContent = prev || 'Fetch Gist';
      }
    });
  }

  // Analyze button
  if (analyzeBtn && form) {
    analyzeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const selected = form.querySelector<HTMLInputElement>('input[name="ruleset"]:checked');
      const value = selected?.value || 'dod';
      // archive override capture
      try {
        const cfg = (window as any).TemplateDoctorConfig || {};
        if (archiveOverrideContainer && archiveOverrideContainer.style.display !== 'none') {
          cfg.nextAnalysisArchiveEnabledOverride = !!archiveOverrideCheckbox?.checked;
          (window as any).TemplateDoctorConfig = cfg;
        }
      } catch {}
      if (value === 'custom') {
        try {
          const jsonText = customConfigInput?.value.trim();
          const gistUrl = gistUrlInput?.value.trim();
            if (jsonText) {
              const parsed = JSON.parse(jsonText);
              if (gistUrl) parsed.gistUrl = gistUrl;
              localStorage.setItem('td_custom_ruleset', JSON.stringify(parsed));
            }
        } catch (err: any) {
          notify('error', 'Invalid JSON', 'Custom configuration JSON is invalid.', 5000);
          return;
        }
      }
      const repoUrl = refs.modal.getAttribute('data-repo-url');
      (refs.modal as HTMLElement).style.display = 'none';
      if (repoUrl && (window as any).analyzeRepo) {
        (window as any).analyzeRepo(repoUrl, value);
      }
    });
  }

  // Initial archive override UI state
  refreshArchiveOverride(refs);
}

function refreshArchiveOverride(refs: RulesetModalElements) {
  try {
    const cfg = (window as any).TemplateDoctorConfig || {};
    if (cfg.archiveEnabled === true) {
      if (refs.archiveOverrideContainer) refs.archiveOverrideContainer.style.display = 'none';
    } else {
      if (refs.archiveOverrideContainer) refs.archiveOverrideContainer.style.display = 'block';
      if (refs.archiveOverrideCheckbox) refs.archiveOverrideCheckbox.checked = false;
      if (refs.archiveOverrideHint) refs.archiveOverrideHint.textContent = 'Global archive is OFF. Check this to archive this single run.';
    }
  } catch {}
}

function notify(type: 'success'|'error'|'warning'|'info', title: string, message: string, duration?: number) {
  const ns = (window as any).NotificationSystem;
  if (!ns) return;
  const map: Record<string,string> = { success: 'showSuccess', error: 'showError', warning: 'showWarning', info: 'showInfo' };
  const fn = ns[map[type]];
  if (typeof fn === 'function') fn(title, message, duration);
}

export function showRulesetModal(repoUrl: string) {
  const { modal } = ensureModal();
  modal.setAttribute('data-repo-url', repoUrl);
  refreshArchiveOverride(ensureModal()); // ensure latest config each time
  modal.style.display = 'block';
}

// Backward compatibility global
(window as any).showRulesetModal = showRulesetModal;

// Auto-init on DOMContentLoaded to keep parity with legacy (creates hidden modal early for faster first open)
document.addEventListener('DOMContentLoaded', () => {
  ensureModal();
});
