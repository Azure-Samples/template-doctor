// Migrated GitHub Action dispatch hook (from legacy js/github-action-hook.js)
// Exposes window.submitAnalysisToGitHub(result, username) for dashboard renderer & other callers.

interface ComplianceLike {
  compliant: { id: string; details?: any }[];
  issues: any[];
}
interface AnalysisResultLike {
  repoUrl: string;
  ruleSet?: string;
  timestamp?: string;
  compliance: ComplianceLike;
  [k: string]: any; // allow extra fields
}

declare global {
  interface Window {
    submitAnalysisToGitHub?: (result: AnalysisResultLike, username: string) => Promise<any>;
    TemplateDoctorConfig?: any;
    ApiRoutes?: { build: (name: string) => string };
    GitHubClient?: any;
  }
}

function debug(tag: string, message: string, data?: any) {
  try {
    // Support legacy debug function if present
    if ((window as any).debug) {
      (window as any).debug(tag, message, data);
    } else {
      // eslint-disable-next-line no-console
      console.log(`[${tag}] ${message}`, data || '');
    }
  } catch {
    // swallow
  }
}

async function submitAnalysisToGitHub(result: AnalysisResultLike, username: string) {
  if (!result || !username) {
    console.error('[github-action-hook] Missing result or username');
    return { success: false, error: 'Missing parameters' };
  }
  try {
    const cfg = window.TemplateDoctorConfig || {};
    let archiveEnabled = !!cfg.archiveEnabled;
    const hasOverride = Object.prototype.hasOwnProperty.call(cfg, 'nextAnalysisArchiveEnabledOverride');
    if (!archiveEnabled && hasOverride) {
      archiveEnabled = !!cfg.nextAnalysisArchiveEnabledOverride;
      delete cfg.nextAnalysisArchiveEnabledOverride;
      window.TemplateDoctorConfig = cfg; // persist mutation
    }
    const archiveCollection = cfg.archiveCollection || 'aigallery';
    const targetRepo = cfg.dispatchTargetRepo || '';
    const summaryObj = result.compliance?.compliant?.find?.((c: any) => c.id === 'compliance-summary');
    const percentage = summaryObj?.details?.percentageCompliant || 0;
    const payload = {
      repoUrl: result.repoUrl,
      ruleSet: result.ruleSet,
      username,
      timestamp: result.timestamp,
      analysisData: result,
      archiveEnabled,
      archiveCollection,
      ...(targetRepo ? { targetRepo } : {}),
      compliance: {
        percentage,
        passed: result.compliance?.compliant?.length || 0,
        issues: result.compliance?.issues?.length || 0,
      },
    };
    const useServerSide = cfg.analysis?.useServerSide === true && cfg.analysis?.serverSideDispatch === true;
    if (useServerSide) {
      debug('github-action-hook', 'Using server-side dispatch API');
    }
    const apiBase = cfg.apiBase || window.location.origin;
    const serverUrl = window.ApiRoutes
      ? window.ApiRoutes.build('submit-analysis-dispatch')
      : `${apiBase.replace(/\/$/, '')}/api/v4/submit-analysis-dispatch`;
    debug('github-action-hook', `Submitting via server endpoint: ${serverUrl}`);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cfg.functionKey) headers['x-functions-key'] = cfg.functionKey;
    const ghAuth = window.GitHubClient?.auth;
    if (ghAuth?.isAuthenticated?.()) {
      try {
        const token = ghAuth.getToken?.();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } catch {}
    }
    const response = await fetch(serverUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event_type: 'template-analysis-completed',
        client_payload: payload,
        useDirectIssueCreation: useServerSide,
      }),
    });
    debug('github-action-hook', `Server dispatch response status: ${response.status}`);
    if (!response.ok) {
      const errorData = await response.text().catch(() => '');
      if (response.status === 404)
        throw new Error('Endpoint not found (404). Check submit-analysis-dispatch function deployment.');
      if (response.status === 401)
        throw new Error('Unauthorized (401). Missing or invalid function key.');
      if (response.status === 403)
        throw new Error(
          'Permission denied (403). Server token may lack scopes or org SSO approval for GH_WORKFLOW_TOKEN.',
        );
      throw new Error(`Server error (${response.status}): ${errorData || 'Unknown error'}`);
    }
    return { success: true, message: 'Analysis submitted successfully' };
  } catch (error: any) {
    console.error('[github-action-hook] Error submitting analysis:', error);
    return { success: false, error: error?.message || String(error) };
  }
}

// Expose globally (legacy API surface expected by dashboard-renderer)
window.submitAnalysisToGitHub = submitAnalysisToGitHub;

export {}; // Ensure module scope
