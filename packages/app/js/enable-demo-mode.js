/**
 * Enable demo mode for Template Doctor
 * This script forces all GitHub workflow validations to run in demo mode
 * Add this script after app.js and before any page initialization
 */

(function() {
  // Store the original init method
  const originalInit = window.GitHubWorkflowValidation && window.GitHubWorkflowValidation.init;
  
  // Replace with a version that always enables demo mode
  if (window.GitHubWorkflowValidation) {
    window.GitHubWorkflowValidation.init = function(containerId, templateUrl, onStatusChange) {
      console.log('🎬 DEMO MODE ACTIVATED: Using simulated successful validation');
      return originalInit(containerId, templateUrl, onStatusChange, true);
    };
    
    console.log('✅ Template Doctor demo mode enabled');
  } else {
    console.warn('⚠️ GitHubWorkflowValidation not found - demo mode not enabled');
    // The component will be patched when it loads
    const checkInterval = setInterval(function() {
      if (window.GitHubWorkflowValidation) {
        const originalInit = window.GitHubWorkflowValidation.init;
        window.GitHubWorkflowValidation.init = function(containerId, templateUrl, onStatusChange) {
          console.log('🎬 DEMO MODE ACTIVATED: Using simulated successful validation');
          return originalInit(containerId, templateUrl, onStatusChange, true);
        };
        console.log('✅ Template Doctor demo mode enabled (delayed)');
        clearInterval(checkInterval);
      }
    }, 500);
  }
})();