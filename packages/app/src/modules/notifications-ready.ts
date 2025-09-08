// notifications-ready.ts
// Consolidated readiness helper to avoid duplication across legacy and rich notification systems.
// Sets global aliases, readiness flag, and dispatches a single 'notifications-ready' event (idempotent).

/* eslint-disable @typescript-eslint/no-explicit-any */
export function markNotificationsReady(system: any) {
  if (typeof window === 'undefined') return;
  (window as any).Notifications = system;
  (window as any).NotificationSystem = system;
  try {
    // Provide legacy alias mappings in BOTH directions so any code path (old or new) works.
    const t: any = (window as any).NotificationSystem;
    if (t) {
      const ensure = (want: string, from: string) => {
        if (!t[want] && typeof t[from] === 'function') {
          try { t[want] = t[from].bind(t); } catch { /* ignore */ }
        }
      };
      // showX <-> X
      ['Info','Success','Warning','Error'].forEach(k => {
        const lower = k.toLowerCase();
        ensure('show' + k, lower); // showSuccess -> success
        ensure(lower, 'show' + k); // success -> showSuccess
      });
      // loading aliases
      ensure('showLoading', 'loading');
      ensure('loading', 'showLoading');
      // confirm / showConfirmation bridging (if rich system exposes confirm only)
      if (!t.showConfirmation && typeof t.confirm === 'function') {
        t.showConfirmation = (title: string, message: string, confirmLabel?: string, cancelLabel?: string, cb?: (c:boolean)=>void) => {
          return t.confirm(title, message, { confirmLabel, cancelLabel, onConfirm: () => cb?.(true), onCancel: () => cb?.(false) });
        };
      }
    }
  } catch { /* swallow – defensive */ }
  (window as any).__notificationsReady = true;
  try {
    if (!(window as any).__notificationReadyDispatched) {
      (window as any).__notificationReadyDispatched = true;
      document.dispatchEvent(new Event('notifications-ready'));
    }
  } catch {
    // Ignore if DOM not available (e.g., SSR or early script execution).
  }
}

export default markNotificationsReady;
