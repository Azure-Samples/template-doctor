const { DefaultAzureCredential, ManagedIdentityCredential } = require('@azure/identity');
const { ContainerAppsAPIClient } = require('@azure/arm-appcontainers');

const SUBSCRIPTION_ID = process.env.AZURE_SUBSCRIPTION_ID;
const RESOURCE_GROUP = process.env.ACA_RESOURCE_GROUP;
const JOB_NAME = process.env.ACA_JOB_NAME;

function getCredential() {
	const clientId = process.env.AZURE_CLIENT_ID;
	if (clientId) {
		return new ManagedIdentityCredential(clientId);
	}
	return new DefaultAzureCredential();
}

module.exports = async function (context, req) {
	if (req.method === 'OPTIONS') {
		context.res = { status: 204, headers: corsHeaders() };
		return;
	}

	try {
		if (!SUBSCRIPTION_ID || !RESOURCE_GROUP || !JOB_NAME) {
			context.res = {
				status: 500,
				headers: corsHeaders(),
				body: { error: 'Missing ACA env. Set AZURE_SUBSCRIPTION_ID, ACA_RESOURCE_GROUP, ACA_JOB_NAME.' }
			};
			return;
		}

		const { repoUrl, action } = req.body || {};
		if (!repoUrl || !action || !['up', 'down', 'updown'].includes(action)) {
			context.res = {
				status: 400,
				headers: corsHeaders(),
				body: { error: 'repoUrl and action (up|down|updown) required' }
			};
			return;
		}

		const credential = getCredential();
		const client = new ContainerAppsAPIClient(credential, SUBSCRIPTION_ID);

		const executionName = `td-${Date.now()}`;

		const task = {
			name: executionName,
			template: {
				containers: [
					{
						name: 'runner',
						env: [
							{ name: 'TEMPLATE_REPO_URL', value: repoUrl },
							{ name: 'AZD_ACTION', value: action },
							{ name: 'TD_RUN_ID', value: executionName }
						]
					}
				]
			}
		};

		await client.jobs.beginStartAndWait(RESOURCE_GROUP, JOB_NAME, { name: executionName, task });

		context.res = {
			status: 202,
			headers: corsHeaders(),
			body: {
				jobName: JOB_NAME,
				executionName: executionName
			}
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

function corsHeaders() {
	return {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization'
	};
}
