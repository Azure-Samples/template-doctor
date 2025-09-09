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
  
  // Use direct style manipulation for instant response
  if (isBatchMode) {
    // Update labels
    singleModeLabel.classList.remove('active');
    batchModeLabel.classList.add('active');
    
    // Update containers - using direct style changes for immediacy
    singleScanContainer.style.display = 'none';
    batchUrlsContainer.style.display = 'block';
    searchResults.style.display = 'none';
    batchResults.style.display = 'block';
    
    // Force repaint to improve perceived responsiveness
    void batchUrlsContainer.offsetHeight;
  } else {
    // Update labels
    singleModeLabel.classList.add('active');
    batchModeLabel.classList.remove('active');
    
    // Update containers - using direct style changes for immediacy
    singleScanContainer.style.display = 'flex';
    batchUrlsContainer.style.display = 'none';
    searchResults.style.display = 'block';
    batchResults.style.display = 'none';
    
    // Force repaint to improve perceived responsiveness
    void singleScanContainer.offsetHeight;
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
  
  // Add event listener - use input event for faster response
  scanModeToggle.addEventListener('change', function() {
    // Apply the change immediately
    requestAnimationFrame(() => {
      toggleScanMode(this.checked);
    });
  });
  
  // Also handle clicks on the labels for better UX
  document.getElementById('single-mode-label')?.addEventListener('click', () => {
    if (scanModeToggle.checked) {
      scanModeToggle.checked = false;
      toggleScanMode(false);
    }
  });
  
  document.getElementById('batch-mode-label')?.addEventListener('click', () => {
    if (!scanModeToggle.checked) {
      scanModeToggle.checked = true;
      toggleScanMode(true);
    }
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