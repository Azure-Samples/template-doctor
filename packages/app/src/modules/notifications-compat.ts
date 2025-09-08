// Migrated from js/notifications-compat.js
// Provides legacy API surfaces mapping onto the modern NotificationSystem if needed.

(function(){
  if (typeof document === 'undefined') return;
  function applyCompat(){
    const sys: any = (window as any).NotificationSystem || (window as any).Notifications;
    if (!sys) return false;
    if (!(window as any).Notifications) {
      (window as any).Notifications = {
        info: (t: string, m: string, d?: number) => sys.showInfo(t, m, d),
        success: (t: string, m: string, d?: number) => sys.showSuccess(t, m, d),
        warning: (t: string, m: string, d?: number) => sys.showWarning(t, m, d),
        error: (t: string, m: string, d?: number) => sys.showError(t, m, d),
        showInfo: (t: string, m: string, d?: number) => sys.showInfo(t, m, d),
        showSuccess: (t: string, m: string, d?: number) => sys.showSuccess(t, m, d),
        showWarning: (t: string, m: string, d?: number) => sys.showWarning(t, m, d),
        showError: (t: string, m: string, d?: number) => sys.showError(t, m, d),
        loading: (t?: string, m?: string) => sys.loading ? sys.loading(t, m) : sys.showLoading(t||'Loading...', m||''),
        show: (options: any) => {
          const type = options.type || 'info';
          const duration = options.duration || 5000;
          switch(type){
            case 'success': return sys.showSuccess(options.title, options.message, duration);
            case 'warning': return sys.showWarning(options.title, options.message, duration);
            case 'error': return sys.showError(options.title, options.message, duration);
            case 'info':
            default: return sys.showInfo(options.title, options.message, duration);
          }
        },
        showConfirmation: (title: string, message: string, confirmLabel?: string, cancelLabel?: string, cb?: (c:boolean)=>void) => {
          const uid = Date.now();
          const id = sys.showWarning(title, `${message}<div class="notification-actions" style="margin-top:10px;display:flex;gap:8px;">\n            <button id="notification-cancel-${uid}" class="btn notification-action" style="flex:1;padding:6px 12px; background:#f6f8fa; border:1px solid #d0d7de; border-radius:6px;">${cancelLabel||'Cancel'}</button>\n            <button id="notification-confirm-${uid}" class="btn btn-primary notification-action" style="flex:1;padding:6px 12px; background:#2da44e; color:white; border:1px solid #2da44e; border-radius:6px;">${confirmLabel||'Confirm'}</button>\n          </div>`, 0);
          setTimeout(()=>{
            const confirmBtn = document.querySelector(`#notification-confirm-${uid}`) as HTMLElement | null;
            const cancelBtn = document.querySelector(`#notification-cancel-${uid}`) as HTMLElement | null;
            confirmBtn?.addEventListener('click', () => { cb?.(true); document.getElementById(id)?.remove(); });
            cancelBtn?.addEventListener('click', () => { cb?.(false); document.getElementById(id)?.remove(); });
          },100);
          return id;
        },
        showLoading: (title?: string, message?: string) => sys.loading ? sys.loading(title, message) : sys.showLoading(title||'Loading...', message||'' )
      };
      // eslint-disable-next-line no-console
      console.log('Legacy notification system compatibility layer (TS) initialized');
    }
    return true;
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => applyCompat());
  } else {
    applyCompat();
  }
})();
