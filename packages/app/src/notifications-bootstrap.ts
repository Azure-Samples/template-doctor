// Provides a promise hook tests can await to guarantee the REAL notification system (not the guard stub).
// Real criteria: has showInfo/info AND is not the guard stub (which exposes __queue).
if(!(window as any).__notificationsReady){
  (window as any).__notificationsReady = new Promise(resolve => {
    const isReal = () => !!(window.NotificationSystem && typeof window.NotificationSystem.showInfo === 'function' && typeof (window as any).NotificationSystem.info === 'function' && !window.NotificationSystem.__queue);
    const attempt = () => { if(isReal()){ resolve(true); return true; } return false; };
    if(attempt()) return;
    const handler = () => attempt();
    document.addEventListener('notifications-ready', handler);
    const int = setInterval(()=>{ if(attempt()){ clearInterval(int); document.removeEventListener('notifications-ready', handler); } },50);
    setTimeout(()=>{ clearInterval(int); document.removeEventListener('notifications-ready', handler); attempt(); }, 8000);
  });
}
