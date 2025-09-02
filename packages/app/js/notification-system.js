/**
 * NotificationSystem - A simple notification system for showing toast-style notifications
 *
 * This module provides functions to show success, error, warning, and info notifications
 * that appear at the top of the page and automatically disappear after a specified time.
 */

(function () {
  // Create a container for notifications if it doesn't exist
  let container = document.getElementById('notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-container';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.zIndex = '9999';
    container.style.width = '320px';
    document.body.appendChild(container);
  }

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .notification {
      margin-bottom: 10px;
      padding: 16px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: notification-slide-in 0.3s ease-out forwards;
      opacity: 0;
      transform: translateX(40px);
      transition: transform 0.3s ease-out, opacity 0.3s ease-out;
      color: #24292e;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      position: relative;
      font-size: 14px;
    }
    
    .notification.slide-out {
      animation: notification-slide-out 0.3s ease-in forwards;
    }
    
    @keyframes notification-slide-in {
      from {
        opacity: 0;
        transform: translateX(40px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    
    @keyframes notification-slide-out {
      from {
        opacity: 1;
        transform: translateX(0);
      }
      to {
        opacity: 0;
        transform: translateX(40px);
      }
    }
    
    .notification-icon {
      position: absolute;
      left: 16px;
      top: 17px;
      font-size: 16px;
    }
    
    .notification-close {
      position: absolute;
      top: 12px;
      right: 12px;
      cursor: pointer;
      font-size: 16px;
      opacity: 0.7;
      transition: opacity 0.2s ease;
      border: none;
      background: transparent;
      color: inherit;
    }
    
    .notification-close:hover {
      opacity: 1;
    }
    
    .notification-title {
      font-weight: 600;
      margin: 0 0 4px 0;
      padding-right: 20px;
    }
    
    .notification-message {
      margin: 0;
      opacity: 0.8;
    }
    
    .notification-content {
      margin-left: 26px;
    }
    
    .notification.success {
      background-color: #f0fff4;
      border-left: 4px solid #28a745;
    }
    
    .notification.success .notification-icon {
      color: #28a745;
    }
    
    .notification.error {
      background-color: #ffeef0;
      border-left: 4px solid #d73a49;
    }
    
    .notification.error .notification-icon {
      color: #d73a49;
    }
    
    .notification.warning {
      background-color: #fffbdd;
      border-left: 4px solid #b08800;
    }
    
    .notification.warning .notification-icon {
      color: #b08800;
    }
    
    .notification.info {
      background-color: #f1f8ff;
      border-left: 4px solid #0366d6;
    }
    
    .notification.info .notification-icon {
      color: #0366d6;
    }
    
    /* Progress bar for notification auto-dismiss */
    .notification-progress {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 3px;
      width: 100%;
      background-color: rgba(0, 0, 0, 0.1);
    }
    
    .notification-progress-bar {
      height: 100%;
      width: 0%;
      transition: width linear;
    }
    
    .notification.success .notification-progress-bar {
      background-color: #28a745;
    }
    
    .notification.error .notification-progress-bar {
      background-color: #d73a49;
    }
    
    .notification.warning .notification-progress-bar {
      background-color: #b08800;
    }
    
    .notification.info .notification-progress-bar {
      background-color: #0366d6;
    }
  `;
  document.head.appendChild(style);

  /**
   * Show a notification
   * @param {string} type - The type of notification (success, error, warning, info)
   * @param {string} title - The notification title
   * @param {string} message - The notification message
   * @param {number} duration - How long to show the notification in ms (0 for indefinite)
   * @returns {HTMLElement} The notification element
   */
  function showNotification(type, title, message, duration = 5000) {
    const notificationId = 'notification-' + Date.now();
    const notification = document.createElement('div');
    notification.id = notificationId;
    notification.className = `notification ${type}`;

    // Icon based on type
    let icon = '';
    switch (type) {
      case 'success':
        icon = '<i class="fas fa-check-circle notification-icon"></i>';
        break;
      case 'error':
        icon = '<i class="fas fa-times-circle notification-icon"></i>';
        break;
      case 'warning':
        icon = '<i class="fas fa-exclamation-triangle notification-icon"></i>';
        break;
      case 'info':
      default:
        icon = '<i class="fas fa-info-circle notification-icon"></i>';
        break;
    }

    notification.innerHTML = `
      ${icon}
      <button class="notification-close" aria-label="Close" onclick="document.getElementById('${notificationId}').remove()">
        <i class="fas fa-times"></i>
      </button>
      <div class="notification-content">
        <div class="notification-title">${title}</div>
        <p class="notification-message">${message}</p>
      </div>
      <div class="notification-progress">
        <div class="notification-progress-bar"></div>
      </div>
    `;

    container.prepend(notification);

    // Auto-dismiss after duration (if not 0)
    if (duration > 0) {
      const progressBar = notification.querySelector('.notification-progress-bar');
      progressBar.style.transition = `width ${duration}ms linear`;

      // Start progress bar animation
      setTimeout(() => {
        progressBar.style.width = '100%';
      }, 10);

      // Schedule removal
      setTimeout(() => {
        // Add slide-out animation
        if (document.getElementById(notificationId)) {
          notification.classList.add('slide-out');

          // Remove after animation completes
          setTimeout(() => {
            if (document.getElementById(notificationId)) {
              notification.remove();
            }
          }, 300);
        }
      }, duration);
    }

    return notification;
  }

  // Expose the notification API globally
  window.NotificationSystem = {
    /**
     * Show a success notification
     * @param {string} title - The notification title
     * @param {string} message - The notification message
     * @param {number} duration - How long to show the notification in ms
     */
    showSuccess: function (title, message, duration = 5000) {
      return showNotification('success', title, message, duration);
    },

    /**
     * Show an error notification
     * @param {string} title - The notification title
     * @param {string} message - The notification message
     * @param {number} duration - How long to show the notification in ms
     */
    showError: function (title, message, duration = 8000) {
      return showNotification('error', title, message, duration);
    },

    /**
     * Show a warning notification
     * @param {string} title - The notification title
     * @param {string} message - The notification message
     * @param {number} duration - How long to show the notification in ms
     */
    showWarning: function (title, message, duration = 7000) {
      return showNotification('warning', title, message, duration);
    },

    /**
     * Show an info notification
     * @param {string} title - The notification title
     * @param {string} message - The notification message
     * @param {number} duration - How long to show the notification in ms
     */
    showInfo: function (title, message, duration = 5000) {
      return showNotification('info', title, message, duration);
    },

    // Minimal confirm support to align with richer API used by tests
    // Provides a warning-style notification with inline actions.
    confirm: function (
      title,
      message,
      {
        confirmLabel = 'Confirm',
        cancelLabel = 'Cancel',
        onConfirm = () => {},
        onCancel = () => {},
      } = {},
    ) {
      const el = showNotification('warning', title, message, 0);
      // Build actions area inside content
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
          try {
            onCancel();
          } finally {
            el?.remove();
          }
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
          try {
            onConfirm();
          } finally {
            el?.remove();
          }
        });

        actionsDiv.appendChild(cancelBtn);
        actionsDiv.appendChild(confirmBtn);
        content.appendChild(actionsDiv);
      }
      return el?.id;
    },
  };
})();
