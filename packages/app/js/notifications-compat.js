/**
 * Compatibility layer to maintain backward compatibility with the old notification system
 * This ensures both old and new notification systems can work together
 */

document.addEventListener('DOMContentLoaded', () => {
  // If our new NotificationSystem is available
  if (window.NotificationSystem) {
    // Create legacy aliases for the old notification system if it doesn't exist
    if (!window.Notifications) {
      window.Notifications = {
        // Map old methods to new methods
        info: (title, message, duration) =>
          window.NotificationSystem.showInfo(title, message, duration),
        success: (title, message, duration) =>
          window.NotificationSystem.showSuccess(title, message, duration),
        warning: (title, message, duration) =>
          window.NotificationSystem.showWarning(title, message, duration),
        error: (title, message, duration) =>
          window.NotificationSystem.showError(title, message, duration),

        // Legacy method aliases
        showInfo: (title, message, duration) =>
          window.NotificationSystem.showInfo(title, message, duration),
        showSuccess: (title, message, duration) =>
          window.NotificationSystem.showSuccess(title, message, duration),
        showWarning: (title, message, duration) =>
          window.NotificationSystem.showWarning(title, message, duration),
        showError: (title, message, duration) =>
          window.NotificationSystem.showError(title, message, duration),

        // Show method maps to info by default
        show: (options) => {
          const type = options.type || 'info';
          const duration = options.duration || 5000;

          switch (type) {
            case 'success':
              return window.NotificationSystem.showSuccess(
                options.title,
                options.message,
                duration,
              );
            case 'warning':
              return window.NotificationSystem.showWarning(
                options.title,
                options.message,
                duration,
              );
            case 'error':
              return window.NotificationSystem.showError(options.title, options.message, duration);
            case 'info':
            default:
              return window.NotificationSystem.showInfo(options.title, options.message, duration);
          }
        },

        // Confirmation dialog compatibility
        showConfirmation: (title, message, confirmLabel, cancelLabel, callback) => {
          const uid = Date.now();
          // Create confirm/cancel buttons that use our new notification system
          const notificationId = window.NotificationSystem.showWarning(
            title,
            `${message}<div class="notification-actions" style="margin-top: 10px; display: flex; gap: 8px;">
              <button id="notification-cancel-${uid}" class="btn notification-action" style="flex: 1; padding: 6px 12px; background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px;">${cancelLabel || 'Cancel'}</button>
              <button id="notification-confirm-${uid}" class="btn btn-primary notification-action" style="flex: 1; padding: 6px 12px; background: #2da44e; color: white; border: 1px solid #2da44e; border-radius: 6px;">${confirmLabel || 'Confirm'}</button>
            </div>`,
            0, // Do not auto-dismiss
          );

          // Wait for DOM to update, then add event listeners
          setTimeout(() => {
            const confirmBtn = document.querySelector(`#notification-confirm-${uid}`);
            const cancelBtn = document.querySelector(`#notification-cancel-${uid}`);

            if (confirmBtn) {
              confirmBtn.addEventListener('click', () => {
                if (callback) callback(true);
                // Close the notification
                document.getElementById(notificationId)?.remove();
              });
            }

            if (cancelBtn) {
              cancelBtn.addEventListener('click', () => {
                if (callback) callback(false);
                // Close the notification
                document.getElementById(notificationId)?.remove();
              });
            }
          }, 100);

          return notificationId;
        },

        // Loading notification compatibility
        showLoading: (title, message) => {
          const id = window.NotificationSystem.showInfo(
            `<i class="fas fa-spinner fa-spin"></i> ${title || 'Loading...'}`,
            message || '',
            0, // No auto-dismiss
          );

          return {
            id,
            update: (newTitle, newMessage) => {
              // Try to update the notification if it exists
              const notification = document.getElementById(id);
              if (notification) {
                const titleElem = notification.querySelector('.notification-title');
                const messageElem = notification.querySelector('.notification-message');

                if (titleElem && newTitle) {
                  titleElem.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${newTitle}`;
                }

                if (messageElem && newMessage !== undefined) {
                  messageElem.textContent = newMessage;
                }
              }
            },
            success: (successTitle, successMessage) => {
              window.NotificationSystem.showSuccess(
                successTitle || 'Success',
                successMessage || message || '',
                5000,
              );
              // Remove the loading notification
              document.getElementById(id)?.remove();
            },
            error: (errorTitle, errorMessage) => {
              window.NotificationSystem.showError(
                errorTitle || 'Error',
                errorMessage || message || '',
                5000,
              );
              // Remove the loading notification
              document.getElementById(id)?.remove();
            },
            close: () => {
              // Remove the notification
              document.getElementById(id)?.remove();
            },
          };
        },
      };

      console.log('Legacy notification system compatibility layer initialized');
    }
  }
});
