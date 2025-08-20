// Config Panel UI logic
// Renders current window.AppConfig values and provides simple controls to open/close the panel.

(function () {
  const qs = (s) => document.querySelector(s);
  const overlay = qs('#config-panel-overlay');
  const panel = qs('#config-panel');
  const openBtn = qs('#open-config-panel');
  const closeBtn = qs('#close-config-panel');
  const kvHost = qs('#config-kv');
  const reloadBtn = qs('#reload-app');
  const openConfigBtn = qs('#open-config-file');

  const SENSITIVE_KEYS = new Set([
    'clientId',
    'clientSecret',
    'secret',
    'token',
    'accessToken',
    'authorization',
    'auth',
    'apiKey',
  ]);

  function toKVs(obj, prefix = '') {
    const kvs = [];
    Object.keys(obj || {}).forEach((k) => {
      const v = obj[k];
      const key = prefix ? `${prefix}.${k}` : k;
      // Filter sensitive keys (mask or skip)
      if (SENSITIVE_KEYS.has(k) || /secret|token|clientid|apikey/i.test(k)) {
        kvs.push([key, '••••••']);
        return;
      }
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        kvs.push(...toKVs(v, key));
      } else {
        kvs.push([key, v]);
      }
    });
    return kvs;
  }

  function renderConfig() {
    if (!kvHost) return;
    const conf = window.AppConfig || {};
    const kvs = toKVs(conf);
    kvHost.innerHTML = '';
    if (!kvs.length) {
      kvHost.innerHTML = '<div class="empty">No configuration loaded yet.</div>';
      return;
    }
    const list = document.createElement('dl');
    list.className = 'kv-list';
    kvs.forEach(([k, v]) => {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      const val = typeof v === 'string' ? v : JSON.stringify(v);
      dd.textContent = val;
      list.appendChild(dt);
      list.appendChild(dd);
    });
    kvHost.appendChild(list);
  }

  function openPanel() {
    renderConfig();
    panel?.classList.add('open');
    overlay?.classList.add('visible');
    panel?.setAttribute('aria-hidden', 'false');
  }

  function closePanel() {
    panel?.classList.remove('open');
    overlay?.classList.remove('visible');
    panel?.setAttribute('aria-hidden', 'true');
  }

  openBtn?.addEventListener('click', openPanel);
  closeBtn?.addEventListener('click', closePanel);
  overlay?.addEventListener('click', closePanel);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanel();
  });

  reloadBtn?.addEventListener('click', () => {
    window.location.reload();
  });

  // Use in-app notifications (no native alerts)
  openConfigBtn?.addEventListener('click', () => {
    const path = 'packages/app/config.json';
    const notify = window.Notifications || window.NotificationSystem;
    if (!notify) return;

    const copyPath = async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(path);
          notify.success('Copied', 'Path copied to clipboard', 2000);
        } else {
          // Fallback: create a temp input
          const el = document.createElement('input');
          el.value = path;
          document.body.appendChild(el);
          el.select();
          document.execCommand('copy');
          el.remove();
          notify.success('Copied', 'Path copied to clipboard', 2000);
        }
      } catch (e) {
        notify.error('Copy failed', 'Could not copy the path.');
      }
    };

    notify.show({
      title: 'Open configuration',
      message: `Edit <code>${path}</code> in your workspace and refresh the page.`,
      type: 'info',
      duration: 8000,
      actions: [{ label: 'Copy path', onClick: copyPath, primary: true }],
    });
  });
})();
