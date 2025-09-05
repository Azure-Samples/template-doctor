import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import crypto from 'crypto';

export async function validationTemplateHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    };
  }
  
  try {
    const body = await request.json() as { targetRepoUrl: string; callbackUrl?: string };
    const { targetRepoUrl, callbackUrl } = body || {};
    
    context.log('validate-template triggered with:');
    context.log(`targetRepoUrl: ${targetRepoUrl}`);
    context.log(`callbackUrl: ${callbackUrl || 'not provided'}`);
    
    if (!targetRepoUrl) {
      context.log('Missing required parameter: targetRepoUrl');
      return { 
        status: 400, 
        headers: { 'Access-Control-Allow-Origin': '*' },
        jsonBody: { error: "targetRepoUrl is required" } 
      };
    }

    const runId = crypto.randomUUID();

    const owner = "Template-Doctor";
    const repo = "template-doctor";
    const workflowFile = "validation-template.yml";
    const token = process.env.GH_WORKFLOW_TOKEN;
    if (!token) throw new Error("Missing GH_WORKFLOW_TOKEN app setting");

    const ghUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`;

    const payload = {
      ref: "main",
      inputs: {
        target_validate_template_url: targetRepoUrl,
        callback_url: callbackUrl || "",
        run_id: runId,
        customValidators: "azd-up,azd-down"  // Only run azd-up and azd-down validators
      }
    };

    context.log("Dispatching workflow", ghUrl, payload);

    const dispatchRes = await fetch(ghUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!dispatchRes.ok) {
      const errText = await dispatchRes.text();
      throw new Error(`GitHub dispatch failed: ${dispatchRes.status} ${dispatchRes.statusText} - ${errText}`);
    }

    return {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      jsonBody: { runId, message: "Workflow triggered successfully" }
    };
  } catch (err: any) {
    context.log("validate-template error:", err);
    return { 
      status: 500, 
      headers: { 'Access-Control-Allow-Origin': '*' },
      jsonBody: { error: err.message } 
    };
  }
}

// registration moved to barrel index.ts