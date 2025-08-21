const { startContainerJob } = require('../lib/container-app-client');

module.exports = async function (context, req) {
    context.log('Provision proxy function processed a request.');
    const correlationId = `provision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Enable CORS
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400'
            }
        };
        return;
    }

    try {
        // Forward all requests to the aca-start-job functionality
        // Set mode to azd since that's what the UI is trying to use
        const mode = 'azd';
        
        // Extract repo URL from request
        let repoUrl;
        if (req.method === 'POST' && req.body) {
            repoUrl = req.body.repoUrl;
        } else if (req.query.repoUrl) {
            repoUrl = req.query.repoUrl;
        }

        if (!repoUrl) {
            context.res = {
                status: 400,
                body: { error: "Repository URL is required" }
            };
            return;
        }

        // Normalize template name to handle various formats
        let normalizedTemplate = repoUrl;
        
        // Check if it's a URL and extract the repo name
        if (normalizedTemplate.startsWith('http://') || normalizedTemplate.startsWith('https://') || normalizedTemplate.startsWith('git@')) {
            try {
                if (normalizedTemplate.startsWith('git@')) {
                    const parts = normalizedTemplate.split(':');
                    if (parts.length > 1) normalizedTemplate = parts[1];
                } else {
                    const url = new URL(normalizedTemplate);
                    normalizedTemplate = url.pathname;
                }
                
                // Clean up the path
                normalizedTemplate = normalizedTemplate.replace(/^\/+/, '');
                const segments = normalizedTemplate.split('/').filter(Boolean);
                normalizedTemplate = segments.length ? segments[segments.length - 1] : normalizedTemplate;
                normalizedTemplate = normalizedTemplate.replace(/\.git$/i, '');
            } catch (e) {
                context.log.error('Error normalizing template URL:', e);
                // Continue with original input if parsing fails
            }
        } else {
            // Simple replacement for non-URL inputs
            normalizedTemplate = repoUrl.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
        }
        
        context.log.info(`Received provision request | Template: ${repoUrl}, Normalized: ${normalizedTemplate}, Mode: ${mode}`);
        
        // Create a unique execution name with timestamp and template name
        const executionName = `td-${Date.now()}-${normalizedTemplate}`;
        context.log.info(`Generated execution name: ${executionName}`);
        
        // Start the container job
        try {
            // Check if we have the required environment variables
            const hasRequiredEnvVars = process.env.AZURE_SUBSCRIPTION_ID && 
                                   process.env.ACA_RESOURCE_GROUP && 
                                   process.env.ACA_JOB_NAME;
            
            if (!hasRequiredEnvVars) {
                throw new Error('Missing required environment variables: AZURE_SUBSCRIPTION_ID, ACA_RESOURCE_GROUP, ACA_JOB_NAME');
            }
            
            // Start the container job
            const jobResult = await startContainerJob(executionName, normalizedTemplate, 'init', mode);
            context.log.info(`Container job started: ${JSON.stringify(jobResult)}`);
            
            // Initialize global executionLogs if it doesn't exist
            if (!global.executionLogs) {
                global.executionLogs = {};
            }
            
            // Set up global logs object for this execution
            global.executionLogs[executionName] = {
                status: 'running',
                logs: [],
                done: false,
                startTime: new Date().toISOString(),
                endTime: null,
                exitCode: null,
                jobName: jobResult.jobExecutionName,
                resourceId: jobResult.resourceId,
                simulation: false
            };
            
            // Add initial log entries
            global.executionLogs[executionName].logs.push({
                timestamp: Date.now(),
                message: `[${new Date().toISOString()}] Container job started for template ${normalizedTemplate}`
            });
            
            global.executionLogs[executionName].logs.push({
                timestamp: Date.now(),
                message: `[${new Date().toISOString()}] Job execution name: ${executionName}`
            });
            
            global.executionLogs[executionName].logs.push({
                timestamp: Date.now(),
                message: `[${new Date().toISOString()}] Container job name: ${jobResult.jobExecutionName}`
            });
            
            // Return success response with runId
            context.res = {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'X-Correlation-Id': correlationId
                },
                body: {
                    runId: executionName,
                    status: 'started',
                    message: 'AZD provision test started successfully'
                }
            };
        } catch (containerError) {
            context.log.error(`Error starting Container App job: ${containerError.message || containerError}`);
            throw new Error(containerError.message || 'Unknown error starting Container App job');
        }
    } catch (error) {
        context.log.error('Error in provision function:', error);
        
        context.res = {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'X-Correlation-Id': correlationId
            },
            body: { 
                error: error.message || 'An error occurred while starting the AZD provision test',
                correlationId
            }
        };
    }
};
