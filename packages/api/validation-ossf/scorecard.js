const { triggerWorkflow } = require('../action-trigger/index');
const { getWorkflowRunData } = require('../action-run-status/index');
const { getArtifactsForRun } = require('../action-run-artifacts/index');

const maxAttempts = 30; // Maximum number of attempts to check workflow status
const delayMs = 10000; // 10 seconds delay between status checks


/**
 * Utility function to sleep for a specified number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Adds an issue to the issues array with standard format
 * @param {Array} issues - Issues array to add to
 * @param {string} id - Issue identifier
 * @param {string} severity - Issue severity (warning, error)
 * @param {string} message - Issue message
 * @param {Object} [details] - Optional details object
 */
function addIssue(issues, id, severity, message, details = null) {
    const issue = {
        id,
        severity,
        message
    };
    
    if (details) {
        issue.details = details;
    } else  {
        issue.error = message;
    }
    
    issues.push(issue);
}

/**
 * Gets OSSF Score using the action-* APIs
 * @param {Object} context - Azure Functions context
 * @param {string} workflowOwner - Owner of the workflow repository
 * @param {string} workflowRepo - Name of the workflow repository
 * @param {string} workflowFile - Name of the workflow file
 * @param {string} templateOwnerRepo - Owner/repo of the template to analyze
 * @param {string} requestGuid - Unique ID for this request
 * @param {number} minScore - Minimum acceptable score
 * @param {Array} issues - Array to add issues to
 * @param {Array} compliance - Array to add compliance items to
 * @returns {Promise<{score: number|null, runId: string|number|null}>} Object containing score and runId, or null values if operation failed
 */
async function getOSSFScore(context, workflowOwner, workflowRepo, workflowFile, templateOwnerRepo, requestGuid, minScore, issues, compliance) {
    context.log(`Getting OSSF score using action APIs for ${templateOwnerRepo} with minimum score: ${minScore.toFixed(1)}`);

    // Validate input parameters
    if (!templateOwnerRepo || typeof templateOwnerRepo !== 'string' || templateOwnerRepo.indexOf('/') === -1) {
        addIssue(issues, 'ossf-score-invalid-template-repo', 'warning', 'Invalid template repo string for OSSF score. Use owner/repo format.');
        return { score: null, runId: null };
    }

    if (!requestGuid || typeof requestGuid !== 'string') {
        addIssue(issues, 'ossf-score-invalid-request-guid', 'warning', 'Invalid request GUID for OSSF score.');
        return { score: null, runId: null };
    }

    try {
        const workflowOrgRep = `${workflowOwner}/${workflowRepo}`;
        const workflowInput = {
            repo: templateOwnerRepo,
            id: requestGuid
        };

        // Trigger the workflow using action-trigger API
        const triggerResult = await triggerWorkflow(
            workflowOwner, 
            workflowRepo, 
            workflowFile, 
            workflowInput, 
            'id',  // runIdInputProperty - the property that contains our unique ID
            context
        );

        if (triggerResult.status !== 200 || !triggerResult.found) {
            addIssue(issues, 'ossf-score-workflow-trigger-failed', 'warning', 
                `Failed to trigger OSSF score workflow. Status: ${triggerResult.status}, Error: ${triggerResult.error || 'Unknown error'}`);
            return { score: null, runId: null };
        }

        const runId = triggerResult.runId;
        context.log(`OSSF score workflow triggered successfully with run ID: ${runId}`);

        // Wait until the run is completed
        let run;
        let attempts = 0;

        while (attempts < maxAttempts) {
            await sleep(delayMs);
            run = await getWorkflowRunData(workflowOwner, workflowRepo, runId, context);

            // Defensive check to ensure run and run.status exist
            if (!run || typeof run.status === 'undefined') {
                context.log.warn(`OSSF workflow check received invalid response, attempt: ${attempts + 1}/${maxAttempts}`);
                attempts++;
                continue;
            }

            context.log(`Checking OSSF workflow status: ${run.status}, attempt: ${attempts + 1}/${maxAttempts}`);

            if (run.status === 'completed') break;
            attempts++;
        }

        if (!run || run.status !== 'completed') {
            addIssue(issues, 'ossf-score-workflow-timeout', 'warning', 
                'OSSF score workflow did not complete in expected time');
            return { score: null, runId: runId || null };
        }

        context.log(`OSSF score workflow completed, fetching artifacts`);

        // Get the artifacts data
        const artifacts = await getArtifactsForRun(workflowOwner, workflowRepo, runId, context);

        if (!artifacts || !artifacts.artifacts || artifacts.artifacts.length === 0) {
            addIssue(issues, 'ossf-score-artifact-not-found', 'warning', 
                'No artifacts found from OSSF score workflow run');
            return { score: null, runId: runId };
        }

        // Find the artifact with our requestGuid
        const runStatus = artifacts.artifacts.find(artifact => 
            typeof artifact.name === 'string' && artifact.name.includes(requestGuid));

        if (!runStatus) {
            addIssue(issues, 'ossf-score-artifact-failed', 'warning', 
                'OSSF score workflow artifact not found for request GUID', 
                { workflowOrgRep, workflowFile, templateOwnerRepo, requestGuid, runId });
            return { score: null, runId };
        }

        // Check if the artifact has a download URL
        if (!runStatus.archive_download_url || runStatus.archive_download_url.length < 5) {
            addIssue(issues, 'ossf-score-artifact-download-failed', 'warning', 
                `OSSF workflow concluded without finding artifact download URL`, runStatus);
            return { score: null, runId };
        }

        // Extract the score from the artifact name
        const scoreRaw = runStatus.name.split('_score_')[1];
        if (!scoreRaw) {
            addIssue(issues, 'ossf-score-value-not-found', 'warning', 
                `OSSF workflow concluded without finding score value: ${runStatus.url}`, runStatus);
            return { score: null, runId };
        }

        const scoreString = scoreRaw.replace(`_`, '.');
        const score = parseFloat(scoreString);

        // Check if score is a valid number
        if (isNaN(score)) {
            addIssue(issues, 'ossf-score-invalid-number', 'warning', 
                `OSSF workflow returned invalid score value: ${scoreString}`, runStatus);
            return { score: null, runId };
        }

        // Compare the score with minimum required score
        const epsilon = 1e-10; // Small tolerance value
        if (Math.abs(score - minScore) < epsilon || score > minScore) {
            compliance.push({
                id: 'ossf-score-meets-minimum',
                category: 'security',
                message: `OpenSSF Score ${score.toFixed(1)} >= ${minScore.toFixed(1)}`,
                details: { templateOwnerRepo: templateOwnerRepo, score: score.toFixed(1), minScore: minScore, artifact: runStatus }
            });
        } else {
            addIssue(issues, 'ossf-score-below-minimum', 'warning', 
                `OSSF workflow concluded with score ${score.toFixed(1)} < ${minScore.toFixed(1)}: ${runStatus.url}`,
                { templateOwnerRepo: templateOwnerRepo, score: score.toFixed(1), minScore: minScore.toFixed(1), artifact: runStatus });
        }

        return { score, runId };

    } catch (err) {
        context.log.error('Error fetching OSSF Scorecard:', {
            error: err.message,
            stack: err.stack,
            templateOwnerRepo,
            requestGuid,
            operation: 'getOSSFScore'
        });
        
        addIssue(issues, 'ossf-score-error', 'warning', 'Failed to fetch OSSF Scorecard', 
                { error: err instanceof Error ? err.message : String(err) });
        
        // Return null values to indicate error condition
        return { score: null, runId: null };
    }
}
module.exports = { 
    getOSSFScore
};