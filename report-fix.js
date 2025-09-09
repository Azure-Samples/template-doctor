// Template Doctor Report Styling Fix
// Save this file to your local workspace then copy into the browser console when viewing a report

(function() {
  console.log('=== Template Doctor Report Styling Fix ===');
  
  // 1. Check if dashboard CSS is loaded and add it if missing
  const stylesheets = Array.from(document.styleSheets || []);
  const dashboardCss = stylesheets.find(s => s.href && s.href.includes('dashboard.css'));
  if (!dashboardCss) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '../css/dashboard.css';
    document.head.appendChild(link);
    console.log('Injected dashboard.css');
  }
  
  // 2. Add other missing styles if needed
  const missingStyles = ['templates.css', 'tooltips.css', 'notifications.css', 'modal.css'];
  for (const style of missingStyles) {
    const hasStyle = stylesheets.some(s => s.href && s.href.includes(style));
    if (!hasStyle) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `../css/${style}`;
      document.head.appendChild(link);
      console.log(`Injected ${style}`);
    }
  }
  
  // 3. Fix broken tile buttons
  const tileButtons = document.querySelectorAll('.action-tile button, .repo-item');
  tileButtons.forEach(button => {
    if (!button.onclick) {
      button.style.cursor = 'pointer';
      button.addEventListener('click', function() {
        console.log('Button clicked:', this.textContent);
        // You can add specific logic here if needed
      });
    }
  });
  
  // 4. General report styling fixes
  const styleFixElement = document.createElement('style');
  styleFixElement.textContent = `
    /* General dashboard fixes */
    .dashboard-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .compliance-summary {
      background: white;
      border-radius: 5px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    .issues-section, .compliance-section {
      background: white;
      border-radius: 5px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    .issue-item, .compliance-item {
      padding: 15px;
      border-bottom: 1px solid #eee;
      transition: background-color 0.2s;
    }
    
    .issue-item:hover, .compliance-item:hover {
      background-color: #f9f9f9;
    }
    
    .issue-severity-error {
      border-left: 4px solid #dc3545;
    }
    
    .issue-severity-warning {
      border-left: 4px solid #ffc107;
    }
    
    .action-button {
      padding: 8px 16px;
      border-radius: 4px;
      font-weight: 500;
      cursor: pointer;
      margin-right: 10px;
      transition: all 0.2s;
    }
    
    .primary-button {
      background-color: #0078d4;
      color: white;
      border: none;
    }
    
    .primary-button:hover {
      background-color: #106ebe;
    }
    
    .secondary-button {
      background-color: #f3f3f3;
      color: #333;
      border: 1px solid #ddd;
    }
    
    .secondary-button:hover {
      background-color: #e6e6e6;
    }
  `;
  document.head.appendChild(styleFixElement);
  
  console.log('=== Template Doctor Report Styling Fix Complete ===');
})();