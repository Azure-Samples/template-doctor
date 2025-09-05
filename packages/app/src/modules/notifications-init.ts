// Migrated from js/notifications-init.js

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if ((window as any).Notifications) {
      (window as any).NotificationSystem = (window as any).Notifications;
    }
  });
}
