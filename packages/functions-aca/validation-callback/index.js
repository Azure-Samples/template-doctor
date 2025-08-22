/**
 * Receive callback from GitHub workflow validation
 * This function receives the validation results and can store them or broadcast to connected clients
 * 
 * @param {import('@azure/functions').Context} context
 * @param {import('@azure/functions').HttpRequest} req
 */
module.exports = async function (context, req) {
    context.log('Validation callback function triggered');

    try {
        // Validate request
        if (!req.body || !req.body.runId || !req.body.status) {
            return {
                status: 400,
                body: { error: "Invalid callback payload" }
            };
        }

        const { runId, status, templateUrl, summary, artifactUrl } = req.body;

        context.log(`Received validation callback for runId: ${runId}`);
        context.log(`Status: ${status}`);
        context.log(`Template: ${templateUrl}`);

        // In a production environment, you would:
        // 1. Store the results in a database
        // 2. Notify connected clients via SignalR or similar
        // 3. Update any UI that's waiting for results
        
        // For now, we'll just log the results and return success
        
        // Example code to store in Azure Table Storage:
        // const tableService = new TableService(process.env.AzureWebJobsStorage);
        // await tableService.createTableIfNotExists('templateValidations');
        // await tableService.insertEntity('templateValidations', {
        //     PartitionKey: templateUrl,
        //     RowKey: runId,
        //     status,
        //     summary: JSON.stringify(summary),
        //     artifactUrl,
        //     timestamp: new Date().toISOString()
        // });

        context.res = {
            status: 200,
            body: {
                message: "Validation results received and processed",
                runId
            }
        };
    } catch (error) {
        context.log.error(`Error in validation-callback function: ${error.message}`);
        context.log.error(error.stack);
        
        context.res = {
            status: 500,
            body: {
                error: "Internal server error",
                message: error.message
            }
        };
    }
};
