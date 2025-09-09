// Template Doctor Data Diagnostics
// Save this file to your local workspace then copy into the browser console

(function() {
  console.log('=== Template Doctor Data Diagnostics ===');
  
  // Check if templatesData is available
  console.log('window.templatesData:', typeof window.templatesData, 
    window.templatesData ? `(${Object.keys(window.templatesData).length} templates)` : '');
  
  // Check if authentication is available
  console.log('GitHubAuth available:', !!window.GitHubAuth);
  console.log('GitHubClient available:', !!window.GitHubClient);
  if (window.GitHubAuth) {
    console.log('Authenticated:', window.GitHubAuth.isAuthenticated ? window.GitHubAuth.isAuthenticated() : 'unknown');
    console.log('Username:', window.GitHubAuth.getUsername ? window.GitHubAuth.getUsername() : 'unknown');
  }
  
  // Check if index-data.js is loaded
  const indexDataScript = document.querySelector('script[src*="index-data.js"]');
  console.log('index-data.js script found:', !!indexDataScript);
  
  // Check if TemplateAnalyzer is available
  console.log('TemplateAnalyzer available:', !!window.TemplateAnalyzer);
  
  // Check if ForkWorkflow is available
  console.log('ForkWorkflow available:', !!window.ForkWorkflow);
  
  // Check CSS loading
  const dashboardCss = document.querySelector('link[href*="dashboard.css"]');
  console.log('dashboard.css link found:', !!dashboardCss);
  if (dashboardCss) {
    // Try to load the CSS file and check if it's available
    fetch(dashboardCss.href)
      .then(response => {
        console.log('dashboard.css HTTP status:', response.status);
        return response.text();
      })
      .then(text => {
        console.log('dashboard.css content length:', text.length);
      })
      .catch(err => {
        console.error('Error fetching dashboard.css:', err);
      });
  }
  
  // Check for any errors that might have occurred during loading
  console.log('Page loading errors:', window.__templateDoctorErrors || 'none');
  
  // List all scripts on the page
  console.log('Loaded scripts:');
  document.querySelectorAll('script').forEach((script, i) => {
    console.log(`  ${i+1}. ${script.src || '(inline script)'}`);
  });
  
  // List all stylesheets on the page
  console.log('Loaded stylesheets:');
  document.querySelectorAll('link[rel="stylesheet"]').forEach((link, i) => {
    console.log(`  ${i+1}. ${link.href}`);
  });
  
  // Try to fetch index-data.js content if not loaded
  if (!window.templatesData && !indexDataScript) {
    console.log('Attempting to load index-data.js...');
    const script = document.createElement('script');
    script.src = '/results/index-data.js';
    script.onload = () => {
      console.log('index-data.js loaded, templatesData:', 
        typeof window.templatesData, 
        window.templatesData ? `(${Object.keys(window.templatesData).length} templates)` : '');
    };
    script.onerror = (e) => {
      console.error('Failed to load index-data.js', e);
    };
    document.head.appendChild(script);
  }
  
  console.log('=== Template Doctor Data Diagnostics Complete ===');
})();