// Notification System
// Creates toast-style notifications for user feedback

class NotificationSystem {
    constructor() {
        this.containerSelector = 'notification-container';
        this.notificationIdPrefix = 'notification-';
        this.defaultDuration = 6000; // 6 seconds
        this.notificationCount = 0;
        
        this.initContainer();

    // Note: global attachment is handled on DOMContentLoaded to avoid early access issues.
    }
    
    /**
     * Initialize the notification container
     */
    initContainer() {
        // Check if container already exists
        let container = document.querySelector(`.${this.containerSelector}`);
        
        if (!container) {
            container = document.createElement('div');
            container.className = this.containerSelector;
            document.body.appendChild(container);
            console.log('Notification container created');
        }
    }
    
    /**
     * Show a notification
     * @param {Object} options - Notification options
     * @param {string} options.title - Notification title
     * @param {string} options.message - Notification message
     * @param {string} options.type - Notification type (info, success, warning, error)
     * @param {number} options.duration - Duration in ms (0 for no auto-close)
     * @param {Array} options.actions - Array of action buttons {label, onClick, primary}
     * @returns {string} - Notification ID
     */
    show(options) {
        const { title, message, type = 'info', duration = this.defaultDuration, actions = [] } = options;
        const id = `${this.notificationIdPrefix}${++this.notificationCount}`;
        
        // Create notification element
        const notification = document.createElement('div');
        notification.id = id;
        notification.className = `notification ${type}`;
        
        // Add content
        notification.innerHTML = `
            <div class="notification-header">
                <h3 class="notification-title">
                    ${this.getIconForType(type)} ${title || this.getTitleForType(type)}
                </h3>
                <button class="notification-close" aria-label="Close notification">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            ${message ? `<div class="notification-content">${message}</div>` : ''}
            ${actions.length > 0 ? '<div class="notification-actions"></div>' : ''}
            <div class="notification-progress">
                <div class="notification-progress-bar"></div>
            </div>
        `;
        
        // Get container
        const container = document.querySelector(`.${this.containerSelector}`);
        container.appendChild(notification);
        
        // Add action buttons
        if (actions.length > 0) {
            const actionsContainer = notification.querySelector('.notification-actions');
            actions.forEach((action, index) => {
                const button = document.createElement('button');
                button.className = `notification-action ${action.primary ? 'primary' : 'secondary'}`;
                button.textContent = action.label;
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (action.onClick) {
                        action.onClick();
                    }
                });
                actionsContainer.appendChild(button);
            });
        }
        
        // Set up close button
        const closeButton = notification.querySelector('.notification-close');
        closeButton.addEventListener('click', () => {
            this.close(id);
        });
        
        // Show notification with animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Set progress bar animation
        if (duration > 0) {
            const progressBar = notification.querySelector('.notification-progress-bar');
            progressBar.style.transition = `width ${duration}ms linear`;
            
            setTimeout(() => {
                progressBar.style.width = '100%';
            }, 10);
            
            // Close after duration
            setTimeout(() => {
                this.close(id);
            }, duration);
        }
        
        return id;
    }
    
    /**
     * Close a notification
     * @param {string} id - Notification ID
     */
    close(id) {
        const notification = document.getElementById(id);
        if (notification) {
            notification.classList.remove('show');
            
            // Remove after animation
            setTimeout(() => {
                notification.remove();
            }, 500);
        }
    }
    
    /**
     * Update an existing notification
     * @param {string} id - Notification ID
     * @param {Object} options - Update options
     * @param {string} options.title - New title
     * @param {string} options.message - New message
     * @param {string} options.type - New type
     * @param {boolean} options.resetTimer - Whether to reset the timer
     * @param {Array} options.actions - New action buttons
     */
    update(id, options) {
        const notification = document.getElementById(id);
        if (!notification) return;
        
        const { title, message, type, resetTimer = false, actions = [] } = options;
        
        // Update type class
        if (type) {
            const classes = notification.className.split(' ').filter(c => !['info', 'success', 'warning', 'error'].includes(c));
            notification.className = [...classes, type].join(' ');
            
            // Update icon and title
            const titleElement = notification.querySelector('.notification-title');
            if (titleElement) {
                titleElement.innerHTML = `${this.getIconForType(type)} ${title || this.getTitleForType(type)}`;
            }
        }
        
        // Update title without changing type
        if (title && !type) {
            const titleElement = notification.querySelector('.notification-title');
            if (titleElement) {
                const icon = titleElement.innerHTML.split('</i>')[0] + '</i>';
                titleElement.innerHTML = `${icon} ${title}`;
            }
        }
        
        // Update message
        if (message !== undefined) {
            let contentElement = notification.querySelector('.notification-content');
            if (!contentElement && message) {
                contentElement = document.createElement('div');
                contentElement.className = 'notification-content';
                
                // Insert after header
                const header = notification.querySelector('.notification-header');
                header.insertAdjacentElement('afterend', contentElement);
            }
            
            if (contentElement) {
                if (message) {
                    contentElement.innerHTML = message;
                } else {
                    contentElement.remove();
                }
            }
        }
        
        // Reset timer
        if (resetTimer) {
            const progressBar = notification.querySelector('.notification-progress-bar');
            if (progressBar) {
                progressBar.style.transition = 'none';
                progressBar.style.width = '0%';
                
                setTimeout(() => {
                    progressBar.style.transition = 'width 6s linear';
                    progressBar.style.width = '100%';
                }, 10);
                
                // Close after duration
                setTimeout(() => {
                    this.close(id);
                }, this.defaultDuration);
            }
        }
        
        // Update actions
        if (actions.length > 0) {
            let actionsContainer = notification.querySelector('.notification-actions');
            
            // Create actions container if it doesn't exist
            if (!actionsContainer) {
                actionsContainer = document.createElement('div');
                actionsContainer.className = 'notification-actions';
                
                // Insert before progress bar
                const progressBar = notification.querySelector('.notification-progress');
                progressBar.insertAdjacentElement('beforebegin', actionsContainer);
            } else {
                // Clear existing actions
                actionsContainer.innerHTML = '';
            }
            
            // Add new actions
            actions.forEach((action) => {
                const button = document.createElement('button');
                button.className = `notification-action ${action.primary ? 'primary' : 'secondary'}`;
                button.textContent = action.label;
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (action.onClick) {
                        action.onClick();
                    }
                });
                actionsContainer.appendChild(button);
            });
        }
    }
    
    /**
     * Show an info notification
     * @param {string} title - Notification title
     * @param {string} message - Notification message
     * @param {number} duration - Duration in ms (0 for no auto-close)
     * @returns {string} - Notification ID
     */
    info(title, message, duration = this.defaultDuration) {
        return this.show({
            title,
            message,
            type: 'info',
            duration
        });
    }
    
    /**
     * Show a success notification
     * @param {string} title - Notification title
     * @param {string} message - Notification message
     * @param {number} duration - Duration in ms (0 for no auto-close)
     * @returns {string} - Notification ID
     */
    success(title, message, duration = this.defaultDuration) {
        return this.show({
            title,
            message,
            type: 'success',
            duration
        });
    }
    
    /**
     * Show a warning notification
     * @param {string} title - Notification title
     * @param {string} message - Notification message
     * @param {number} duration - Duration in ms (0 for no auto-close)
     * @returns {string} - Notification ID
     */
    warning(title, message, duration = this.defaultDuration) {
        return this.show({
            title,
            message,
            type: 'warning',
            duration
        });
    }
    
    /**
     * Show an error notification
     * @param {string} title - Notification title
     * @param {string} message - Notification message
     * @param {number} duration - Duration in ms (0 for no auto-close)
     * @returns {string} - Notification ID
     */
    error(title, message, duration = this.defaultDuration) {
        return this.show({
            title,
            message,
            type: 'error',
            duration
        });
    }

    // --- Back-compat wrappers (older code calls showX/Confirmation on window.NotificationSystem) ---
    showInfo(title, message, duration) {
        return this.info(title, message, duration);
    }
    showSuccess(title, message, duration) {
        return this.success(title, message, duration);
    }
    showWarning(title, message, duration) {
        return this.warning(title, message, duration);
    }
    showError(title, message, duration) {
        return this.error(title, message, duration);
    }
    showConfirmation(title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', callback) {
        return this.confirm(title, message, {
            confirmLabel,
            cancelLabel,
            onConfirm: () => callback && callback(true),
            onCancel: () => callback && callback(false)
        });
    }
    
    /**
     * Show a loading notification
     * @param {string} title - Notification title
     * @param {string} message - Notification message
     * @returns {Object} - Notification control object
     */
    loading(title = 'Loading...', message = '') {
        const id = this.show({
            title: `<span class="notification-spinner"></span> ${title}`,
            message,
            type: 'info',
            duration: 0 // No auto-close
        });
        
        // Return control functions
        return {
            id,
            // Update the loading notification
            update: (newTitle, newMessage) => {
                this.update(id, {
                    title: `<span class="notification-spinner"></span> ${newTitle || title}`,
                    message: newMessage !== undefined ? newMessage : message
                });
            },
            // Complete with success
            success: (successTitle, successMessage) => {
                this.update(id, {
                    title: successTitle || 'Success',
                    message: successMessage !== undefined ? successMessage : message,
                    type: 'success',
                    resetTimer: true
                });
            },
            // Complete with error
            error: (errorTitle, errorMessage) => {
                this.update(id, {
                    title: errorTitle || 'Error',
                    message: errorMessage !== undefined ? errorMessage : message,
                    type: 'error',
                    resetTimer: true
                });
            },
            // Close the notification
            close: () => {
                this.close(id);
            }
        };
    }
    
    /**
     * Show a confirmation dialog as a notification
     * @param {string} title - Dialog title
     * @param {string} message - Dialog message
     * @param {Object} options - Options
     * @param {string} options.confirmLabel - Confirm button label
     * @param {string} options.cancelLabel - Cancel button label
     * @param {Function} options.onConfirm - Confirm callback
     * @param {Function} options.onCancel - Cancel callback
     * @returns {string} - Notification ID
     */
    confirm(title, message, options = {}) {
        const {
            confirmLabel = 'Confirm',
            cancelLabel = 'Cancel',
            onConfirm = () => {},
            onCancel = () => {}
        } = options;
        
        const id = this.show({
            title,
            message,
            type: 'warning',
            duration: 0, // No auto-close
            actions: [
                {
                    label: cancelLabel,
                    onClick: () => {
                        onCancel();
                        this.close(id);
                    }
                },
                {
                    label: confirmLabel,
                    onClick: () => {
                        onConfirm();
                        this.close(id);
                    },
                    primary: true
                }
            ]
        });
        
        return id;
    }
    
    /**
     * Show a simplified confirmation dialog
     * @param {string} title - Dialog title
     * @param {string} message - Dialog message
     * @param {string} confirmLabel - Confirm button label
     * @param {string} cancelLabel - Cancel button label
     * @param {Function} callback - Callback function(confirmed)
     * @returns {string} - Notification ID
     */
    showConfirmation(title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', callback = () => {}) {
        return this.confirm(title, message, {
            confirmLabel,
            cancelLabel,
            onConfirm: () => callback(true),
            onCancel: () => callback(false)
        });
    }
    
    /**
     * Get the icon for a notification type
     * @param {string} type - Notification type
     * @returns {string} - Icon HTML
     */
    getIconForType(type) {
        switch (type) {
            case 'success':
                return '<i class="fas fa-check-circle"></i>';
            case 'warning':
                return '<i class="fas fa-exclamation-triangle"></i>';
            case 'error':
                return '<i class="fas fa-times-circle"></i>';
            case 'info':
            default:
                return '<i class="fas fa-info-circle"></i>';
        }
    }
    
    /**
     * Get the default title for a notification type
     * @param {string} type - Notification type
     * @returns {string} - Default title
     */
    getTitleForType(type) {
        switch (type) {
            case 'success':
                return 'Success';
            case 'warning':
                return 'Warning';
            case 'error':
                return 'Error';
            case 'info':
            default:
                return 'Information';
        }
    }
}

// Initialize the notification system when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Ensure a single instance and expose both modern and legacy globals
    if (!window.Notifications) {
        window.Notifications = new NotificationSystem();
        console.log('Notification system initialized');
    }
    // Legacy alias used by parts of the app
    if (!window.NotificationSystem) {
        window.NotificationSystem = window.Notifications;
    }
});
