// Scan Mode Toggle functionality
// Handles toggling between single and batch scan modes

// Function to toggle between single and batch modes
function toggleScanMode(isBatchMode: boolean): void {
  console.log('[ScanMode] Toggling scan mode, isBatchMode:', isBatchMode);
  
  const singleModeLabel = document.getElementById('single-mode-label');
  const batchModeLabel = document.getElementById('batch-mode-label');
  const singleScanContainer = document.getElementById('single-scan-container');
  const batchUrlsContainer = document.getElementById('batch-urls-container');
  const searchResults = document.getElementById('search-results');
  const batchResults = document.getElementById('batch-results');
  
  if (!singleModeLabel || !batchModeLabel || !singleScanContainer || !batchUrlsContainer || !searchResults || !batchResults) {
    console.error('[ScanMode] Required DOM elements not found');
    return;
  }
  
  if (isBatchMode) {
    singleModeLabel.classList.remove('active');
    batchModeLabel.classList.add('active');
    singleScanContainer.style.display = 'none';
    batchUrlsContainer.style.display = 'block';
    searchResults.style.display = 'none';
    batchResults.style.display = 'block';
  } else {
    singleModeLabel.classList.add('active');
    batchModeLabel.classList.remove('active');
    singleScanContainer.style.display = 'flex';
    batchUrlsContainer.style.display = 'none';
    searchResults.style.display = 'block';
    batchResults.style.display = 'none';
  }
}

// Initialize the scan mode toggle
function init(): void {
  console.log('[ScanMode] Initializing scan mode toggle');
  
  const scanModeToggle = document.getElementById('scan-mode-toggle') as HTMLInputElement | null;
  
  if (!scanModeToggle) {
    console.error('[ScanMode] Scan mode toggle not found');
    return;
  }
  
  // Add event listener
  scanModeToggle.addEventListener('change', function() {
    toggleScanMode(this.checked);
  });
  
  // Initialize to correct state
  toggleScanMode(scanModeToggle.checked);
}

// Initialize when DOM is loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  queueMicrotask(init);
} else {
  document.addEventListener('DOMContentLoaded', init);
}

export { toggleScanMode };