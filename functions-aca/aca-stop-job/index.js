const { DefaultAzureCredential, ManagedIdentityCredential } = require('@azure/identity');
const { ContainerAppsAPIClient } = require('@azure/arm-appcontainers');

const SUBSCRIPTION_ID = process.env.AZURE_SUBSCRIPTION_ID;
const RESOURCE_GROUP = process.env.ACA_RESOURCE_GROUP;
const JOB_NAME = process.env.ACA_JOB_NAME;

function getCredential() {
  const clientId = process.env.AZURE_CLIENT_ID;
  if (clientId) return new ManagedIdentityCredential(clientId);
  return new DefaultAzureCredential();
}

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: corsHeaders() };
    return;
  }

  try {
    if (!SUBSCRIPTION_ID || !RESOURCE_GROUP || !JOB_NAME) {
      context.res = { status: 500, headers: corsHeaders(), body: { error: 'Missing ACA env. Set AZURE_SUBSCRIPTION_ID, ACA_RESOURCE_GROUP, ACA_JOB_NAME.' } };
      return;
    }

    const { executionName } = req.body || {};
    if (!executionName) {
      context.res = { status: 400, headers: corsHeaders(), body: { error: 'executionName required' } };
      return;
    }

    const credential = getCredential();
    const client = new ContainerAppsAPIClient(credential, SUBSCRIPTION_ID);

    // Try to stop/cancel the execution if API supports it. If not, best-effort mark.
    let stopped = false;
    try {
      if (typeof client.jobs.cancelExecution === 'function') {
        await client.jobs.cancelExecution(RESOURCE_GROUP, JOB_NAME, executionName);
        stopped = true;
      } else if (typeof client.jobs.beginStop === 'function') {
        await client.jobs.beginStop(RESOURCE_GROUP, JOB_NAME);
        stopped = true;
      }
    } catch (e) {
      context.log.warn('stop-job: cancel/stop not supported or failed', e?.message || e);
    }

    context.res = { status: 202, headers: corsHeaders(), body: { executionName, stopped } };
  } catch (err) {
    context.res = { status: 500, headers: corsHeaders(), body: { error: err.message } };
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}
