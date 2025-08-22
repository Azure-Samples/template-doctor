// api/validation-status/index.js
export default async function (context, req) {
  try {
    const runId = req.query.runId;
    if (!runId) {
      context.res = { status: 400, body: { error: "runId is required" } };
      return;
    }

    const owner = "<YOUR_ORG_OR_USER>";
    const repo  = "<YOUR_REPO>";
    const workflowFile = "validate-template.yml";
    const token = process.env.GH_WORKFLOW_TOKEN;
    if (!token) throw new Error("Missing GH_WORKFLOW_TOKEN app setting");

    // List recent runs of just this workflow and find the one whose run_name == runId
    const listRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?per_page=30&event=workflow_dispatch`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      }
    );
    if (!listRes.ok) {
      const txt = await listRes.text().catch(() => "");
      throw new Error(`List runs failed: ${listRes.status} ${listRes.statusText} ${txt}`);
    }
    const data = await listRes.json();
    const run = (data.workflow_runs || []).find(r => (r.run_name || "") === runId);

    if (!run) {
      context.res = { status: 200, body: { status: "queued", message: "Run not visible yet" } };
      return;
    }

    const status = run.status;        // queued | in_progress | completed
    const conclusion = run.conclusion; // success | failure | neutral | cancelled | timed_out | action_required | null
    const runUrl = run.html_url;

    let mapped = "running";
    if (status === "completed") {
      mapped = "completed";
    } else if (status === "queued" || status === "in_progress") {
      mapped = "running";
    }

    context.res = {
      status: 200,
      body: {
        status: mapped,
        conclusion: conclusion || null,
        runUrl
      }
    };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 500, body: { error: err.message } };
  }
}
