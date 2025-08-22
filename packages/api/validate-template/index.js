const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

/**
 * Trigger GitHub workflow to validate a template and return the workflow run ID
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
            context.res = {
                status: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: { error: "Missing required parameter: templateUrl" }
            };
            return context.res;
        }

        // Validate the template URL is a GitHub repository
        if (!templateUrl.startsWith('https://github.com/')) {
            context.res = {
                status: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: { error: "Invalid templateUrl: must be a GitHub repository URL" }
            };
            return context.res;
        }

        // Generate a unique run ID for tracking this validation
        const runId = uuidv4();

        // Get host URL for callback
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const baseUrl = `${protocol}://${host}`;
        const callbackUrl = `${baseUrl}/api/validation-callback`;

        // GitHub API info
        const GITHUB_REPO = process.env.GITHUB_REPOSITORY || 'Template-Doctor/template-doctor';
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

        if (!GITHUB_TOKEN) {
            context.log.error('GITHUB_TOKEN environment variable is not set');
            context.res = {
                status: 500,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: { error: "Server configuration error: missing GitHub token" }
            };
            return context.res;
        }

        // Trigger GitHub workflow using GitHub API
        const workflowDispatchUrl = `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/validate-template.yml/dispatches`;
        
        context.log(`Triggering workflow at ${workflowDispatchUrl}`);
        context.log(`Repository: ${GITHUB_REPO}`);
        context.log(`Template URL: ${templateUrl}`);
        context.log(`Callback URL: ${callbackUrl}`);
        context.log(`GitHub Token Present: ${GITHUB_TOKEN ? 'Yes' : 'No'}`);

        const requestBody = {
            ref: 'main',
            inputs: {
                target_validate_template_url: templateUrl,
                callback_url: callbackUrl,
                run_id: runId
            }
        };
        
        context.log(`Request body: ${JSON.stringify(requestBody)}`);

        try {
            const response = await fetch(workflowDispatchUrl, {
                method: 'POST',
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'Template-Doctor-API'
                },
                body: JSON.stringify(requestBody)
            });

            // Log the status code and response for debugging
            context.log(`GitHub API Response Status: ${response.status}`);
            context.log(`GitHub API Response Status Text: ${response.statusText}`);
            
            // Get response headers for debugging
            const headers = {};
            response.headers.forEach((value, name) => {
                headers[name] = value;
            });
            context.log(`GitHub API Response Headers: ${JSON.stringify(headers)}`);
            
            const responseText = await response.text();
            context.log(`GitHub API Response Body: ${responseText || '(empty response)'}`);
            
            if (!response.ok) {
                context.res = {
                    status: response.status,
                    headers: { 
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    body: { 
                        error: "Failed to trigger validation workflow",
                        details: responseText || response.statusText,
                        status: response.status,
                        statusText: response.statusText,
                        url: workflowDispatchUrl,
                        repository: GITHUB_REPO,
                        workflow: "validate-template.yml",
                        responseHeaders: headers,
                        tokenPresent: !!GITHUB_TOKEN,
                        requestInfo: {
                            url: workflowDispatchUrl,
                            method: 'POST',
                            ref: requestBody.ref,
                            hasInputs: !!requestBody.inputs
                        }
                    }
                };
                return context.res;
            }
        } catch (error) {
            context.log.error(`Network error triggering workflow: ${error.message}`);
            context.log.error(`Error stack: ${error.stack}`);
            
            // Log detailed error information
            context.log.error(`Error name: ${error.name}`);
            context.log.error(`Error code: ${error.code || 'N/A'}`);
            
            // Try to get any additional error properties
            const errorProps = Object.getOwnPropertyNames(error)
                .filter(prop => prop !== 'stack' && prop !== 'message' && prop !== 'name')
                .reduce((obj, prop) => {
                    obj[prop] = error[prop];
                    return obj;
                }, {});
                
            context.log.error(`Additional error properties: ${JSON.stringify(errorProps)}`);
            
            context.res = {
                status: 500,
                headers: { 
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: { 
                    error: "Network error triggering validation workflow",
                    details: error.message,
                    errorName: error.name,
                    errorCode: error.code || 'N/A',
                    errorStack: error.stack,
                    additionalInfo: errorProps,
                    url: workflowDispatchUrl,
                    requestInfo: {
                        targetRepo: GITHUB_REPO,
                        tokenAvailable: !!GITHUB_TOKEN
                    }
                }
            };
            return context.res;
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
        
        return context.res;
    } catch (error) {
        context.log.error(`Error in validate-template function: ${error.message}`);
        context.log.error(error.stack);
        
        // Log detailed error information
        context.log.error(`Error name: ${error.name}`);
        context.log.error(`Error code: ${error.code || 'N/A'}`);
        
        // Get environment status (without revealing sensitive values)
        const envStatus = {
            GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY || 'not set',
            GITHUB_TOKEN_EXISTS: !!process.env.GITHUB_TOKEN,
            HOST: host,
            PROTOCOL: protocol
        };
        
        context.log.error(`Environment status: ${JSON.stringify(envStatus)}`);
        
        context.res = {
            status: 500,
            headers: { 
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: {
                error: "Internal server error",
                message: error.message,
                name: error.name,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
                environmentInfo: envStatus,
                timestamp: new Date().toISOString()
            }
        };
    }
};
