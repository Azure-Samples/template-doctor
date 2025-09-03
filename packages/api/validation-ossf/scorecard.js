
async function getOSSFScore(context, workflowToken, workflowUrl, workflowFile, templateOwnerRepo, requestGuid, minScore, issues, compliance) {

    context.log(`Minimum score: ${minScore.toFixed(1)}`); // This will log "7.0"

    if (!workflowToken || typeof workflowToken !== 'string') {
        issues.push({
            id: 'ossf-score-invalid-workflow-token',
            severity: 'warning',
            message: 'Invalid workflow token for OSSF score.'
        });
        return;
    }
    if (!workflowUrl || typeof workflowUrl !== 'string' || workflowUrl.indexOf('/') === -1) {
        issues.push({
            id: 'ossf-score-invalid-workflow-repo',
            severity: 'warning',
            message: 'Invalid workflow URL for OSSF score. Use owner/repo format.'
        });
        return;
    }

    if (!workflowFile || typeof workflowFile !== 'string') {
        issues.push({
            id: 'ossf-score-invalid-workflow-file',
            severity: 'warning',
            message: 'Invalid workflow file for OSSF score. '
        });
        return;
    }

    // templateOwnerRepo should be in the form 'owner/repo'
    if (!templateOwnerRepo || typeof templateOwnerRepo !== 'string' || templateOwnerRepo.indexOf('/') === -1) {
        issues.push({
            id: 'ossf-score-invalid-template-repo',
            severity: 'warning',
            message: 'Invalid template repo string for OSSF score. Use owner/repo format.'
        });
        return;
    }

    if (!requestGuid || typeof requestGuid !== 'string') {
        issues.push({
            id: 'ossf-score-invalid-request-guid',
            severity: 'warning',
            message: 'Invalid request GUID for OSSF score.'
        });
        return;
    }

    try {
        //const [owner, repo] = templateOwnerRepo.split('/');
        const client = typeof ScorecardClient !== 'undefined' ? new ScorecardClient(context, undefined, workflowToken, workflowUrl, workflowFile) : null;
        if (!client) {
            issues.push({
                id: 'ossf-score-workflow-trigger-failed',
                severity: 'warning',
                message: `ScorecardClient client can't be created`
            });
            return;
        }

        const triggeredResponse = await client.triggerWorkflow(templateOwnerRepo, requestGuid);
        if (!triggeredResponse || !triggeredResponse.ok) {
            issues.push({
                id: 'ossf-score-workflow-trigger-failed',
                severity: 'warning',
                message: `ScorecardClient workflow not triggered. GitHub API response: ${triggeredResponse ? triggeredResponse.status : 'unknown'}`
            });
            return;
        }

        // delay 3 seconds - give workflow time to start
        await new Promise(resolve => setTimeout(resolve, 3000));

        // poll github artifacts for repo for up to 2 minutes (120 seconds)
        const pollStart = Date.now();
        const pollTimeout = 120000; // 2 minutes in ms
        let runStatus = undefined;
        while (Date.now() - pollStart < pollTimeout) {
            runStatus = await client.getArtifactsListItem(requestGuid);
            if (runStatus !== undefined && runStatus !== null) {
                break;
            }
            context.log(`Waiting for ${templateOwnerRepo} artifact with request GUID: ${requestGuid}`);
            // wait 10 seconds before polling again
            await new Promise(res => setTimeout(res, 10000));
        }
        if (!runStatus) {
            issues.push({
                id: 'ossf-score-artifact-failed',
                severity: 'warning',
                message: 'Workflow artifact failed for request GUID',
                details: { workflowUrl, workflowFile, templateOwnerRepo, requestGuid }
            });
            return;
        }

        // if the run completed but concluded with non-success, record a warning
        if (runStatus && (!runStatus.archive_download_url || runStatus.archive_download_url.length < 5)) {
            issues.push({
                id: 'ossf-score-artifact-download-failed',
                severity: 'warning',
                message: `OSSF workflow concluded without finding artifact download URL`,
                details: runStatus
            });
            return;
        }
        const scoreRaw = runStatus.name.split('_score_')[1];
        if (!scoreRaw) {
            issues.push({
                id: 'ossf-score-value-not-found',
                severity: 'warning',
                message: `OSSF workflow concluded without finding score value: ${runStatus.url}`,
                details: runStatus
            });
            return;
        }

        const scoreString = scoreRaw.replace(`_`, '.');
        const score = parseFloat(scoreString);

        const epsilon = 1e-10; // Small tolerance value
        if (Math.abs(score - minScore) < epsilon || score > minScore) {
            compliance.push({
                id: 'ossf-score-meets-minimum',
                category: 'security',
                message: `OpenSSF Score ${score.toFixed(1)} >= ${minScore.toFixed(1)}`,
                details: { templateOwnerRepo: templateOwnerRepo, score: score.toFixed(1), minScore: minScore, artifact: runStatus }
            });
        } else {
            issues.push({
                id: 'ossf-score-below-minimum',
                severity: 'warning',
                message: `OSSF workflow concluded with score ${score.toFixed(1)} < ${minScore.toFixed(1)}: ${runStatus.url}`,
                details: { templateOwnerRepo: templateOwnerRepo, score: score.toFixed(1), minScore: minScore.toFixed(1), artifact: runStatus }
            });
        }


    } catch (err) {
        console.error('Error fetching Scorecard:', err);
        issues.push({
            id: 'ossf-score-error',
            severity: 'warning',
            message: 'Failed to fetch OSSF Scorecard',
            error: err instanceof Error ? err.message : String(err)
        });
    }
}
class ScorecardClient {
    constructor(context, baseUrl = 'https://api.github.com', token = null, workflowOwnerRepo = null, workflowId = null) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.token = token;

        // if worflowOwnerRepo is a full url, pull out owner/repo and workflow file
        const matches = workflowOwnerRepo.match(/^(.*\/(.*))\/actions\/workflows\/(.*)$/);
        if (matches) {
            this.workflowOwnerRepo = matches[1];
            this.workflowId = matches[3];
        } else {
            this.workflowOwnerRepo = workflowOwnerRepo;
            this.workflowId = workflowId;
        }
        this.context = context ? context : () => ({ log: (str) => { console.log(str) } });
    }

    async triggerWorkflow(templateOwnerRep, incomingGuid) {

        try {
            if (!this.token) throw new Error('GitHub token is required to trigger workflow');
            if (!this.baseUrl) throw new Error('Base URL is required to trigger workflow');
            if (!this.workflowOwnerRepo) throw new Error('workflowOwnerRepo is required to trigger workflow');
            if (!this.workflowId) throw new Error('workflowId is required to trigger workflow');

            if (!templateOwnerRep) throw new Error('templateOwnerRepo is required');
            if (!incomingGuid) throw new Error('incomingGuid is required to trigger workflow');

            const url = `${this.baseUrl}/repos/${this.workflowOwnerRepo}/actions/workflows/${this.workflowId}/dispatches`;
            this.context.log(`URL: ${url}`);

            const body = {
                ref: 'main',
                inputs: {
                    repo: templateOwnerRep,
                    id: incomingGuid
                }
            };

            const params = {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.token}`,
                    Accept: 'application/vnd.github+json',
                    "X-GitHub-Api-Version": "2022-11-28"
                },
                body: JSON.stringify(body),
            };
            this.context.log('Workflow dispatch parameters', params);

            const response = await fetch(url, {
                ...params,
                signal: AbortSignal.timeout(30000) // 30 second timeout
            });

            if (!response.ok) {
                this.context.log(`Failed to trigger workflow: ${response.status} ${response.statusText}`);
                throw new Error(`GitHub dispatch failed: ${response.status} ${response.statusText}`);
            }

            return response;
        } catch (err) {
            this.context.log(`ScorecardClient trigger workflow error: ${err.message}`);
            throw err;
        }

    }
    async getArtifactsListItem(inputGuid) {
        try {

            if (!inputGuid || typeof inputGuid !== 'string') {
                throw new Error('Invalid GUID provided for artifact search');
            }

            const url = `${this.baseUrl}/repos/${this.workflowOwnerRepo}/actions/artifacts`;

            const resp = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${this.token}`,
                    Accept: 'application/vnd.github+json',
                    "X-GitHub-Api-Version": "2022-11-28"
                },
                signal: AbortSignal.timeout(30000) // 30 second timeout
            });
            if (!resp.ok) {
                return undefined;
            }
            const data = await resp.json();
            if (data && Array.isArray(data.artifacts)) {
                // Return the first artifact whose name includes the inputGuid
                return data.artifacts.find(artifact => typeof artifact.name === 'string' && artifact.name.includes(inputGuid));
            }
            return null;
        } catch (err) {
            this.context.log(`ScorecardClient artifact list workflow error: ${err.message}`);
            throw err;
        }
    }

    /**
     * Downloads an artifact from GitHub Actions.
     * This is a two part request:
     * 1: GitHub api to artifact with bearer token, get 302 and read location header
     * 2: Use URL in location header without authorization
     * @param {string} downloadUrl - The GitHub API URL for the artifact
     * @param {Object} context - Azure Functions context for logging
     * @returns {Promise<ArrayBuffer>} - The artifact contents as binary data
     */
    async getArtifactDownload(downloadUrl) {

        try {

            const response = await fetch(downloadUrl, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${this.token}`,
                    Accept: 'application/vnd.github+json',
                    "X-GitHub-Api-Version": "2022-11-28"
                },
                redirect: 'manual', // we want to handle the redirect ourselves
                signal: AbortSignal.timeout(30000) // 30 second timeout
            });

            // If GitHub returned a redirect, follow it manually WITHOUT Authorization
            if (response.status === 302 || response.status === 301 || response.status === 307 || response.status === 308) {
                const location = response.headers.get('location');
                if (!location) throw new Error('Redirected but no Location header');

                this.context.log(`Following redirect to zip file: ${location}`);

                const fileResp = await fetch(location, {
                    method: 'GET',
                    headers: {
                        // do NOT include Authorization here
                        Accept: 'application/octet-stream'
                    },
                    signal: AbortSignal.timeout(60000) // 60 second timeout for larger downloads
                });

                if (!fileResp.ok) {
                    const text = await fileResp.text().catch(() => '');
                    throw new Error(`Failed to download artifact from storage: ${fileResp.status} ${fileResp.statusText} - ${text}`);
                }

                // return binary data (ArrayBuffer) so caller can save/unzip
                const zipFilebuffer = await fileResp.arrayBuffer();
                return zipFilebuffer;
            }

            if (response.ok) {
                // may be JSON or binary depending on response; return ArrayBuffer for binary safety
                return await response.arrayBuffer();
            }

            this.context.log(`Failed to download artifact: ${response.status} ${response.statusText}`);
            throw new Error(`Failed to download artifact: ${response.status} ${response.statusText}`);
        } catch (err) {
            this.context.log(`ScorecardClient artifact download error: ${err.message}`);
            throw err;
        }
    }

    /**
     * Triggers workflow with retry capability for improved resilience
     * @param {Object} context - Azure Functions context for logging
     * @param {string} templateOwnerRep - Repository in owner/repo format
     * @param {string} incomingGuid - Unique identifier for this run
     * @param {number} maxRetries - Maximum number of retry attempts
     * @returns {Promise<Response>} - The final response from the workflow trigger
     */
    async triggerWorkflowWithRetry(context, templateOwnerRep, incomingGuid, maxRetries = 3) {
        let lastError;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await this.triggerWorkflow(context, templateOwnerRep, incomingGuid);
            } catch (err) {
                lastError = err;
                this.context.log(`Attempt ${attempt} failed: ${err.message}`);
                if (attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, 1000 * attempt)); // Exponential backoff
                }
            }
        }
        throw lastError;
    }

}

module.exports = { getOSSFScore };