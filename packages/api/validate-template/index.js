const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

/**
 * Trigger GitHub workflow to validate a template and return the workflow run ID
 * 
 * @param {import('@azure/functions').Context} context
 * @param {import('@azure/functions').HttpRequest} req
 */
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

    context.log('API - Validate template function triggered');

    try {
        // Parse request body
        const templateUrl = req.body?.templateUrl;
        if (!templateUrl) {
            return {
                status: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: { error: "Missing required parameter: templateUrl" }
            };
        }

        // Validate the template URL is a GitHub repository
        if (!templateUrl.startsWith('https://github.com/')) {
            return {
                status: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: { error: "Invalid templateUrl: must be a GitHub repository URL" }
            };
        }

        // Generate a unique run ID for tracking this validation
        const runId = uuidv4();

        // Get host URL for callback
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const baseUrl = `${protocol}://${host}`;
        const callbackUrl = `${baseUrl}/api/validation-callback`;

        // GitHub API info
        const GITHUB_REPO = process.env.GITHUB_REPOSITORY || 'microsoft/template-doctor';
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

        if (!GITHUB_TOKEN) {
            context.log.error('GITHUB_TOKEN environment variable is not set');
            return {
                status: 500,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: { error: "Server configuration error: missing GitHub token" }
            };
        }

        // Trigger GitHub workflow using GitHub API
        const workflowDispatchUrl = `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/validate-template.yml/dispatches`;
        
        context.log(`Triggering workflow at ${workflowDispatchUrl}`);
        context.log(`Template URL: ${templateUrl}`);
        context.log(`Callback URL: ${callbackUrl}`);

        const response = await fetch(workflowDispatchUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ref: 'main',
                inputs: {
                    target_validate_template_url: templateUrl,
                    callback_url: callbackUrl,
                    run_id: runId
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            context.log.error(`Error triggering workflow: ${response.status} ${errorText}`);
            return {
                status: response.status,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: { 
                    error: "Failed to trigger validation workflow",
                    details: errorText
                }
            };
        }

        // In production, you'd store this in a database to track the status
        // For now, just return the run ID

        context.res = {
            status: 202, // Accepted
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: {
                status: "validation_started",
                runId: runId,
                templateUrl: templateUrl,
                message: "Template validation has been initiated. Check the status using the runId."
            }
        };
    } catch (error) {
        context.log.error(`Error in validate-template function: ${error.message}`);
        context.log.error(error.stack);
        
        context.res = {
            status: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: {
                error: "Internal server error",
                message: error.message
            }
        };
    }
};
