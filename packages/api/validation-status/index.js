const fetch = require('node-fetch');

/**
 * Get the status of a template validation workflow run
 * 
 * @param {import('@azure/functions').Context} context
 * @param {import('@azure/functions').HttpRequest} req
 */
module.exports = async function (context, req) {
    function corsHeaders() {
        return {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        };
    }

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 204,
            headers: corsHeaders()
        };
        return;
    }

    context.log('API - Validation status function triggered');

    try {
        // Get run ID from query parameters
        const runId = req.query.runId;
        if (!runId) {
            context.res = {
                status: 400,
                headers: corsHeaders(),
                body: { error: "Missing required parameter: runId" }
            };
            return;
        }

        // Get GitHub token from environment variable
        const githubToken = process.env.GITHUB_TOKEN;
        if (!githubToken) {
            context.log.error('GITHUB_TOKEN environment variable is not set');
            context.res = {
                status: 500,
                headers: corsHeaders(),
                body: { error: "Server configuration error: missing GitHub token" }
            };
            return;
        }

        // GitHub repository info
        const GITHUB_REPO = process.env.GITHUB_REPOSITORY || 'microsoft/template-doctor';

        // In a real implementation, you would retrieve validation status from a database
        // or query GitHub API to get the status of the workflow run
        
        // For now, we'll simulate a response based on the run ID
        // In production, you would use a more sophisticated lookup mechanism

        // Simulate different workflow statuses based on the run ID
        // This would be replaced with actual GitHub API calls or database lookups
        const randomStatus = Math.random();
        let status, conclusion, results;

        if (randomStatus < 0.3) {
            // Workflow is still running
            status = 'in_progress';
            conclusion = null;
            results = null;
        } else if (randomStatus < 0.8) {
            // Workflow completed successfully
            status = 'completed';
            conclusion = 'success';
            results = {
                passed: true,
                summary: "All validation checks passed successfully.",
                details: [
                    { category: "metadata", status: "pass", message: "All metadata tests passed" },
                    { category: "azd-up", status: "pass", message: "Successfully provisioned with azd up" },
                    { category: "ps-rule", status: "pass", message: "No issues found in PS Rule validation" }
                ]
            };
        } else {
            // Workflow completed with failures
            status = 'completed';
            conclusion = 'failure';
            results = {
                passed: false,
                summary: "Some validation checks failed. See details for more information.",
                details: [
                    { category: "metadata", status: "pass", message: "All metadata tests passed" },
                    { category: "azd-up", status: "fail", message: "Failed to provision with azd up" },
                    { category: "ps-rule", status: "warn", message: "3 issues found in PS Rule validation", issues: [
                        "Missing SUPPORT.md file",
                        "azd.yaml is missing required fields",
                        "Environment variables not properly documented"
                    ]}
                ]
            };
        }

        // Create a simulated workflow run URL
        const runUrl = `https://github.com/${GITHUB_REPO}/actions/runs/${Math.floor(Math.random() * 1000000)}`;
        
        // Return the validation status
        context.res = {
            status: 200,
            headers: corsHeaders(),
            body: {
                runId: runId,
                status: status,
                conclusion: conclusion,
                runUrl: runUrl,
                startTime: new Date(Date.now() - Math.floor(Math.random() * 3600000)).toISOString(),
                endTime: status === 'completed' ? new Date().toISOString() : null,
                results: results
            }
        };
    } catch (error) {
        context.log.error(`Error in validation-status function: ${error.message}`);
        context.log.error(error.stack);
        
        context.res = {
            status: 500,
            headers: corsHeaders(),
            body: {
                error: "Internal server error",
                message: error.message
            }
        };
    }
};
