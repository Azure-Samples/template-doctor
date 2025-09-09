// Diagnostic tool for Template Doctor
// Save this file to your local workspace then copy into the browser console

(function() {
  console.log('=== Template Doctor Diagnostics ===');
  
  // Check if templates data is loaded
  console.log('1. Templates Data:');
  console.log('   - window.templatesData exists:', window.templatesData !== undefined);
  console.log('   - window.templatesData is array:', Array.isArray(window.templatesData));
  console.log('   - templatesData length:', Array.isArray(window.templatesData) ? window.templatesData.length : 'N/A');
  
  // Check authentication state
  console.log('2. Authentication:');
  console.log('   - window.GitHubAuth exists:', window.GitHubAuth !== undefined);
  console.log('   - isAuthenticated method exists:', window.GitHubAuth && typeof window.GitHubAuth.isAuthenticated === 'function');
  console.log('   - Authentication state:', window.GitHubAuth && typeof window.GitHubAuth.isAuthenticated === 'function' ? window.GitHubAuth.isAuthenticated() : 'N/A');
  
  // Check CSS loading
  console.log('3. CSS Loading:');
  const stylesheets = Array.from(document.styleSheets || []);
  const dashboardCss = stylesheets.find(s => s.href && s.href.includes('dashboard.css'));
  console.log('   - dashboard.css loaded:', dashboardCss !== undefined);
  
  // Check for browser console errors
  console.log('4. Check browser console for any JavaScript errors');
  
  // Attempt to fix templatesData if missing
  if (!window.templatesData || !Array.isArray(window.templatesData)) {
    console.log('5. Attempting to fix templatesData:');
    window.templatesData = window.templatesData || [];
    if (!Array.isArray(window.templatesData)) {
      window.templatesData = [];
      console.log('   - Created empty templatesData array');
    }
  }
  
  // Check if the search function works
  console.log('6. Search Functionality:');
  console.log('   - search-button exists:', document.getElementById('search-button') !== null);
  console.log('   - repo-search exists:', document.getElementById('repo-search') !== null);
  
  // Check if the results directory is properly accessible
  console.log('7. Results Directory:');
  fetch('results/index-data.js')
    .then(response => {
      console.log('   - index-data.js accessible:', response.ok, 'status:', response.status);
      return response.text();
    })
    .then(text => {
      console.log('   - index-data.js size:', text.length, 'bytes');
    })
    .catch(err => {
      console.log('   - index-data.js fetch error:', err.message);
    });
    
  // Force load templates data
  console.log('8. Forcing templatesData reload:');
  if (window.TemplateDataLoader && typeof window.TemplateDataLoader.forceReload === 'function') {
    window.TemplateDataLoader.forceReload();
    console.log('   - Called TemplateDataLoader.forceReload()');
  } else {
    console.log('   - TemplateDataLoader.forceReload not available');
    // Create a script element to load index-data.js
    const script = document.createElement('script');
    script.src = 'results/index-data.js';
    script.onload = () => console.log('   - Manually loaded index-data.js');
    script.onerror = () => console.log('   - Failed to manually load index-data.js');
    document.head.appendChild(script);
  }
  
  // Check for GitHub token
  console.log('9. GitHub Token:');
  console.log('   - Token exists:', window.GitHubAuth && typeof window.GitHubAuth.getToken === 'function' && !!window.GitHubAuth.getToken());
  
  console.log('=== End of Diagnostics ===');
  console.log('Copy the results and share them to help diagnose your issue');
})();