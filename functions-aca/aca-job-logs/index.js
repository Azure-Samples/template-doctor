const { DefaultAzureCredential, ManagedIdentityCredential } = require('@azure/identity');
const { ContainerAppsAPIClient } = require('@azure/arm-appcontainers');
const { LogsQueryClient } = require('@azure/monitor-query');

const SUBSCRIPTION_ID = process.env.AZURE_SUBSCRIPTION_ID;
const RESOURCE_GROUP = process.env.ACA_RESOURCE_GROUP;
const JOB_NAME = process.env.ACA_JOB_NAME;
const LOG_WORKSPACE_ID = process.env.LOG_ANALYTICS_WORKSPACE_ID || process.env.WORKSPACE_ID;

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

	const executionName = context.bindingData.executionName;
	if (!executionName) {
		context.res = { status: 400, headers: corsHeaders(), body: { error: 'executionName required' } };
		return;
	}

	if (!SUBSCRIPTION_ID || !RESOURCE_GROUP || !JOB_NAME) {
		context.res = { status: 500, headers: corsHeaders(), body: { error: 'Missing ACA env. Set AZURE_SUBSCRIPTION_ID, ACA_RESOURCE_GROUP, ACA_JOB_NAME.' } };
		return;
	}

	context.res = {
		status: 200,
		isRaw: true,
		headers: {
			...corsHeaders(),
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		},
		body: undefined
	};

	const credential = getCredential();
	const client = new ContainerAppsAPIClient(credential, SUBSCRIPTION_ID);
	const logsClient = LOG_WORKSPACE_ID ? new LogsQueryClient(credential) : null;

	const write = (event, data) => {
		context.res.write(`event: ${event}\n`);
		context.res.write(`data: ${JSON.stringify(data)}\n\n`);
	};

	try {
		let finished = false;
		let lastLogTime = undefined;

		write('status', { state: 'starting' });

		while (!finished) {
			const executions = await client.jobs.listExecutions(RESOURCE_GROUP, JOB_NAME);
			const exec = (executions.value || []).find(e => e.name === executionName);
			if (!exec) {
				write('status', { state: 'queued' });
			} else {
				write('status', { state: exec.properties?.provisioningState || exec.properties?.status || 'running' });
			}

			if (logsClient && LOG_WORKSPACE_ID) {
				const since = lastLogTime ? lastLogTime.toISOString() : new Date(Date.now() - 5 * 60 * 1000).toISOString();
				const kql = `
union isfuzzy=true
ContainerAppConsoleLogs_CL
| where TimeGenerated >= datetime(${since})
| where Log_s contains '${executionName}' or ContainerName_s contains 'runner'
| project TimeGenerated, Text=Log_s
| order by TimeGenerated asc`;
				try {
					const resp = await logsClient.queryWorkspace(LOG_WORKSPACE_ID, kql, { timespan: { duration: 60 * 60 } });
					const table = resp.tables && resp.tables[0];
					if (table && table.rows) {
						for (const row of table.rows) {
							const when = new Date(row[0]);
							const text = row[1];
							if (!lastLogTime || when > lastLogTime) {
								write('message', text);
								lastLogTime = when;
							}
						}
					}
				} catch (qe) {
					write('message', `[logs] ${qe.message}`);
				}
			}

			if (exec && (exec.properties?.status === 'Succeeded' || exec.properties?.status === 'Failed' || exec.properties?.status === 'Stopped')) {
				finished = true;
				write('complete', { succeeded: exec.properties?.status === 'Succeeded', status: exec.properties?.status });
				break;
			}

			await delay(3000);
		}

		context.res.end();
	} catch (err) {
		write('error', { message: err.message });
		context.res.end();
	}
};

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function corsHeaders() {
	return {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization'
	};
}
