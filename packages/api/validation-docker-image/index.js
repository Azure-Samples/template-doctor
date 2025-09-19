const crypto = require('crypto');
const { triggerWorkflow } = require('../action-trigger/index');
const { getWorkflowRunData } = require('../action-run-status/index');
const { getArtifactsForRun } = require('../action-run-artifacts/index');
const { extractTrivyResults, processTrivyResultsDetails } = require('./trivy-utils');

const workflowOwner = process.env.GITHUB_REPO_OWNER || "Template-Doctor";
const workflowRepo = process.env.GITHUB_REPO_NAME || "template-doctor";
const workflowFile = process.env.GITHUB_WORKFLOW_FILE || "validate-docker-images.yml";
const gitHubApiVersion = "2022-11-28"; // GitHub API version for headers
const fetchTimeout = 30000; // 30 seconds for fetch requests

function createGitHubHeaders() {

  const workflowToken = process.env.GH_WORKFLOW_TOKEN;
  if (!workflowToken) throw new Error("Missing GH_WORKFLOW_TOKEN app setting");

  return {
    "Authorization": `Bearer ${workflowToken}`,
    "Accept": 'application/vnd.github+json',
    "X-GitHub-Api-Version": gitHubApiVersion,
    "Content-Type": "application/json"
  };
}
async function getRepoScanArtifactUrl(artifacts) {
  const repoArtifact = artifacts.find(a => typeof a.name === 'string' && a.name.startsWith('scan-repo-'));
  if (!repoArtifact) {
    throw new Error('No repository scan artifact found');
  }
  return repoArtifact.archive_download_url; // return URL string, not a buffer/promise
}
async function getImageArtifactUrls(artifacts) {
  const imageArtifacts = artifacts.filter(a => typeof a.name === 'string' && a.name.startsWith('scan-image-'));
  if (!imageArtifacts || imageArtifacts.length === 0) {
    return [];
  }
  return imageArtifacts.map(a => a.archive_download_url);
}
async function getZipAsBuffer(downloadUrl, context = null) {
  try {
    const response = await fetchWithGitHubAuth(downloadUrl, {
      method: 'GET',
      redirect: 'manual' // we want to handle the redirect ourselves
    }, context);

    // If GitHub returned a redirect, follow it manually WITHOUT Authorization
    if (response.status === 302 || response.status === 301 || response.status === 307 || response.status === 308) {
      const location = response.headers.get('location');
      if (!location) {
        const error = new Error('Redirected but no Location header');
        error.context = {
          status: response.status,
          statusText: response.statusText,
          downloadUrl,
          headers: Array.from(response.headers.entries()).reduce((obj, [key, value]) => {
            obj[key] = value;
            return obj;
          }, {})
        };
        throw error;
      }

      context.log(`Following redirect to zip file`, {
        operation: 'getZipAsBuffer',
        originalUrl: downloadUrl,
        redirectUrl: location
      });

      const fileResp = await fetch(location, {
        method: 'GET',
        headers: {
          // do NOT include Authorization here
          Accept: 'application/octet-stream'
        },
        signal: AbortSignal.timeout(fetchTimeout)
      });
      if (!fileResp.ok) {
        let errorDetails = '';
        try {
          errorDetails = await fileResp.text();
        } catch (e) {
          errorDetails = 'Could not read response body';
        }

        const error = new Error(`Failed to download artifact from storage: ${fileResp.status} ${fileResp.statusText}`);
        throw error;
      }

      // return binary data (ArrayBuffer) so caller can save/unzip
      const zipFilebuffer = await fileResp.arrayBuffer();
      return zipFilebuffer;
    } else if (response.status > 399) {
      throw new Error(`Failed to get artifact zip from download URL: ${response.status} ${response.statusText}`);
    } else {
      if (response.ok) {
        // may be JSON or binary depending on response; return ArrayBuffer for binary safety
        return await response.arrayBuffer();
      } else {
        throw new Error(`Unexpected response when fetching artifact: ${response.status} ${response.statusText}`);
      }
    }
  } catch (err) {
    if (context && context.log && context.log.error) {
      context.log.error(`Error downloading artifact`, {
        operation: 'getZipAsBuffer',
        downloadUrl,
        error: err.message,
        stack: err.stack
      });
    }
    throw err; // rethrow so caller can handle
  }
}
async function fetchWithGitHubAuth(url, options = {}, context = null) {
  const requestOptions = {
    ...options,
    headers: {
      ...createGitHubHeaders(),
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(options.timeout || fetchTimeout)
  };

  if (context && context.log) {
    context.log(`Making GitHub API request`, {
      operation: 'fetchWithGitHubAuth',
      url,
      method: options.method || 'GET'
    });
  }

  try {
    return await fetch(url, requestOptions);
  } catch (err) {
    if (context && context.log && context.log.error) {
      context.log.error(`Error in GitHub API request`, {
        operation: 'fetchWithGitHubAuth',
        url,
        method: options.method || 'GET',
        error: err.message,
        stack: err.stack
      });
    }
    throw err;
  }
}

async function processRepoArtifact(context, artifacts, correlationId = null, includeAllDetails = false) {
  const repoUrl = await getRepoScanArtifactUrl(artifacts);
  const buffer = await getZipAsBuffer(repoUrl, context);
  const repoScanJsonResult = await extractTrivyResults(context, buffer, correlationId);

  const repoTrivyResults = processTrivyResultsDetails(repoScanJsonResult, includeAllDetails);
  return repoTrivyResults;
}
/**
 * Processes image artifacts from a workflow run, downloading and analyzing them in chunks
 * to prevent memory issues with large datasets
 * 
 * @param {Object} context - Azure Functions context for logging
 * @param {Object} artifacts - Artifacts object containing artifact information 
 * @param {string} [correlationId=null] - Optional correlation ID for tracing
 * @param {boolean} [includeAllDetails=false] - Whether to include all details in results
 * @param {Object} [options] - Additional processing options
 * @param {number} [options.chunkSize=3] - Number of images to process in each chunk
 * @returns {Promise<Array>} Array of processed image scan results
 */
async function processImageArtifact(context, artifacts, correlationId = null, includeAllDetails = false, options = {}) {
  const imageUrls = await getImageArtifactUrls(artifacts);
  if (!imageUrls || imageUrls.length === 0) return [];

  const chunkSize = options.chunkSize || 3; // Process 3 images at a time by default
  const allResults = [];
  
  // Log start of processing
  if (context && context.log) {
    context.log(`Processing ${imageUrls.length} image artifacts in chunks of ${chunkSize}`, {
      operation: 'processImageArtifact', 
      imageCount: imageUrls.length,
      chunkSize,
      correlationId
    });
  }

  // Process in chunks to prevent memory issues
  for (let i = 0; i < imageUrls.length; i += chunkSize) {
    const startTime = Date.now();
    const chunk = imageUrls.slice(i, i + chunkSize);
    
    if (context && context.log) {
      context.log(`Processing image chunk ${Math.floor(i/chunkSize) + 1}/${Math.ceil(imageUrls.length/chunkSize)}`, {
        operation: 'processImageArtifact',
        chunkStart: i,
        chunkSize: chunk.length,
        correlationId
      });
    }
    
    try {
      // Start all downloads in this chunk concurrently
      const downloadPromises = chunk.map(url => getZipAsBuffer(url, context));
      const buffers = await Promise.all(downloadPromises);
      
      // Extract and process each buffer in this chunk
      const extractPromises = buffers.map(buf => extractTrivyResults(context, buf, correlationId));
      const chunkJsonResults = await Promise.all(extractPromises);
      
      // Process details for each result in this chunk
      const chunkProcessedResults = chunkJsonResults.map(r => processTrivyResultsDetails(r, includeAllDetails));
      
      // Add to overall results
      allResults.push(...chunkProcessedResults);
      
      if (context && context.log) {
        context.log(`Completed processing image chunk ${Math.floor(i/chunkSize) + 1}`, {
          operation: 'processImageArtifact',
          chunkProcessingTimeMs: Date.now() - startTime,
          resultsCount: chunkProcessedResults.length,
          correlationId
        });
      }
    } catch (err) {
      // Log error but continue with other chunks
      if (context && context.log && context.log.error) {
        context.log.error(`Error processing image chunk ${Math.floor(i/chunkSize) + 1}`, {
          operation: 'processImageArtifact',
          error: err.message,
          stack: err.stack,
          chunkStart: i,
          chunkSize: chunk.length,
          correlationId
        });
      }
      // Continue with next chunk rather than failing the entire operation
    }
  }
  
  return allResults;
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

/**
 * Processes repository and image scan artifacts, mutating the provided issues and compliance arrays.
 *
 * @async
 * @param {Object} context - The context object containing environment and configuration.
 * @param {Object} artifactsObj - The object containing an `artifacts` array to process.
 * @param {?string} [correlationId=null] - Optional correlation ID for tracing/logging.
 * @param {boolean} [includeAllDetails=false] - Whether to include all details in the results.
 * @param {Array} [issues=[]] - Array to which issues will be added (mutated).
 * @param {Array} [compliance=[]] - Array to which compliance items will be added (mutated).
 * @returns {Promise<Object>} An object containing processed scan results, e.g.:
 *   {
 *     repoScanResult: <Object|null>,
 *     imageScanResults: <Array>,
 *     issues: <Array>,
 *     compliance: <Array>
 *   }
 * @throws {Error} If no artifacts are provided for processing.
 * @sideEffects Mutates the `issues` and `compliance` arrays passed as arguments.
 */
async function processArtifacts(context, artifactsObj, correlationId = null, includeAllDetails = false, issues = [], compliance = []) {
  const artifacts = artifactsObj && artifactsObj.artifacts ? artifactsObj.artifacts : null;

  if (!artifacts || !Array.isArray(artifacts) || artifacts.length === 0) {
    throw new Error('No artifacts provided for processing');
  }

  // Repo scan
  const repoScanResult = await processRepoArtifact(context, artifacts, correlationId, includeAllDetails);

  // Images
  const imageScanResults = await processImageArtifact(context, artifacts, correlationId, includeAllDetails);

  // Add compliance items based on scan results
  if (repoScanResult) {
    // Check for critical vulnerabilities in repository
    if (repoScanResult.criticalVulns > 0) {
      addIssue(issues, 'docker-repo-critical-vulnerabilities', 'error', 
        `Repository contains ${repoScanResult.criticalVulns} critical vulnerabilities`, 
        { count: repoScanResult.criticalVulns });
    } else {
      compliance.push({
        id: 'docker-repo-no-critical-vulnerabilities',
        category: 'security',
        message: 'Repository contains no critical vulnerabilities',
        details: { repositoryScan: true }
      });
    }

    // Check for high vulnerabilities in repository
    if (repoScanResult.highVulns > 0) {
      addIssue(issues, 'docker-repo-high-vulnerabilities', 'warning', 
        `Repository contains ${repoScanResult.highVulns} high vulnerabilities`, 
        { count: repoScanResult.highVulns });
    } else {
      compliance.push({
        id: 'docker-repo-no-high-vulnerabilities',
        category: 'security',
        message: 'Repository contains no high vulnerabilities',
        details: { repositoryScan: true }
      });
    }

    // Check for critical misconfigurations in repository
    if (repoScanResult.criticalMisconfigurations > 0) {
      addIssue(issues, 'docker-repo-critical-misconfigurations', 'error', 
        `Repository contains ${repoScanResult.criticalMisconfigurations} critical misconfigurations`, 
        { count: repoScanResult.criticalMisconfigurations });
    } else {
      compliance.push({
        id: 'docker-repo-no-critical-misconfigurations',
        category: 'security',
        message: 'Repository contains no critical misconfigurations',
        details: { repositoryScan: true }
      });
    }

    // Check for secrets in repository
    if (repoScanResult.secretsFound > 0) {
      addIssue(issues, 'docker-repo-secrets-found', 'error', 
        `Repository contains ${repoScanResult.secretsFound} secrets that should be removed`, 
        { count: repoScanResult.secretsFound });
    } else {
      compliance.push({
        id: 'docker-repo-no-secrets',
        category: 'security',
        message: 'Repository contains no exposed secrets',
        details: { repositoryScan: true }
      });
    }
  }

  // Process each Docker image scan
  if (imageScanResults && imageScanResults.length > 0) {
    // Track if any images have issues
    let hasCriticalVulns = false;
    let hasHighVulns = false;
    let hasCriticalMisconfigs = false;
    let hasSecrets = false;

    // Check each image
    imageScanResults.forEach((imageScan, index) => {
      // Check for critical vulnerabilities in image
      if (imageScan.criticalVulns > 0) {
        hasCriticalVulns = true;
        addIssue(issues, `docker-image-${index}-critical-vulnerabilities`, 'error', 
          `Docker image ${imageScan.artifactName || `#${index+1}`} contains ${imageScan.criticalVulns} critical vulnerabilities`, 
          { count: imageScan.criticalVulns, artifactName: imageScan.artifactName, repository: imageScan.repository, tag: imageScan.tag });
      }

      // Check for high vulnerabilities in image
      if (imageScan.highVulns > 0) {
        hasHighVulns = true;
        addIssue(issues, `docker-image-${index}-high-vulnerabilities`, 'warning', 
          `Docker image ${imageScan.artifactName || `#${index+1}`} contains ${imageScan.highVulns} high vulnerabilities`, 
          { count: imageScan.highVulns, artifactName: imageScan.artifactName, repository: imageScan.repository, tag: imageScan.tag });
      }

      // Check for critical misconfigurations in image
      if (imageScan.criticalMisconfigurations > 0) {
        hasCriticalMisconfigs = true;
        addIssue(issues, `docker-image-${index}-critical-misconfigurations`, 'error', 
          `Docker image ${imageScan.artifactName || `#${index+1}`} contains ${imageScan.criticalMisconfigurations} critical misconfigurations`, 
          { count: imageScan.criticalMisconfigurations, artifactName: imageScan.artifactName, repository: imageScan.repository, tag: imageScan.tag });
      }

      // Check for secrets in image
      if (imageScan.secretsFound > 0) {
        hasSecrets = true;
        addIssue(issues, `docker-image-${index}-secrets-found`, 'error', 
          `Docker image ${imageScan.artifactName || `#${index+1}`} contains ${imageScan.secretsFound} secrets that should be removed`, 
          { count: imageScan.secretsFound, artifactName: imageScan.artifactName, repository: imageScan.repository, tag: imageScan.tag });
      }
    });

    // Add overall compliance for Docker images
    if (!hasCriticalVulns) {
      compliance.push({
        id: 'docker-images-no-critical-vulnerabilities',
        category: 'security',
        message: 'All Docker images are free of critical vulnerabilities',
        details: { imageCount: imageScanResults.length }
      });
    }

    if (!hasHighVulns) {
      compliance.push({
        id: 'docker-images-no-high-vulnerabilities',
        category: 'security',
        message: 'All Docker images are free of high vulnerabilities',
        details: { imageCount: imageScanResults.length }
      });
    }

    if (!hasCriticalMisconfigs) {
      compliance.push({
        id: 'docker-images-no-critical-misconfigurations',
        category: 'security',
        message: 'All Docker images are free of critical misconfigurations',
        details: { imageCount: imageScanResults.length }
      });
    }

    if (!hasSecrets) {
      compliance.push({
        id: 'docker-images-no-secrets',
        category: 'security',
        message: 'All Docker images are free of exposed secrets',
        details: { imageCount: imageScanResults.length }
      });
    }
  }

  return {
    repositoryScan: repoScanResult,
    imageScans: imageScanResults
  };

}

module.exports = async function (context, req) {
  const correlationId = crypto.randomUUID();

  context.log({
    message: 'Docker image validation request received',
    correlationId,
    method: req.method,
    url: req.url,
    operation: 'validation-docker-image'
  });

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

  try {
    const { templateUrl } = req.body;
    const includeAllDetails = (req.body && req.body.includeAllDetails === true) ? true : false;

    if (!templateUrl) {
      context.log.warn({
        message: 'Validation request missing templateUrl',
        correlationId,
        operation: 'validation-docker-image'
      });

      context.res = {
        status: 400,
        body: {
          error: "templateUrl is required",
          type: "ValidationError"
        }
      };
      return;
    }

    context.log({
      message: 'Starting validation for template',
      correlationId,
      templateUrl,
      operation: 'validation-docker-image'
    });

    const runRequestIdValue = correlationId;
    const [owner, repo] = templateUrl.split('/');

    // Initialize issues and compliance arrays
    const issues = [];
    const compliance = [];

    const triggerWorkflowBody = {
      repoOwner: owner,
      repoName: repo,
      runId: runRequestIdValue
    }

    const triggerResult = await triggerWorkflow(workflowOwner, workflowRepo, workflowFile, triggerWorkflowBody, 'runId', context);

    if (triggerResult.status !== 200 || !triggerResult.found) {
      context.log.error({
        message: 'Failed to trigger workflow',
        correlationId,
        status: triggerResult.status,
        templateUrl,
        operation: 'validation-docker-image'
      });

      addIssue(issues, 'docker-workflow-trigger-failed', 'error', 
        "Failed to trigger Docker image validation workflow", 
        { status: triggerResult.status, error: triggerResult.error || 'Unknown error' });

      context.res = {
        status: triggerResult.status,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: {
          error: "Validation docker image api: Failed to trigger workflow or retrieve run ID",
          type: "WorkflowError",
          issues: issues
        }
      };
      return;
    }

    const runId = triggerResult.runId;
    context.log({
      message: 'Workflow triggered successfully',
      correlationId,
      runId,
      templateUrl,
      operation: 'validation-docker-image'
    });

    // wait until the run is completed
    let run;
    let attempts = 0;
    const maxAttempts = 30; // e.g., wait up to 5 minutes
    const delayMs = 10000; // 10 seconds

    while (attempts < maxAttempts) {
      await new Promise(res => setTimeout(res, delayMs));
      run = await getWorkflowRunData(workflowOwner, workflowRepo, runId, context);

      context.log({
        message: 'Checking workflow status',
        correlationId,
        runId,
        status: run.status,
        attempt: attempts + 1,
        maxAttempts,
        operation: 'validation-docker-image'
      });

      if (run.status === 'completed') break;
      attempts++;
    }

    if (run.status !== 'completed') {
      context.log.error({
        message: 'Workflow did not complete in time',
        correlationId,
        runId,
        status: run.status,
        attempts,
        maxAttempts,
        operation: 'validation-docker-image'
      });

      addIssue(issues, 'docker-workflow-timeout', 'warning', 
        "Docker image validation workflow did not complete in expected time", 
        { attempts, maxAttempts, status: run.status });

      context.res = {
        status: 504,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: {
          error: "Validation docker image api: Workflow run did not complete in expected time",
          type: "TimeoutError",
          issues: issues
        }
      };
      return;
    }

    context.log({
      message: 'Workflow completed, fetching artifacts',
      correlationId,
      runId,
      operation: 'validation-docker-image'
    });

    // get the artifacts data
    const artifacts = await getArtifactsForRun(workflowOwner, workflowRepo, runId, context);

    if (!artifacts || !artifacts.artifacts || artifacts.artifacts.length === 0) {
      context.log.error({
        message: 'No artifacts found from workflow run',
        correlationId,
        runId,
        operation: 'validation-docker-image'
      });

      addIssue(issues, 'docker-artifact-not-found', 'warning', 
        "No artifacts found from Docker image validation workflow run");

      context.res = {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: {
          error: "Validation docker image api: No artifacts found from workflow run",
          type: "ArtifactError",
          issues: issues
        }
      };
      return;
    }

    context.log({
      message: 'Processing artifacts',
      correlationId,
      runId,
      artifactCount: artifacts.artifacts.length,
      operation: 'validation-docker-image'
    });

    // Pass context and correlation ID to processArtifacts along with issues and compliance arrays
    const complianceResults = await processArtifacts(context, artifacts, correlationId, includeAllDetails, issues, compliance);

    context.log({
      message: 'Validation completed successfully',
      correlationId,
      runId,
      operation: 'validation-docker-image'
    });

    const reportableArtifacts = artifacts?.artifacts?.map((artifact) => ({
      name: artifact.name, id: artifact.id, url: artifact.url, download: artifact.archive_download_url
    }));

    context.res = {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: {
        templateUrl,
        runId: runRequestIdValue,
        githubRunId: runId || null,
        githubRunUrl: runId ? `https://github.com/${workflowOwner}/${workflowRepo}/actions/runs/${runId}` : null,
        message: `${workflowFile} workflow triggered; ${runRequestIdValue} run completed`,
        details: {
          complianceResults,
          artifacts: reportableArtifacts || []
        },
        issues,
        compliance
      }
    };
  } catch (err) {
    context.log.error({
      message: 'Error during validation',
      correlationId,
      error: err.message,
      stack: err.stack,
      operation: 'validation-docker-image'
    });

    // Create issues array for the error case
    const issues = [{
      id: 'docker-validation-error',
      severity: 'error',
      message: err.message || "Unknown error occurred during Docker image validation",
      details: {
        type: err.type || "ServerError",
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      }
    }];

    context.res = {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: {
        error: err.message || "Unknown error occurred",
        type: err.type || "ServerError",
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        issues
      }
    };
  }
};