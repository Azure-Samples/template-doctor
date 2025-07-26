// Template data loader
// This script loads template data from the results directory index-data.js
(function() {
    function loadTemplateData() {
        // Create a script element to load the index-data.js file
        const script = document.createElement('script');
        script.src = 'results/index-data.js'; // Relative path to the index-data.js file
        script.async = true;
        script.onload = function() {
            console.log('[templates-data-loader] Successfully loaded template data');
            // Dispatch an event to notify app.js that template data is ready
            document.dispatchEvent(new CustomEvent('template-data-loaded'));
        };
        script.onerror = function() {
            console.warn('[templates-data-loader] Failed to load template data from results/index-data.js');
            // Initialize empty array if data doesn't load
            window.templatesData = [];
            document.dispatchEvent(new CustomEvent('template-data-loaded'));
        };
        document.head.appendChild(script);
    }

    // Call immediately when script is loaded
    loadTemplateData();
})();
