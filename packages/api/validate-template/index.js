const crypto = require('crypto');

module.exports = async function (context, req) {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    context.res = {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    };
    return;
  }
  
  try {
    const { targetRepoUrl, callbackUrl } = req.body || {};
    
    context.log('validate-template triggered with:');
    context.log(`targetRepoUrl: ${targetRepoUrl}`);
    context.log(`callbackUrl: ${callbackUrl || 'not provided'}`);
    
    if (!targetRepoUrl) {
      context.log.warn('Missing required parameter: targetRepoUrl');
      context.res = { 
        status: 400, 
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: { error: "targetRepoUrl is required" } 
      };
      return;
    }

    const runId = crypto.randomUUID();

    const owner = "Template-Doctor";
    const repo = "template-doctor";
    const workflowFile = "validate-template.yml";
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

    context.res = {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: { runId, message: "Workflow triggered successfully" }
    };
  } catch (err) {
    context.log.error("validate-template error:", err);
    context.res = { 
      status: 500, 
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: { error: err.message } 
    };
  }
}
