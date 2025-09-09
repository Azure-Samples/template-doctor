// Initialize the NotificationSystem for the app

document.addEventListener('DOMContentLoaded', () => {
  // Prefer the richer Notifications implementation everywhere if present.
  if (window.Notifications) {
    window.NotificationSystem = window.Notifications;
    console.log('NotificationSystem bound to Notifications');
  }
});
