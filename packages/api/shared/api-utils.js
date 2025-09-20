/**
 * Utility functions for API modules that handle common retry logic and GitHub API interactions
 */

const gitHubApiVersion = "2022-11-28"; // GitHub API version for headers
const fetchTimeout = 30000; // 30 seconds for fetch requests
const DEFAULT_MAX_ATTEMPTS = 3; // Default number of retry attempts
const DEFAULT_RETRY_DELAY_MS = 5000; // Default delay between retry attempts (5 seconds)

/**
 * Creates GitHub API request headers with authentication token
 * @returns {Object} - GitHub API headers including auth token
 * @throws {Error} - If GH_WORKFLOW_TOKEN environment variable is missing
 */
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

/**
 * Makes a fetch request to GitHub API with authentication headers
 * @param {string} url - The GitHub API endpoint URL
 * @param {Object} options - Fetch options including method, headers, body
 * @param {string} [options.operationName] - Optional name of the operation for logging
 * @param {Object} [context] - Optional Azure Function context for logging
 * @returns {Promise<Response>} - The fetch response
 */
async function fetchWithGitHubAuth(url, options = {}, context = null) {
  // Extract any operation name from options for better logging
  const operationName = options.operationName || 'fetchWithGitHubAuth';
  delete options.operationName; // Remove it from options to not interfere with fetch
  
  return withRetry(
    async () => {
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
          operation: operationName,
          url,
          method: options.method || 'GET'
        });
      }

      try {
        return await fetch(url, requestOptions);
      } catch (err) {
        if (context && context.log && context.log.error) {
          context.log.error(`Error in GitHub API request`, {
            operation: operationName,
            url,
            method: options.method || 'GET',
            error: err.message,
            stack: err.stack
          });
        }
        throw err;
      }
    },
    {
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      delayMs: DEFAULT_RETRY_DELAY_MS,
      context,
      logDetails: {
        operation: operationName,
        url,
        method: options.method || 'GET'
      }
    }
  );
}

/**
 * Executes a function with retry logic
 * @param {Function} asyncFn - The async function to execute and potentially retry
 * @param {Object} options - Configuration options
 * @param {number} [options.maxAttempts=DEFAULT_MAX_ATTEMPTS] - Maximum number of retry attempts
 * @param {number} [options.delayMs=DEFAULT_RETRY_DELAY_MS] - Delay in milliseconds between retry attempts
 * @param {Function} [options.shouldRetry] - Optional function to determine if retry should occur (receives error)
 * @param {Object} [options.context] - Optional Azure Function context for logging
 * @param {Object} [options.logDetails] - Additional details to include in logs
 * @returns {Promise<any>} - The result of the successful function execution
 * @throws {Error} - The last error encountered if all retries fail
 */
async function withRetry(asyncFn, options = {}) {
  const {
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    delayMs = DEFAULT_RETRY_DELAY_MS,
    shouldRetry = () => true, // Default: retry on any error
    context = null,
    logDetails = {}
  } = options;

  const operation = logDetails.operation || 'apiOperation';
  let attemptCount = 0;
  let lastError = null;

  while (attemptCount < maxAttempts) {
    attemptCount++;

    if (context && context.log) {
      context.log(`Executing operation (attempt ${attemptCount}/${maxAttempts})`, {
        operation,
        attempt: attemptCount,
        maxAttempts,
        ...logDetails
      });
    }

    try {
      // Execute the provided async function
      const result = await asyncFn();

      if (context && context.log) {
        context.log(`Operation successful on attempt ${attemptCount}/${maxAttempts}`, {
          operation,
          attempt: attemptCount,
          maxAttempts,
          ...logDetails
        });
      }

      return result;

    } catch (error) {
      lastError = error;

      // Log the error
      if (context && context.log) {
        const logFn = attemptCount < maxAttempts ? context.log.warn || context.log : context.log.error || context.log;
        
        logFn(`Operation failed (attempt ${attemptCount}/${maxAttempts})`, {
          operation,
          attempt: attemptCount,
          maxAttempts,
          error: error.message,
          stack: error.stack,
          ...logDetails
        });
      }

      // Check if we should retry
      if (attemptCount < maxAttempts && shouldRetry(error)) {
        if (context && context.log) {
          context.log(`Waiting ${delayMs}ms before retry...`, {
            operation,
            attempt: attemptCount,
            maxAttempts,
            delayMs,
            ...logDetails
          });
        }
        
        // Wait before the next attempt
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        // Either we've exhausted all attempts or shouldRetry returned false
        throw lastError;
      }
    }
  }

  // This should never be reached due to either returning a result or throwing an error above,
  // but as a safeguard:
  throw lastError || new Error(`Failed operation after ${maxAttempts} attempts`);
}

/**
 * Creates a function to determine if a fetch response should be retried
 * @param {Array<number>} [retryableStatusCodes=[408, 429, 500, 502, 503, 504]] - HTTP status codes that should trigger a retry
 * @returns {Function} - A function that accepts a response and returns true if it should be retried
 */
function createFetchResponseRetryCheck(retryableStatusCodes = [408, 429, 500, 502, 503, 504]) {
  return (errOrResponse) => {
    // If it's a Response object, check the status code
    if (errOrResponse && typeof errOrResponse.status === "number") {
      return retryableStatusCodes.includes(errOrResponse.status);
    }
    // Otherwise, it's likely a network error (TypeError, etc.) -- retry
    return true;
  };
}
/**
 * Wrapper for GitHub API calls with retry logic
 * @param {Function} apiFn - The function that makes the GitHub API call
 * @param {Object} params - Parameters to pass to the API function
 * @param {Object} options - Retry options
 * @param {number} [options.maxAttempts=DEFAULT_MAX_ATTEMPTS] - Maximum number of retry attempts
 * @param {number} [options.delayMs=DEFAULT_RETRY_DELAY_MS] - Delay in milliseconds between retry attempts
 * @returns {Promise<any>} - The result of the successful API call
 */
async function withGitHubApiRetry(apiFn, params, options = {}) {
  const defaultOptions = {
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
    delayMs: DEFAULT_RETRY_DELAY_MS,
    // By default, retry on network errors and common GitHub API error status codes
    shouldRetry: createFetchResponseRetryCheck(),
    ...options
  };

  return withRetry(
    () => apiFn(...params),
    defaultOptions
  );
}

module.exports = {
  withRetry,
  withGitHubApiRetry,
  createFetchResponseRetryCheck,
  createGitHubHeaders,
  fetchWithGitHubAuth
};