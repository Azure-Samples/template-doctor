/* eslint-disable @typescript-eslint/no-explicit-any */
// Migrated from js/notification-system.js
// Minimal modifications: strong typing hooks + exported API while preserving global behavior.

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface ConfirmOptions {
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export interface NotificationAPI {
  showSuccess(title: string, message: string, duration?: number): HTMLElement | undefined;
  showError(title: string, message: string, duration?: number): HTMLElement | undefined;
  showWarning(title: string, message: string, duration?: number): HTMLElement | undefined;
  showInfo(title: string, message: string, duration?: number): HTMLElement | undefined;
  confirm(
    title: string,
    message: string,
    options?: ConfirmOptions,
  ): string | undefined;
}

let container: HTMLElement | null = null;

function ensureContainer(): HTMLElement {
  if (container && document.body.contains(container)) return container;
  let existing = document.getElementById('notification-container');
  if (!existing) {
    existing = document.createElement('div');
    existing.id = 'notification-container';
    existing.style.position = 'fixed';
    existing.style.top = '20px';
    existing.style.right = '20px';
    existing.style.zIndex = '9999';
    existing.style.width = '320px';
    document.body.appendChild(existing);
  }
  container = existing;
  return existing;
}

function injectStyleOnce() {
  const markerId = 'notification-system-style';
  if (document.getElementById(markerId)) return;
  const style = document.createElement('style');
  style.id = markerId;
  style.textContent = `/* Notification System Styles (migrated) */\n    .notification {\n      margin-bottom: 10px;\n      padding: 16px;\n      border-radius: 6px;\n      box-shadow: 0 4px 12px rgba(0,0,0,0.15);\n      animation: notification-slide-in 0.3s ease-out forwards;\n      opacity: 0;\n      transform: translateX(40px);\n      transition: transform 0.3s ease-out, opacity 0.3s ease-out;\n      color: #24292e;\n      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;\n      position: relative;\n      font-size: 14px;\n      background:#fff;\n    }\n    .notification.slide-out { animation: notification-slide-out 0.3s ease-in forwards; }\n    @keyframes notification-slide-in { from{opacity:0;transform:translateX(40px);} to{opacity:1;transform:translateX(0);} }\n    @keyframes notification-slide-out { from{opacity:1;transform:translateX(0);} to{opacity:0;transform:translateX(40px);} }\n    .notification-icon { position:absolute; left:16px; top:17px; font-size:16px; }\n    .notification-close { position:absolute; top:12px; right:12px; cursor:pointer; font-size:16px; opacity:0.7; transition:opacity .2s; border:none; background:transparent; color:inherit;}\n    .notification-close:hover { opacity:1; }\n    .notification-title { font-weight:600; margin:0 0 4px 0; padding-right:20px; }\n    .notification-message { margin:0; opacity:0.8; }\n    .notification-content { margin-left:26px; }\n    .notification.success { background:#f0fff4; border-left:4px solid #28a745; }\n    .notification.success .notification-icon { color:#28a745; }\n    .notification.error { background:#ffeef0; border-left:4px solid #d73a49; }\n    .notification.error .notification-icon { color:#d73a49; }\n    .notification.warning { background:#fffbdd; border-left:4px solid #b08800; }\n    .notification.warning .notification-icon { color:#b08800; }\n    .notification.info { background:#f1f8ff; border-left:4px solid #0366d6; }\n    .notification.info .notification-icon { color:#0366d6; }\n    .notification-progress { position:absolute; bottom:0; left:0; height:3px; width:100%; background:rgba(0,0,0,0.1);}\n    .notification-progress-bar { height:100%; width:0%; transition:width linear;}\n    .notification.success .notification-progress-bar { background:#28a745;}\n    .notification.error .notification-progress-bar { background:#d73a49;}\n    .notification.warning .notification-progress-bar { background:#b08800;}\n    .notification.info .notification-progress-bar { background:#0366d6;}\n  `;
  document.head.appendChild(style);
}

function iconFor(type: NotificationType): string {
  switch (type) {
    case 'success':
      return '<i class="fas fa-check-circle notification-icon"></i>';
    case 'error':
      return '<i class="fas fa-times-circle notification-icon"></i>';
    case 'warning':
      return '<i class="fas fa-exclamation-triangle notification-icon"></i>';
    case 'info':
    default:
      return '<i class="fas fa-info-circle notification-icon"></i>';
  }
}

function showNotification(type: NotificationType, title: string, message: string, duration = 5000): HTMLElement | undefined {
  injectStyleOnce();
  const parent = ensureContainer();
  const notificationId = 'notification-' + Date.now();
  const el = document.createElement('div');
  el.id = notificationId;
  el.className = `notification ${type}`;
  el.innerHTML = `\n    ${iconFor(type)}\n    <button class="notification-close" aria-label="Close" data-close>\n      <i class="fas fa-times"></i>\n    </button>\n    <div class="notification-content">\n      <div class="notification-title">${title}</div>\n      <p class="notification-message">${message}</p>\n    </div>\n    <div class="notification-progress">\n      <div class="notification-progress-bar"></div>\n    </div>\n  `;
  parent.prepend(el);
  const closeBtn = el.querySelector('[data-close]');
  closeBtn?.addEventListener('click', () => el.remove());
  if (duration > 0) {
    const bar = el.querySelector('.notification-progress-bar') as HTMLElement | null;
    if (bar) {
      bar.style.transition = `width ${duration}ms linear`;
      setTimeout(() => (bar.style.width = '100%'), 10);
    }
    setTimeout(() => {
      if (document.getElementById(notificationId)) {
        el.classList.add('slide-out');
        setTimeout(() => document.getElementById(notificationId)?.remove(), 300);
      }
    }, duration);
  }
  return el;
}

export const NotificationSystem: NotificationAPI = {
  showSuccess: (t, m, d) => showNotification('success', t, m, d),
  showError: (t, m, d = 8000) => showNotification('error', t, m, d),
  showWarning: (t, m, d = 7000) => showNotification('warning', t, m, d),
  showInfo: (t, m, d) => showNotification('info', t, m, d),
  confirm: (title, message, opts = {}) => {
    const { confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel } = opts;
    const el = showNotification('warning', title, message, 0);
    if (!el) return undefined;
    const content = el.querySelector('.notification-content');
    if (content) {
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'notification-actions';
      actionsDiv.style.marginTop = '10px';
      actionsDiv.style.display = 'flex';
      actionsDiv.style.gap = '8px';
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn notification-action';
      cancelBtn.style.flex = '1';
      cancelBtn.style.padding = '6px 12px';
      cancelBtn.style.background = '#f6f8fa';
      cancelBtn.style.border = '1px solid #d0d7de';
      cancelBtn.style.borderRadius = '6px';
      cancelBtn.textContent = cancelLabel;
      cancelBtn.addEventListener('click', () => {
        try { onCancel?.(); } finally { el.remove(); }
      });
      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'btn btn-primary notification-action';
      confirmBtn.style.flex = '1';
      confirmBtn.style.padding = '6px 12px';
      confirmBtn.style.background = '#2da44e';
      confirmBtn.style.color = 'white';
      confirmBtn.style.border = '1px solid #2da44e';
      confirmBtn.style.borderRadius = '6px';
      confirmBtn.textContent = confirmLabel;
      confirmBtn.addEventListener('click', () => {
        try { onConfirm?.(); } finally { el.remove(); }
      });
      actionsDiv.appendChild(cancelBtn);
      actionsDiv.appendChild(confirmBtn);
      content.appendChild(actionsDiv);
    }
    return el.id;
  },
};

// Attach to window for backward compatibility (script-tag usage)
if (typeof window !== 'undefined') {
  const existing: any = (window as any).NotificationSystem;
  if (!existing || !existing.__queue) {
    (window as any).NotificationSystem = NotificationSystem;
  } else {
    // Replace stub with real implementation but flush queued notifications first
    const queued = Array.isArray(existing.__queue) ? existing.__queue.slice() : [];
    (window as any).NotificationSystem = NotificationSystem;
    if (queued.length) {
      // Process asynchronously to avoid blocking load
      setTimeout(() => {
        queued.forEach((n: any) => {
          try {
            switch (n.type) {
              case 'success': NotificationSystem.showSuccess(n.title, n.message, n.duration); break;
              case 'error': NotificationSystem.showError(n.title, n.message, n.duration); break;
              case 'warning': NotificationSystem.showWarning(n.title, n.message, n.duration); break;
              default: NotificationSystem.showInfo(n.title, n.message, n.duration); break;
            }
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('[notification-system] Failed to flush queued item', e);
          }
        });
      }, 0);
    }
  }
}

export default NotificationSystem;
