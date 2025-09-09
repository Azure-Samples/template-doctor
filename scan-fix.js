// Template Doctor Scan Fix
// Save this file to your local workspace then copy into the browser console

(function() {
  console.log('=== Template Doctor Scan Fix ===');
  
  // 1. Ensure GitHubClient and GitHubAuth are properly connected
  if (window.GitHubClient && window.GitHubAuth && typeof window.GitHubClient.auth !== 'object') {
    console.log('Fixing GitHubClient auth connection');
    window.GitHubClient.auth = window.GitHubAuth;
  }
  
  // 2. Ensure ForkWorkflow is properly initialized
  if (!window.ForkWorkflow) {
    console.log('Creating ForkWorkflow helper');
    window.ForkWorkflow = {
      ensureFork: async function(repoUrl) {
        try {
          if (!window.GitHubClient || !window.GitHubClient.auth?.isAuthenticated()) {
            return { skipped: 'not-authenticated' };
          }
          
          const gh = window.GitHubClient;
          const username = gh.auth.getUsername ? gh.auth.getUsername() : 'unknown-user';
          const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)(?:\.git)?/i);
          if (!match) return { error: 'invalid-repo-url' };
          
          const sourceOwner = match[1];
          const sourceRepo = match[2];
          
          if (username.toLowerCase() === sourceOwner.toLowerCase()) {
            return { alreadyOwner: true };
          }
          
          // Check if fork exists already
          try {
            const forkUrl = `https://api.github.com/repos/${username}/${sourceRepo}`;
            const headers = gh.auth.getAuthHeaders ? gh.auth.getAuthHeaders() : 
              { 'Authorization': `token ${gh.auth.getToken()}` };
            
            const resp = await fetch(forkUrl, { headers });
            if (resp.status === 200) {
              return { forkExists: true };
            }
          } catch(e) {
            console.error('Error checking for existing fork:', e);
          }
          
          // Prompt user to create fork
          if (!confirm(`You do not have a fork of ${sourceOwner}/${sourceRepo}. Create one now?`)) {
            return { userDeclined: true };
          }
          
          console.log('Creating fork for', sourceOwner, sourceRepo);
          
          // Try to use GitHubClient's fork method if available
          if (typeof gh.forkRepository === 'function') {
            try {
              await gh.forkRepository(sourceOwner, sourceRepo);
              document.dispatchEvent(new CustomEvent('fork-created', { 
                detail: { sourceOwner, sourceRepo, username } 
              }));
              return { forkCreated: true };
            } catch (e) {
              console.error('Failed to fork using GitHubClient:', e);
              return { error: 'fork-failed', details: e.message };
            }
          } else {
            return { error: 'fork-method-missing' };
          }
        } catch (e) {
          return { error: e?.message || String(e) };
        }
      }
    };
    
    // Add event listener for before-analysis
    document.addEventListener('before-analysis', async (e) => {
      try {
        const repoUrl = e?.detail?.repoUrl;
        if (!repoUrl) return;
        const res = await window.ForkWorkflow.ensureFork(repoUrl);
        if (res?.error) {
          console.warn('[fork-workflow] fork check error', res);
        }
      } catch(err) { 
        console.warn('[fork-workflow] handler error', err); 
      }
    });
  }
  
  // 3. Fix repo search click handling if broken
  const repoItems = document.querySelectorAll('.repo-item');
  repoItems.forEach(item => {
    if (!item.onclick) {
      item.style.cursor = 'pointer';
      item.addEventListener('click', function() {
        const repoName = this.querySelector('.repo-name')?.textContent;
        if (repoName) {
          console.log('Clicked on repo:', repoName);
          const repoUrl = `https://github.com/${repoName}`;
          // Trigger analysis if TemplateAnalyzer is available
          if (window.TemplateAnalyzer && typeof window.TemplateAnalyzer.analyzeTemplate === 'function') {
            console.log('Analyzing repo:', repoUrl);
            window.TemplateAnalyzer.analyzeTemplate(repoUrl)
              .then(result => {
                console.log('Analysis result:', result);
                // You would normally update the UI here with the result
              })
              .catch(err => {
                console.error('Analysis error:', err);
                alert('Error analyzing repository: ' + (err.message || String(err)));
              });
          } else {
            console.warn('TemplateAnalyzer not available');
            alert('Analysis functionality not available');
          }
        }
      });
    }
  });
  
  console.log('=== Template Doctor Scan Fix Complete ===');
})();