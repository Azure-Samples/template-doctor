import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { Octokit } from '@octokit/rest';

/**
 * issue-create (Azure Function v4 HTTP)
 * POST /v4/issue-create
 * Body: { owner, repo, title, body, labels?: string[], assignCopilot?: boolean }
 * Uses a server-side GitHub token (GH_WORKFLOW_TOKEN) to ensure labels then create an issue.
 * Returns: { issueNumber, htmlUrl, labelsEnsured: string[], labelsCreated: string[], copilotAssigned?: boolean }
 */
export async function issueCreateHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (request.method === 'OPTIONS') {
    return { status: 204, headers: corsHeaders };
  }
  if (request.method !== 'POST') {
    return { status: 405, headers: corsHeaders, jsonBody: { error: 'Method not allowed' } };
  }

  const token = process.env.GH_WORKFLOW_TOKEN;
  if (!token) {
    return { status: 500, headers: corsHeaders, jsonBody: { error: 'Server misconfiguration: missing GH_WORKFLOW_TOKEN' } };
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return { status: 400, headers: corsHeaders, jsonBody: { error: 'Invalid JSON body' } };
  }

  const { owner, repo, title, body: issueBody, labels = [], assignCopilot = false } = body || {};
  if (!owner || !repo || !title) {
    return { status: 400, headers: corsHeaders, jsonBody: { error: 'Missing required: owner, repo, title' } };
  }

  const octokit = new Octokit({ auth: token, userAgent: 'TemplateDoctorBackend' });

  // Ensure labels exist (idempotent)
  const created: string[] = [];
  const ensured: string[] = [];
  for (const label of labels) {
    if (!label || typeof label !== 'string') continue;
    try {
      // Octokit label fetch lives under issues.getLabel
      await (octokit as any).issues.getLabel({ owner, repo, name: label });
      ensured.push(label);
    } catch (err: any) {
      if (err?.status === 404) {
        try {
          const color = hashColor(label);
          await (octokit as any).issues.createLabel({ owner, repo, name: label, color });
          created.push(label);
          ensured.push(label);
        } catch (createErr) {
          context.log(`Failed to create label ${label}:`, createErr instanceof Error ? createErr.message : createErr);
        }
      } else {
        context.log(`Error ensuring label ${label}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  // Create issue
  let issueNumber: number | undefined;
  let issueUrl: string | undefined;
  try {
    const issueResp = await octokit.issues.create({ owner, repo, title, body: issueBody, labels: ensured });
    issueNumber = issueResp.data.number;
    issueUrl = issueResp.data.html_url;
  } catch (err: any) {
    context.log('Issue creation failed:', err?.message || err);
    return { status: 502, headers: corsHeaders, jsonBody: { error: 'Failed to create issue', details: err?.message } };
  }

  let copilotAssigned: boolean | undefined;
  if (assignCopilot && issueNumber) {
    try {
      // Heuristic: attempt to add github-copilot as assignee if present. If fails, ignore.
      await octokit.issues.addAssignees({ owner, repo, issue_number: issueNumber, assignees: ['github-copilot'] });
      copilotAssigned = true;
    } catch (err) {
      context.log('Copilot assignment skipped:', err instanceof Error ? err.message : err);
      copilotAssigned = false;
    }
  }

  return {
    status: 201,
    headers: corsHeaders,
    jsonBody: {
      issueNumber,
      htmlUrl: issueUrl,
      labelsEnsured: ensured,
      labelsCreated: created,
      copilotAssigned
    }
  };
}

function hashColor(input: string): string {
  // Simple hash to hex color (avoid leading # in GitHub API)
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  // Map hash to 24-bit color, ensure readable (avoid very dark)
  const r = (hash >> 16) & 0xff;
  const g = (hash >> 8) & 0xff;
  const b = hash & 0xff;
  const brighten = (c: number) => (c + 200) % 256; // push toward lighter palette
  return ((brighten(r) << 16) | (brighten(g) << 8) | brighten(b)).toString(16).padStart(6, '0');
}
