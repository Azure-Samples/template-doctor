// Initialize the NotificationSystem for the app

document.addEventListener('DOMContentLoaded', () => {
    // Create a notification system if it doesn't exist
    if (!window.NotificationSystem) {
        // Check if we have the Notifications class available
        if (window.Notifications) {
            // Create a wrapper around the existing Notifications class
            window.NotificationSystem = {
                showInfo: (title, message, duration) => window.Notifications.info(title, message, duration),
                showSuccess: (title, message, duration) => window.Notifications.success(title, message, duration),
                showWarning: (title, message, duration) => window.Notifications.warning(title, message, duration),
                showError: (title, message, duration) => window.Notifications.error(title, message, duration),
                showLoading: (title, message) => window.Notifications.loading(title, message),
                showConfirmation: (title, message, confirmLabel, cancelLabel, callback) => 
                    window.Notifications.showConfirmation(title, message, confirmLabel, cancelLabel, callback)
            };
            console.log('NotificationSystem initialized with Notifications class');
        } else {
            // Create a simple notification system as fallback
            console.warn('Notifications class not available, creating fallback NotificationSystem');
            
            // Simple notification function using alert
            const showNotification = (title, message, type) => {
                console.log(`[${type}] ${title}: ${message}`);
                alert(`${title}\n\n${message}`);
            };
            
            // Create fallback notification system
            window.NotificationSystem = {
                showInfo: (title, message) => showNotification(title, message, 'INFO'),
                showSuccess: (title, message) => showNotification(title, message, 'SUCCESS'),
                showWarning: (title, message) => showNotification(title, message, 'WARNING'),
                showError: (title, message) => showNotification(title, message, 'ERROR'),
                showLoading: (title, message) => {
                    showNotification(title, message, 'LOADING');
                    return {
                        update: (newTitle, newMessage) => showNotification(newTitle || title, newMessage || message, 'LOADING'),
                        success: (successTitle, successMessage) => showNotification(successTitle || 'Success', successMessage || message, 'SUCCESS'),
                        error: (errorTitle, errorMessage) => showNotification(errorTitle || 'Error', errorMessage || message, 'ERROR'),
                        close: () => {}
                    };
                },
                showConfirmation: (title, message, confirmLabel, cancelLabel, callback) => {
                    const result = confirm(`${title}\n\n${message}\n\n(${confirmLabel} / ${cancelLabel})`);
                    if (callback) {
                        callback(result);
                    }
                    return result;
                }
            };
        }
    }
});
