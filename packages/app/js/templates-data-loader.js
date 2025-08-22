// Template data loader
// This script loads template data from the results directory index-data.js
// Only authenticated users can see template data
(function () {
  function loadTemplateData() {
    // Check if the user is authenticated using GitHubAuth
    if (window.GitHubAuth && window.GitHubAuth.isAuthenticated()) {
      console.log('[templates-data-loader] User is authenticated, loading template data');
      
      // Create a script element to load the index-data.js file
      const script = document.createElement('script');
      script.src = 'results/index-data.js'; // Relative path to the index-data.js file
      script.async = true;
      script.onload = function () {
        console.log('[templates-data-loader] Successfully loaded template data');
        // Dispatch an event to notify app.js that template data is ready
        document.dispatchEvent(new CustomEvent('template-data-loaded'));
      };
      script.onerror = function () {
        console.warn(
          '[templates-data-loader] Failed to load template data from results/index-data.js',
        );
        // Initialize empty array if data doesn't load
        window.templatesData = [];
        document.dispatchEvent(new CustomEvent('template-data-loaded'));
      };
      document.head.appendChild(script);
    } else {
      console.log('[templates-data-loader] User is not authenticated, not loading template data');
      // Initialize empty array since user is not authenticated
      window.templatesData = [];
      document.dispatchEvent(new CustomEvent('template-data-loaded'));
    }
  }

  // We need to delay loading until GitHubAuth is initialized
  function initializeLoader() {
    if (window.GitHubAuth) {
      loadTemplateData();
    } else {
      // Wait for GitHubAuth to be initialized
      console.log('[templates-data-loader] Waiting for GitHubAuth to be initialized');
      setTimeout(initializeLoader, 100);
    }
  }

  // Start initialization process
  initializeLoader();
})();
