const pollingTimeout = 120000; // 2 minutes in ms
const pollingInterval = 10000; // 10 seconds in ms
const gitHubApiVersion = "2022-11-28"; // GitHub API version for headers
const fetchTimeout = 30000; // 30 seconds for fetch requests
const initialDelayAfterTrigger = 3000; // 3 seconds initial delay after workflow trigger
const maxPollingDelay = 30000; // Maximum polling delay (30 seconds)
const jitterFactor = 0.2; // 20% jitter for exponential backoff
const backoffMultiplier = 1.5; // Multiplier for exponential backoff
const retryDelayMultiplier = 1000; // Base milliseconds for retry (1 second)

/**
 * Creates standard GitHub API headers
 * @param {string} token - GitHub API token
 * @returns {Object} - Headers object for GitHub API requests
 */
function createGitHubHeaders(token) {
    return {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        "X-GitHub-Api-Version": gitHubApiVersion
    };
}

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
    } else if (arguments.length > 4 && arguments[4] !== null) {
        issue.error = arguments[4];
    }
    
    issues.push(issue);
}

async function getOSSFScore(context, workflowToken, workflowUrl, workflowFile, templateOwnerRepo, requestGuid, minScore, issues, compliance) {

    context.log(`Minimum score: ${minScore.toFixed(1)}`); // This will log "7.0"

    if (!workflowToken || typeof workflowToken !== 'string') {
        addIssue(issues, 'ossf-score-invalid-workflow-token', 'warning', 'Invalid workflow token for OSSF score.');
        return;
    }
    if (!workflowUrl || typeof workflowUrl !== 'string' || workflowUrl.indexOf('/') === -1) {
        addIssue(issues, 'ossf-score-invalid-workflow-repo', 'warning', 'Invalid workflow URL for OSSF score. Use owner/repo format.');
        return;
    }

    if (!workflowFile || typeof workflowFile !== 'string') {
        addIssue(issues, 'ossf-score-invalid-workflow-file', 'warning', 'Invalid workflow file for OSSF score. ');
        return;
    }

    // templateOwnerRepo should be in the form 'owner/repo'
    if (!templateOwnerRepo || typeof templateOwnerRepo !== 'string' || templateOwnerRepo.indexOf('/') === -1) {
        addIssue(issues, 'ossf-score-invalid-template-repo', 'warning', 'Invalid template repo string for OSSF score. Use owner/repo format.');
        return;
    }

    if (!requestGuid || typeof requestGuid !== 'string') {
        addIssue(issues, 'ossf-score-invalid-request-guid', 'warning', 'Invalid request GUID for OSSF score.');
        return;
    }

    try {
        const client = typeof ScorecardClient !== 'undefined' ? new ScorecardClient(context, undefined, workflowToken, workflowUrl, workflowFile) : null;
        if (!client) {
            addIssue(issues, 'ossf-score-workflow-trigger-failed', 'warning', `ScorecardClient client can't be created`);
            return;
        }

        const triggeredResponse = await client.triggerWorkflow(templateOwnerRepo, requestGuid);
        if (!triggeredResponse || !triggeredResponse.ok) {
            addIssue(issues, 'ossf-score-workflow-trigger-failed', 'warning', 
                `ScorecardClient workflow not triggered. GitHub API response: ${triggeredResponse ? triggeredResponse.status : 'unknown'}`);
            return;
        }

        // delay after workflow trigger - give workflow time to start
        await sleep(initialDelayAfterTrigger);

        // poll github artifacts for repo for up to the polling timeout
        const pollStart = Date.now();
        let runStatus = undefined;
        let attempt = 0;
        while (Date.now() - pollStart < pollingTimeout) {
            runStatus = await client.getArtifactsListItem(requestGuid);
            if (runStatus !== undefined && runStatus !== null) {
                break;
            }
            
            // Calculate delay using exponential backoff with jitter
            attempt++;
            const baseDelay = Math.min(pollingInterval * Math.pow(backoffMultiplier, attempt - 1), maxPollingDelay);
            const jitter = Math.floor(baseDelay * jitterFactor * Math.random());
            const delay = baseDelay + jitter;
            
            context.log(`Waiting for ${templateOwnerRepo} artifact with request GUID: ${requestGuid} (attempt ${attempt}, next retry in ${Math.round(delay/1000)}s)`);
            // wait with exponential backoff before polling again
            await sleep(delay);
        }
        if (!runStatus) {
            addIssue(issues, 'ossf-score-artifact-failed', 'warning', 'Workflow artifact failed for request GUID', 
                { workflowUrl, workflowFile, templateOwnerRepo, requestGuid });
            return;
        }

        // if the run completed but concluded with non-success, record a warning
        if (runStatus && (!runStatus.archive_download_url || runStatus.archive_download_url.length < 5)) {
            addIssue(issues, 'ossf-score-artifact-download-failed', 'warning', 
                `OSSF workflow concluded without finding artifact download URL`, runStatus);
            return;
        }
        const scoreRaw = runStatus.name.split('_score_')[1];
        if (!scoreRaw) {
            addIssue(issues, 'ossf-score-value-not-found', 'warning', 
                `OSSF workflow concluded without finding score value: ${runStatus.url}`, runStatus);
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
            addIssue(issues, 'ossf-score-below-minimum', 'warning', 
                `OSSF workflow concluded with score ${score.toFixed(1)} < ${minScore.toFixed(1)}: ${runStatus.url}`,
                { templateOwnerRepo: templateOwnerRepo, score: score.toFixed(1), minScore: minScore.toFixed(1), artifact: runStatus });
        }


    } catch (err) {
        context.error('Error fetching Scorecard:', err);
        addIssue(issues, 'ossf-score-error', 'warning', 'Failed to fetch OSSF Scorecard', 
                { error: err instanceof Error ? err.message : String(err) });
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
        this.context = context ? context : { log: (str) => { console.log(str) } };
    }

    /**
     * Creates a fetch request with GitHub API headers
     * @param {string} url - The URL to fetch
     * @param {Object} options - Additional fetch options
     * @returns {Promise<Response>} - The fetch response
     */
    async fetchWithGitHubAuth(url, options = {}) {
        const requestOptions = {
            ...options,
            headers: {
                ...createGitHubHeaders(this.token),
                ...(options.headers || {})
            },
            signal: AbortSignal.timeout(options.timeout || fetchTimeout)
        };

        return fetch(url, requestOptions);
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

            const response = await this.fetchWithGitHubAuth(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
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

            const resp = await this.fetchWithGitHubAuth(url);
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
            const response = await this.fetchWithGitHubAuth(downloadUrl, {
                method: 'GET',
                redirect: 'manual' // we want to handle the redirect ourselves
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
                    signal: AbortSignal.timeout(fetchTimeout)
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
     * @param {string} templateOwnerRep - Repository in owner/repo format
     * @param {string} incomingGuid - Unique identifier for this run
     * @param {number} maxRetries - Maximum number of retry attempts
     * @returns {Promise<Response>} - The final response from the workflow trigger
     */
    async triggerWorkflowWithRetry(templateOwnerRep, incomingGuid, maxRetries = 3) {
        let lastError;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await this.triggerWorkflow(templateOwnerRep, incomingGuid);
            } catch (err) {
                lastError = err;
                this.context.log(`Attempt ${attempt} failed: ${err.message}`);
                if (attempt < maxRetries) {
                    await sleep(retryDelayMultiplier * attempt); // Exponential backoff
                }
            }
        }
        throw lastError;
    }

}

module.exports = { getOSSFScore };