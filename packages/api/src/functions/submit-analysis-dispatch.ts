import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

interface DispatchRequest {
  event_type: string;
  client_payload: {
    targetRepo?: string;
    repoSlug?: string;
    [key: string]: any;
  };
}

export async function submitAnalysisDispatchHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-functions-key'
  };

  if (request.method === 'OPTIONS') {
    return { status: 204, headers };
  }

  try {
    const token = process.env.GH_WORKFLOW_TOKEN;
    if (!token) {
      return { 
        status: 500, 
        headers, 
        jsonBody: { error: 'Server misconfiguration: GH_WORKFLOW_TOKEN missing' } 
      };
    }

    // Parse request body
    const body = await request.json() as DispatchRequest;

    // Determine target repository slug (owner/repo)
    // IMPORTANT: The dispatch must hit the repository that contains the workflow.
    // We DO NOT infer from repoUrl by default (that's the analyzed repo, not the workflow host).
    // Precedence:
    // 1) Explicit override in payload: client_payload.targetRepo or client_payload.repoSlug (owner/repo)
    // 2) Environment: GH_TARGET_REPO, then GITHUB_REPOSITORY (provided by Actions runtime)
    // 3) Default: Template-Doctor/template-doctor
    const cp = body.client_payload || {};
    const fromPayload = (typeof cp.targetRepo === 'string' && cp.targetRepo) || (typeof cp.repoSlug === 'string' && cp.repoSlug) || '';
    let repoSlug = fromPayload || process.env.GH_TARGET_REPO || process.env.GITHUB_REPOSITORY || 'Template-Doctor/template-doctor';
    // Defensive fallback in case something went wrong above
    if (typeof repoSlug !== 'string' || !repoSlug.includes('/')) {
      repoSlug = 'Template-Doctor/template-doctor';
    }
    context.log(`[submit-analysis-dispatch] Dispatching event '${body.event_type}' to repo '${repoSlug}'`);
    const apiUrl = `https://api.github.com/repos/${repoSlug}/dispatches`;

    if (!body.event_type || !body.client_payload) {
      return { 
        status: 400, 
        headers, 
        jsonBody: { error: 'Missing event_type or client_payload' } 
      };
    }

    const ghRes = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event_type: body.event_type,
        client_payload: body.client_payload
      })
    });

    if (!ghRes.ok) {
      const text = await ghRes.text();
      return { 
        status: ghRes.status, 
        headers, 
        jsonBody: { error: 'GitHub dispatch failed', status: ghRes.status, details: text } 
      };
    }

    // Add debug header so we can verify which repoSlug was used
    const debugHeaders = { ...headers, 'x-template-doctor-repo-slug': repoSlug };
    return { status: 204, headers: debugHeaders };
  } catch (e: any) {
    return { 
      status: 500, 
      headers, 
      jsonBody: { error: e.message } 
    };
  }
}

// registration moved to barrel index.ts