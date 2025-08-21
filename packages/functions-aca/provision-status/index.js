const { getContainerJobLogs } = require('../lib/container-app-client');

module.exports = async function (context, req) {
    context.log('Provision-status proxy function processed a request.');

    // Enable CORS
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400'
            }
        };
        return;
    }

    try {
        // Get runId from query parameters
        const runId = req.query.runId;
        
        if (!runId) {
            context.res = {
                status: 400,
                body: { error: "Run ID is required" }
            };
            return;
        }

        // Fetch the latest logs and status
        const jobLogs = await getContainerJobLogs(runId);
        
        // Format the logs for the UI
        const messages = jobLogs.logs?.map(log => log.message) || [];
        
        // Map the job status to what the UI expects
        let status = 'running';
        if (jobLogs.done) {
            status = (jobLogs.status === 'Succeeded' || jobLogs.status === 'Completed') ? 'completed' : 'failed';
        }
        
        // Determine if the job was successful based on status
        const success = status === 'completed';
        
        // Return the response in the format expected by the UI
        context.res = {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: {
                status,
                progress: messages.length > 0 ? messages[messages.length - 1] : 'Running...',
                success,
                error: !success && messages.length > 0 ? messages[messages.length - 1] : null,
                details: {
                    messages,
                    startTime: jobLogs.startTime,
                    endTime: jobLogs.endTime,
                    done: jobLogs.done
                }
            }
        };
    } catch (error) {
        context.log.error('Error in provision-status function:', error);
        
        context.res = {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: { 
                status: 'failed',
                error: error.message || 'An error occurred while checking the provision status'
            }
        };
    }
};
