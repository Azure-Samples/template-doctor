const { DefaultAzureCredential, ManagedIdentityCredential } = require('@azure/identity');
const { ContainerAppsAPIClient } = require('@azure/arm-appcontainers');
const { LogsQueryClient, LogsQueryResultStatus } = require('@azure/monitor-query');

const SUBSCRIPTION_ID = process.env.AZURE_SUBSCRIPTION_ID;
const RESOURCE_GROUP = process.env.ACA_RESOURCE_GROUP;
const JOB_NAME = process.env.ACA_JOB_NAME;
// Accept either LOG_ANALYTICS_WORKSPACE (preferred) or LOG_ANALYTICS_WORKSPACE_ID (compat)
const LOG_ANALYTICS_WORKSPACE = process.env.LOG_ANALYTICS_WORKSPACE || process.env.LOG_ANALYTICS_WORKSPACE_ID;
const ACA_JOB_IMAGE = process.env.ACA_JOB_IMAGE;

const MAX_LOG_RETRIES = 60;
const LOG_POLL_DELAY_MS = 5000;

function getCredential() {
    const clientId = process.env.AZURE_CLIENT_ID;
    if (clientId) {
        return new ManagedIdentityCredential(clientId);
    }
    return new DefaultAzureCredential();
}

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
}

module.exports = async function (context, req) {
    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers: corsHeaders() };
        return;
    }

    console.log("Environment Variables:");
    console.log("AZURE_SUBSCRIPTION_ID:", SUBSCRIPTION_ID);
    console.log("ACA_RESOURCE_GROUP:", RESOURCE_GROUP);
    console.log("ACA_JOB_NAME:", JOB_NAME);
    console.log("LOG_ANALYTICS_WORKSPACE:", LOG_ANALYTICS_WORKSPACE);
    console.log("ACA_JOB_IMAGE:", ACA_JOB_IMAGE);

    try {
    if (!SUBSCRIPTION_ID || !RESOURCE_GROUP || !JOB_NAME || !LOG_ANALYTICS_WORKSPACE || !ACA_JOB_IMAGE) {
            context.res = {
                status: 500,
                headers: corsHeaders(),
        body: { error: 'Missing env. Required: AZURE_SUBSCRIPTION_ID, ACA_RESOURCE_GROUP, ACA_JOB_NAME, LOG_ANALYTICS_WORKSPACE (or LOG_ANALYTICS_WORKSPACE_ID), ACA_JOB_IMAGE.' }
            };
            return;
        }

        const { templateName, action } = req.body || {};
        if (!templateName || !action || !['up', 'down', 'updown'].includes(action)) {
            context.res = {
                status: 400,
                headers: corsHeaders(),
                body: { error: 'templateName and action (up|down|updown) required' }
            };
            return;
        }

        const credential = getCredential();
        const client = new ContainerAppsAPIClient(credential, SUBSCRIPTION_ID);
        const logsClient = new LogsQueryClient(credential);

        const jobDetails = await client.jobs.get(RESOURCE_GROUP, JOB_NAME);
        // Safely derive the environment name; some API shapes may not include properties.environmentId
        const envId = jobDetails?.properties?.environmentId
            || jobDetails?.properties?.managedEnvironmentId
            || jobDetails?.environmentId
            || jobDetails?.managedEnvironmentId
            || '';
        const runtimeEnvName = envId ? envId.split('/').pop() : '';
        if (!envId) {
            context.log.warn('aca-start-job: environmentId not found on job resource; proceeding without runtimeEnvName');
        }

        const executionName = `td-${Date.now()}`;

        const task = {
            name: executionName,
            template: {
                containers: [
                    {
                        name: 'runner',
                        image: ACA_JOB_IMAGE,
                        command: [
                            "/bin/bash",
                            "-c",
                            `azd login --identity && azd init -t ${templateName} && azd ${action}`
                        ],
                        env: [
                            { name: 'TD_RUN_ID', value: executionName }
                        ]
                    }
                ]
            }
        };

        console.log(`Starting ACA Job: ${executionName}`);
        await client.jobs.beginStartAndWait(RESOURCE_GROUP, JOB_NAME, { name: executionName, task });

        console.log("Job started. Beginning log polling...");
        const logs = [];
        for (let attempt = 1; attempt <= MAX_LOG_RETRIES; attempt++) {
            const query = `
                ContainerAppConsoleLogs_CL
                | where ContainerName_s == "runner"
                | where TD_RUN_ID_s == "${executionName}" or RevisionName_s contains "${executionName}"
                | sort by TimeGenerated asc
                | project TimeGenerated, Log_s
            `;

            const result = await logsClient.queryWorkspace(LOG_ANALYTICS_WORKSPACE, query, { duration: "PT1H" });
            if (result.status === LogsQueryResultStatus.Success) {
                const rows = result.tables[0].rows;
                const formattedLogs = rows.map(r => `[${new Date(r[0]).toISOString()}] ${r[1]}`);

                formattedLogs.forEach(line => {
                    if (!logs.includes(line)) {
                        logs.push(line);
                        console.log(line);
                    }
                });

                if (formattedLogs.some(line =>
                    line.toLowerCase().includes('exited') ||
                    line.toLowerCase().includes('completed') ||
                    line.toLowerCase().includes('error'))) {
                    console.log("Job appears to have completed or failed. Ending log stream.");
                    break;
                }
            }

            await new Promise(res => setTimeout(res, LOG_POLL_DELAY_MS));
        }

        context.res = {
            status: 202,
            headers: corsHeaders(),
            body: { jobName: JOB_NAME, executionName, runtimeEnvName, logs }
        };

    } catch (err) {
        context.log.error('aca-start-job error', err);
        context.res = {
            status: 500,
            headers: corsHeaders(),
            body: { error: err.message }
        };
    }
};
