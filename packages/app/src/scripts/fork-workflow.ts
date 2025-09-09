// @ts-nocheck
// Fork workflow reintegration (initial stub)
// Detects if user has a fork; if not, offers to create one before analysis.
(function(){
  if ((window as any).ForkWorkflow) return;
  const ForkWorkflow = {
    async ensureFork(repoUrl: string){
      try {
        if (!(window as any).GitHubClient || !(window as any).GitHubClient.auth?.isAuthenticated()) return { skipped: 'not-authenticated' };
        const gh = (window as any).GitHubClient;
        const username = gh.auth.getUsername();
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
          const resp = await fetch(forkUrl, { headers: gh.auth.getAuthHeaders() });
          if (resp.status === 200) {
            return { forkExists: true };
          }
        } catch(_){}
        // Prompt user to create fork
        if (!confirm(`You do not have a fork of ${sourceOwner}/${sourceRepo}. Create one now?`)) {
          return { userDeclined: true };
        }
        const cfg = (window as any).TemplateDoctorConfig || {};
        const apiBase = cfg.apiBase || window.location.origin;
        const endpoint = (window as any).ApiRoutes ? (window as any).ApiRoutes.build('repo-fork') : `${apiBase.replace(/\/$/,'')}/api/v4/repo-fork`;
        const body = { sourceOwner, sourceRepo, targetOwner: username, waitForReady: true };
        const resp = await fetch(endpoint, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, gh.auth.getAuthHeaders()), body: JSON.stringify(body) });
        if (!resp.ok) {
          const text = await resp.text();
          return { error: 'fork-failed', status: resp.status, body: text };
        }
        document.dispatchEvent(new CustomEvent('fork-created', { detail: { sourceOwner, sourceRepo, username } }));
        return { forkCreated: true };
      } catch (e){
        return { error: (e as any)?.message || String(e) };
      }
    }
  };
  (window as any).ForkWorkflow = ForkWorkflow;
  document.addEventListener('before-analysis', async (e: any) => {
    try {
      const repoUrl = e?.detail?.repoUrl;
      if (!repoUrl) return;
      const res = await ForkWorkflow.ensureFork(repoUrl);
      if (res?.error) {
        console.warn('[fork-workflow] fork check error', res);
      }
    } catch(err){ console.warn('[fork-workflow] handler error', err); }
  });
})();
export {};