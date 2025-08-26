// Template data loader
// This script loads template data from the results directory index-data.js
// Only authenticated users can see template data
(function () {
  function loadTemplateData() {
    // Check if the user is authenticated using GitHubAuth
    console.log('[templates-data-loader] Checking authentication status:', 
                window.GitHubAuth ? 'GitHubAuth exists' : 'GitHubAuth missing',
                window.GitHubAuth?.isAuthenticated ? 'isAuthenticated method exists' : 'isAuthenticated method missing',
                window.GitHubAuth?.isAuthenticated ? 'Auth state: ' + window.GitHubAuth.isAuthenticated() : 'Cannot check auth state');
    
    if (window.GitHubAuth && window.GitHubAuth.isAuthenticated && window.GitHubAuth.isAuthenticated()) {
      console.log('[templates-data-loader] User is authenticated, loading template data');
      
      // Create a script element to load the index-data.js file
      const script = document.createElement('script');
      script.src = 'results/index-data.js'; // Relative path to the index-data.js file
      script.async = true;
      script.onload = function () {
        console.log('[templates-data-loader] Successfully loaded template data');
        // Check if the data was actually loaded
        if (window.templatesData && Array.isArray(window.templatesData)) {
          console.log('[templates-data-loader] Loaded templatesData with', window.templatesData.length, 'entries');
        } else {
          console.warn('[templates-data-loader] templatesData is not available or not an array after loading');
          window.templatesData = [];
        }
        // Dispatch an event to notify app.js that template data is ready
        document.dispatchEvent(new CustomEvent('template-data-loaded'));
      };
      script.onerror = function (error) {
        console.warn(
          '[templates-data-loader] Failed to load template data from results/index-data.js',
          error
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
    console.log('[templates-data-loader] Checking if GitHubAuth is initialized');
    if (window.GitHubAuth) {
      console.log('[templates-data-loader] GitHubAuth found, loading template data');
      loadTemplateData();
    } else {
      // Wait for GitHubAuth to be initialized
      console.log('[templates-data-loader] Waiting for GitHubAuth to be initialized');
      setTimeout(initializeLoader, 100);
    }
  }

  // Listen for auth-state-changed events
  document.addEventListener('auth-state-changed', function(e) {
    console.log('[templates-data-loader] Received auth-state-changed event:', e.detail);
    if (e.detail && e.detail.authenticated) {
      console.log('[templates-data-loader] Auth state changed to authenticated, loading template data');
      loadTemplateData();
    }
  });

  // Start initialization process
  initializeLoader();
})();
