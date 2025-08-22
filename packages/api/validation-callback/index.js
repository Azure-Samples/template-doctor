/**
 * Callback endpoint for GitHub workflow validation results
 * 
 * @param {import('@azure/functions').Context} context
 * @param {import('@azure/functions').HttpRequest} req
 */
module.exports = async function (context, req) {
    context.log('API - Validation callback function triggered');

    try {
        // Validate request
        const payload = req.body;
        if (!payload || !payload.runId) {
            context.res = {
                status: 400,
                body: { error: "Invalid callback payload. Missing runId." }
            };
            return;
        }

        context.log(`Received validation callback for runId: ${payload.runId}`);
        context.log(`Validation status: ${payload.status}`);
        
        // In a production environment, you would store the validation results in a database
        // For example, using Azure Table Storage or Cosmos DB
        // Then the validation-status endpoint would query this database

        // For now, just acknowledge receipt
        context.res = {
            status: 200,
            body: {
                message: "Validation callback received successfully",
                runId: payload.runId
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
