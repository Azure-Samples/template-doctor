import { randomUUID } from 'crypto';

export default async function (context, req) {
  try {
    const templateUrl = req.body?.templateUrl;
    if (!templateUrl) {
      context.res = { status: 400, body: { error: "templateUrl is required" } };
      return;
    }

    const owner = "Template-Doctor";
    const repo = "template-doctor";
    const workflowFile = "validate-template.yml";
    const token = process.env.GH_WORKFLOW_TOKEN;
    if (!token) throw new Error("Missing GH_WORKFLOW_TOKEN app setting");

    const runId = randomUUID(); // generate unique ID for this run
    const callbackUrl = req.body?.callbackUrl || "";

    // Trigger the workflow via GitHub API
    const triggerRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ref: "main",
          inputs: {
            target_validate_template_url: templateUrl,
            run_id: runId,
            callback_url: callbackUrl,
            customValidators: "azd-provision,ps-rule"
          }
        })
      }
    );

    if (!triggerRes.ok) {
      const txt = await triggerRes.text().catch(() => "");
      throw new Error(`Failed to trigger workflow: ${triggerRes.status} ${triggerRes.statusText} ${txt}`);
    }

    context.res = {
      status: 200,
      body: {
        message: "Workflow triggered successfully",
        runId
      }
    };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 500, body: { error: err.message } };
  }
}
