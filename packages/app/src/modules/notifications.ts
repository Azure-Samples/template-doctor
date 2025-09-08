/* eslint-disable @typescript-eslint/no-explicit-any */
// Migrated from js/notifications.js with light typing.

export interface ActionButton { label: string; onClick?: () => void; primary?: boolean; }
export type RichType = 'info' | 'success' | 'warning' | 'error';

interface ShowOptions {
  title?: string;
  message?: string;
  type?: RichType;
  duration?: number;
  actions?: ActionButton[];
}

class RichNotificationSystem {
  private containerSelector = 'notification-container';
  private notificationIdPrefix = 'notification-';
  private defaultDuration = 6000;
  private notificationCount = 0;

  constructor() {
    this.initContainer();
  }

  private initContainer() {
    let container = document.querySelector(`.${this.containerSelector}`);
    if (!container) {
      container = document.createElement('div');
      container.className = this.containerSelector;
      document.body.appendChild(container);
    }
  }

  private getIconForType(type: RichType): string {
    switch (type) {
      case 'success': return '<i class="fas fa-check-circle"></i>';
      case 'warning': return '<i class="fas fa-exclamation-triangle"></i>';
      case 'error': return '<i class="fas fa-times-circle"></i>';
      case 'info':
      default: return '<i class="fas fa-info-circle"></i>';
    }
  }
  private getTitleForType(type: RichType): string {
    switch (type) {
      case 'success': return 'Success';
      case 'warning': return 'Warning';
      case 'error': return 'Error';
      case 'info':
      default: return 'Information';
    }
  }

  show(opts: ShowOptions) {
    // Defensive: ensure container exists in case initialization race prevented constructor from appending it.
    this.initContainer();
    const { title, message, type = 'info', duration = this.defaultDuration, actions = [] } = opts;
    const id = `${this.notificationIdPrefix}${++this.notificationCount}`;
    const el = document.createElement('div');
    el.id = id;
    el.className = `notification ${type}`;
    el.innerHTML = `
      <div class="notification-header">
        <h3 class="notification-title">${this.getIconForType(type)} ${title || this.getTitleForType(type)}</h3>
        <button class="notification-close" aria-label="Close"><i class='fas fa-times'></i></button>
      </div>
      ${message ? `<div class="notification-content">${message}</div>` : ''}
      ${actions.length ? '<div class="notification-actions"></div>' : ''}
      <div class="notification-progress"><div class="notification-progress-bar"></div></div>
    `;
    try {
      const container = document.querySelector(`.${this.containerSelector}`);
      if (!container) {
        (window as any).__notifDiag = (window as any).__notifDiag || { missingContainer: 0, attempts: 0, errors: [] };
        (window as any).__notifDiag.missingContainer++;
        // Attempt to rebuild container immediately
        this.initContainer();
        const retry = document.querySelector(`.${this.containerSelector}`);
        if (retry) retry.appendChild(el); else throw new Error('Container still missing after initContainer');
      } else {
        container.appendChild(el);
      }
    } catch (e:any) {
      (window as any).__notifDiag = (window as any).__notifDiag || { missingContainer: 0, attempts: 0, errors: [] };
      (window as any).__notifDiag.errors.push('append-failed:' + (e?.message||e));
    } finally {
      (window as any).__notifDiag = (window as any).__notifDiag || { missingContainer: 0, attempts: 0, errors: [] };
      (window as any).__notifDiag.attempts++;
    }

    if (actions.length) {
      const actionsContainer = el.querySelector('.notification-actions')!;
      actions.forEach(a => {
        const btn = document.createElement('button');
        btn.className = `notification-action ${a.primary ? 'primary' : 'secondary'}`;
        btn.textContent = a.label;
        btn.addEventListener('click', e => { e.preventDefault(); a.onClick?.(); });
        actionsContainer.appendChild(btn);
      });
    }

    const close = () => this.close(id);
    el.querySelector('.notification-close')?.addEventListener('click', close);
    setTimeout(() => el.classList.add('show'), 10);

    if (duration > 0) {
      const bar = el.querySelector('.notification-progress-bar') as HTMLElement | null;
      if (bar) {
        bar.style.transition = `width ${duration}ms linear`;
        setTimeout(() => (bar.style.width = '100%'), 10);
      }
      setTimeout(close, duration);
    }
    return id;
  }

  close(id: string) {
    const n = document.getElementById(id);
    if (!n) return;
    n.classList.remove('show');
    setTimeout(() => n.remove(), 500);
  }

  update(id: string, opts: Partial<ShowOptions> & { resetTimer?: boolean }) {
    const n = document.getElementById(id);
    if (!n) return;
    const { title, message, type, resetTimer, actions } = opts;
    if (type) {
      const classes = n.className.split(' ').filter(c => !['info','success','warning','error'].includes(c));
      n.className = [...classes, type].join(' ');
      const titleEl = n.querySelector('.notification-title');
      if (titleEl) titleEl.innerHTML = `${this.getIconForType(type)} ${title || this.getTitleForType(type)}`;
    }
    if (title && !type) {
      const titleEl = n.querySelector('.notification-title');
      if (titleEl) {
        const icon = titleEl.innerHTML.split('</i>')[0] + '</i>';
        titleEl.innerHTML = `${icon} ${title}`;
      }
    }
    if (message !== undefined) {
      let content = n.querySelector('.notification-content');
      if (!content && message) {
        content = document.createElement('div');
        content.className = 'notification-content';
        const header = n.querySelector('.notification-header');
        header?.insertAdjacentElement('afterend', content);
      }
      if (content) {
        if (message) content.innerHTML = message; else content.remove();
      }
    }
    if (resetTimer) {
      const bar = n.querySelector('.notification-progress-bar') as HTMLElement | null;
      if (bar) {
        bar.style.transition = 'none';
        bar.style.width = '0%';
        setTimeout(() => { bar.style.transition = 'width 6s linear'; bar.style.width = '100%'; }, 10);
        setTimeout(() => this.close(id), this.defaultDuration);
      }
    }
    if (actions) {
      let actionsContainer = n.querySelector('.notification-actions');
      if (!actionsContainer && actions.length) {
        actionsContainer = document.createElement('div');
        actionsContainer.className = 'notification-actions';
        const progress = n.querySelector('.notification-progress');
        progress?.insertAdjacentElement('beforebegin', actionsContainer);
      }
      if (actionsContainer) {
        actionsContainer.innerHTML = '';
        actions.forEach(a => {
          const btn = document.createElement('button');
            btn.className = `notification-action ${a.primary ? 'primary' : 'secondary'}`;
            btn.textContent = a.label;
            btn.addEventListener('click', e => { e.preventDefault(); a.onClick?.(); });
            actionsContainer.appendChild(btn);
        });
      }
    }
  }

  info(t: string, m: string, d?: number) { return this.show({ title: t, message: m, type: 'info', duration: d }); }
  success(t: string, m: string, d?: number) { return this.show({ title: t, message: m, type: 'success', duration: d }); }
  warning(t: string, m: string, d?: number) { return this.show({ title: t, message: m, type: 'warning', duration: d }); }
  error(t: string, m: string, d?: number) { return this.show({ title: t, message: m, type: 'error', duration: d }); }

  showInfo = this.info.bind(this);
  showSuccess = this.success.bind(this);
  showWarning = this.warning.bind(this);
  showError = this.error.bind(this);
  showLoading(t = 'Loading...', m = '') {
    const id = this.show({ title: `<span class="notification-spinner"></span> ${t}`, message: m, type: 'info', duration: 0 });
    return {
      id,
      update: (nt?: string, nm?: string) => this.update(id, { title: `<span class=\"notification-spinner\"></span> ${nt || t}`, message: nm ?? m }),
      success: (st?: string, sm?: string) => this.update(id, { title: st || 'Success', message: sm ?? m, type: 'success', resetTimer: true }),
      error: (et?: string, em?: string) => this.update(id, { title: et || 'Error', message: em ?? m, type: 'error', resetTimer: true }),
      close: () => this.close(id),
    };
  }
  // Back-compat alias expected by some legacy tests
  loading(t?: string, m?: string){ return this.showLoading(t, m); }
  confirm(title: string, message: string, opts: { confirmLabel?: string; cancelLabel?: string; onConfirm?: ()=>void; onCancel?: ()=>void } = {}) {
    const { confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm = () => {}, onCancel = () => {} } = opts;
    const id = this.show({ title, message, type: 'warning', duration: 0, actions: [
      { label: cancelLabel, onClick: () => { onCancel(); this.close(id); } },
      { label: confirmLabel, onClick: () => { onConfirm(); this.close(id); }, primary: true },
    ]});
    return id;
  }
  showConfirmation(title: string, message: string, confirmLabel = 'Confirm', cancelLabel = 'Cancel', cb: (confirmed: boolean)=>void = () => {}) {
    return this.confirm(title, message, { confirmLabel, cancelLabel, onConfirm: () => cb(true), onCancel: () => cb(false) });
  }
}

import { markNotificationsReady } from './notifications-ready.js';

function initializeIfNeeded(){
  const w: any = (window as any);
  // Keep references to pre-existing globals (guard stub or legacy objects)
  const existingNotificationSystem = w.NotificationSystem;
  const existingNotifications = w.Notifications;

  const isGuardStub = (obj: any) => !!obj && (!obj.show || !!obj.__queue || typeof obj.show !== 'function');
  // Decide if we must create the rich system (always if not present OR present but guard stub)
  if (!existingNotifications || isGuardStub(existingNotifications)) {
    try {
      w.Notifications = new RichNotificationSystem();
    } catch (e){
      console.error('[notifications] Failed to construct rich system', e);
      return; // Without a system we cannot proceed
    }
  }

  // Determine which object holds a queue to flush (prefer guard with __queue)
  const guardWithQueue = existingNotificationSystem && Array.isArray(existingNotificationSystem.__queue)
    ? existingNotificationSystem
    : (existingNotifications && Array.isArray(existingNotifications.__queue) ? existingNotifications : null);

  if (guardWithQueue && guardWithQueue.__queue.length) {
    const queued = guardWithQueue.__queue.slice();
    guardWithQueue.__queue.length = 0; // clear to avoid double-flush
    setTimeout(() => {
      queued.forEach((n: any) => {
        try {
          switch(n.type){
            case 'success': w.Notifications.showSuccess(n.title, n.message, n.duration); break;
            case 'error': w.Notifications.showError(n.title, n.message, n.duration); break;
            case 'warning': w.Notifications.showWarning(n.title, n.message, n.duration); break;
            default: w.Notifications.showInfo(n.title, n.message, n.duration); break;
          }
        } catch(e){
          // eslint-disable-next-line no-console
          console.warn('[notifications] Failed to flush queued guard notification', e);
        }
      });
    }, 0);
  }
  markNotificationsReady(w.Notifications);
}

// Initialize immediately if DOM already parsed; otherwise wait.
if (typeof document !== 'undefined') {
  // If body not yet available, poll briefly instead of waiting full DOMContentLoaded (speeds up tests)
  const fastInit = () => {
    try {
      if (document.body) { initializeIfNeeded(); return true; }
      return false;
    } catch { return false; }
  };
  if (!fastInit()) {
    let attempts = 0;
    const int = setInterval(() => {
      attempts++;
      if (fastInit() || attempts > 20) { // up to ~2s worst case
        clearInterval(int);
      }
    }, 100);
  }
}

export default RichNotificationSystem;
