const { DefaultAzureCredential, ManagedIdentityCredential } = require('@azure/identity');
const { ContainerAppsAPIClient } = require('@azure/arm-appcontainers');
const { LogsQueryClient } = require('@azure/monitor-query');

const SUBSCRIPTION_ID = process.env.AZURE_SUBSCRIPTION_ID;
const RESOURCE_GROUP = process.env.ACA_RESOURCE_GROUP;
const JOB_NAME = process.env.ACA_JOB_NAME;
// Accept either LOG_ANALYTICS_WORKSPACE (preferred) or LOG_ANALYTICS_WORKSPACE_ID (compat), fallback WORKSPACE_ID
const LOG_WORKSPACE_ID = process.env.LOG_ANALYTICS_WORKSPACE || process.env.LOG_ANALYTICS_WORKSPACE_ID || process.env.WORKSPACE_ID;

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

	// Helper to fetch execution object (single lookup or enumeration fallback)
	async function getExecution(client, name) {
		let exec = undefined;
		try {
			if (typeof client.jobs.getExecution === 'function') {
				exec = await client.jobs.getExecution(RESOURCE_GROUP, JOB_NAME, name);
			}
		} catch (_) {
			// ignore and fall back
		}
		if (!exec) {
			try {
				const list = client.jobs.listExecutions(RESOURCE_GROUP, JOB_NAME);
				for await (const e of list) {
					if (e?.name === name) { exec = e; break; }
				}
			} catch (_) {}
		}
		return exec;
	}

	// If client requests polling mode (or SSE is disabled), return JSON snapshot and exit
	const accept = (req.headers['accept'] || '').toLowerCase();
	const wantSSE = accept.includes('text/event-stream') && process.env.DISABLE_SSE !== '1' && req.query.mode !== 'poll';
	if (!wantSSE) {
		const credential = getCredential();
		const client = new ContainerAppsAPIClient(credential, SUBSCRIPTION_ID);
		const logsClient = LOG_WORKSPACE_ID ? new LogsQueryClient(credential) : null;

		// Determine status
		let status = 'queued';
		let done = false;
		let nextSince = req.query.since || undefined;
		const messages = [];
		let details = null;

		try {
			const exec = await getExecution(client, executionName);
			if (exec) {
				status = exec.properties?.provisioningState || exec.properties?.status || 'running';
				done = ['Succeeded', 'Failed', 'Stopped', 'Canceled'].includes(exec.properties?.status);
				details = {
					provisioningState: exec.properties?.provisioningState ?? null,
					status: exec.properties?.status ?? null,
					exitCode: exec.properties?.exitCode ?? null,
					startTime: exec.properties?.startTime || exec.properties?.startedAt || null,
					endTime: exec.properties?.endTime || exec.properties?.completedAt || null
				};
			}
		} catch (e) {
			// best-effort: include error as message but do not fail request
			messages.push(`[executions] ${e?.message || String(e)}`);
		}

		// Fetch logs since cursor if workspace configured
		if (logsClient && LOG_WORKSPACE_ID) {
			try {
				let sinceIso;
				if (nextSince) {
					// allow numeric timestamp or ISO
					const n = Number(nextSince);
					sinceIso = Number.isFinite(n) && n > 0 ? new Date(n).toISOString() : new Date(nextSince).toISOString();
				} else {
					sinceIso = new Date(Date.now() - 5 * 60 * 1000).toISOString();
				}
				const kql = `
union isfuzzy=true
ContainerAppConsoleLogs_CL
| where TimeGenerated >= datetime(${sinceIso})
| where Log_s contains '${executionName}' or ContainerName_s contains 'runner'
| project TimeGenerated, Text=Log_s
| order by TimeGenerated asc`;
				const resp = await logsClient.queryWorkspace(
					LOG_WORKSPACE_ID,
					kql,
					{ startTime: new Date(sinceIso), endTime: new Date() }
				);
				const table = resp.tables && resp.tables[0];
				let lastTime = nextSince ? (Number(nextSince) || Date.parse(nextSince)) : 0;
				if (table && table.rows) {
					for (const row of table.rows) {
						const when = new Date(row[0]);
						const text = row[1];
						messages.push(text);
						if (!lastTime || when.getTime() > lastTime) lastTime = when.getTime();
					}
				}
				if (lastTime) nextSince = String(lastTime);
			} catch (qe) {
				messages.push(`[logs] ${qe?.message || String(qe)}`);
			}
		}

		context.res = {
			status: 200,
			headers: corsHeaders(),
			body: {
				status,
				messages,
				done,
				nextSince: nextSince || '',
				details
			}
		};
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

		const deadline = Date.now() + 15 * 60 * 1000; // cap at 15 minutes
		while (!finished) {
			const exec = await getExecution(client, executionName);
			if (!exec) {
				write('status', { state: 'queued' });
			} else {
				const state = exec.properties?.provisioningState || exec.properties?.status || 'running';
				const details = {
					provisioningState: exec.properties?.provisioningState ?? null,
					status: exec.properties?.status ?? null,
					exitCode: exec.properties?.exitCode ?? null,
					startTime: exec.properties?.startTime || exec.properties?.startedAt || null,
					endTime: exec.properties?.endTime || exec.properties?.completedAt || null
				};
				write('status', { state, details });
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
					const resp = await logsClient.queryWorkspace(
						LOG_WORKSPACE_ID,
						kql,
						{ startTime: new Date(since), endTime: new Date() }
					);
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
				const compDetails = {
					provisioningState: exec.properties?.provisioningState ?? null,
					status: exec.properties?.status ?? null,
					exitCode: exec.properties?.exitCode ?? null,
					startTime: exec.properties?.startTime || exec.properties?.startedAt || null,
					endTime: exec.properties?.endTime || exec.properties?.completedAt || null
				};
				write('complete', { succeeded: exec.properties?.status === 'Succeeded', status: exec.properties?.status, details: compDetails });
				break;
			}

			if (Date.now() > deadline) {
				finished = true;
				write('complete', { succeeded: false, status: 'TimedOut' });
				break;
			}

			await delay(3000);
		}

		context.res.end();
	} catch (err) {
		try { write('error', { message: err?.message || String(err) }); } catch {}
		try { context.res.end(); } catch {}
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
