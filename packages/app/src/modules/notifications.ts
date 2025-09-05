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
    const container = document.querySelector(`.${this.containerSelector}`)!;
    container.appendChild(el);

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

// Initialize on DOM ready replicating legacy behavior
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!(window as any).Notifications) {
      (window as any).Notifications = new RichNotificationSystem();
    }
    if (!(window as any).NotificationSystem) {
      (window as any).NotificationSystem = (window as any).Notifications;
    }
  });
}

export default RichNotificationSystem;
