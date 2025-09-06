/**
 * Run ID store backed by a runs.json file in the GitHub repo
 *
 * This allows persistence across function restarts without a separate DB.
 */

const OWNER = process.env.GITHUB_REPO_OWNER || 'Template-Doctor';
const REPO = process.env.GITHUB_REPO_NAME || 'template-doctor';
const BRANCH = process.env.GITHUB_REPO_BRANCH || 'main';
const FILE_PATH = 'runs.json';
const TOKEN = process.env.GH_WORKFLOW_TOKEN; // needs repo contents write access

// Setup in-memory fallback storage if token missing
if (!TOKEN) {
  console.warn('Missing GH_WORKFLOW_TOKEN - using in-memory storage only (data will be lost on restart)');
  
  // Initialize fallback storage
  if (!global._localRunStorage) {
    global._localRunStorage = {};
  }
}

const API_BASE = 'https://api.github.com';

/**
 * Get the current runs.json content from GitHub.
 * Returns an object mapping localRunId -> run info.
 */
async function getAllRuns() {
  // If no token available, return empty data with fallback flag
  if (!TOKEN) {
    console.warn('getAllRuns called without a token - using in-memory storage only');
    return { 
      sha: null, 
      data: {}, 
      fallback: true,
      error: 'No GitHub token available'
    };
  }

  const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`;
  try {
    console.log(`Fetching runs.json from ${url}`);
    
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'TemplateDoctorApp'
      },
      timeout: 10000 // 10 second timeout
    });

    if (res.status === 404) {
      // File does not exist yet
      console.log(`${FILE_PATH} not found - will create on first save`);
      return { sha: null, data: {}, fileNotFound: true };
    }

    if (!res.ok) {
      const responseText = await res.text();
      console.error(`Failed to fetch ${FILE_PATH}: ${res.status} ${res.statusText}`);
      console.error(`Response body: ${responseText}`);
      
      // Try to parse error response for more details
      try {
        const errorJson = JSON.parse(responseText);
        console.error(`GitHub API error details: ${JSON.stringify(errorJson)}`);
        
        // Check for specific error conditions
        if (res.status === 401) {
          throw new Error(`GitHub authentication failed: Token is invalid or has expired - ${errorJson.message || ''}`);
        } else if (res.status === 403) {
          throw new Error(`GitHub permission denied: Token lacks required permissions - ${errorJson.message || ''}`);
        } else if (res.status === 404) {
          throw new Error(`GitHub resource not found: The repository or branch might not exist - ${errorJson.message || ''}`);
        }
      } catch (e) {
        // If not JSON or parsing failed, just log and continue
        if (!(e instanceof SyntaxError)) {
          throw e; // Re-throw if it's not a JSON parsing error
        }
      }
      
      throw new Error(`Failed to fetch ${FILE_PATH}: ${res.status} ${res.statusText} - ${responseText}`);
    }

    const json = await res.json();
    const content = Buffer.from(json.content, 'base64').toString('utf8');
    
    try {
      const data = JSON.parse(content || '{}');
      return { sha: json.sha, data };
    } catch (parseError) {
      console.error(`Failed to parse ${FILE_PATH} content: ${parseError.message}`);
      console.error(`Content: ${content.substring(0, 200)}...`); // Log the first 200 chars
      throw new Error(`Failed to parse ${FILE_PATH} content: ${parseError.message}`);
    }
  } catch (error) {
    // Add retry logic or fallback if needed
    console.error(`Error fetching runs.json: ${error.message}`);
    
    // Instead of failing completely, return empty data with error flag
    return { 
      sha: null, 
      data: {}, 
      error: error.message,
      errorTimestamp: new Date().toISOString() 
    };
  }
}

/**
 * Save the runs.json file to GitHub.
 * @param {object} data - JSON object to save.
 * @param {string|null} sha - the current blob SHA, or null to create new.
 */
async function saveRuns(data, sha) {
  const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;
  
  try {
    // Limit the data size to prevent GitHub API issues
    // Perform cleanup of old entries if needed to keep file size reasonable
    const dataEntries = Object.entries(data);
    if (dataEntries.length > 100) {
      // If we have too many entries, sort by updatedAt and keep only the most recent 100
      const sortedEntries = dataEntries.sort((a, b) => {
        const dateA = new Date(a[1].updatedAt || 0);
        const dateB = new Date(b[1].updatedAt || 0);
        return dateB - dateA; // Sort in descending order (newest first)
      });
      
      // Keep only the most recent 100 entries
      const newData = {};
      sortedEntries.slice(0, 100).forEach(([key, value]) => {
        newData[key] = value;
      });
      
      // Use the pruned data
      data = newData;
    }
    
    // Add metadata to track storage operations
    const serializedData = {
      ...data,
      _metadata: {
        lastUpdated: new Date().toISOString(),
        entryCount: Object.keys(data).length
      }
    };
    
    const body = {
      message: `Update runs.json for validation run`,
      content: Buffer.from(JSON.stringify(serializedData, null, 2)).toString('base64'),
      branch: BRANCH
    };
    if (sha) body.sha = sha;

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'TemplateDoctorApp'
      },
      body: JSON.stringify(body),
      timeout: 15000 // 15 second timeout
    });

    if (!res.ok) {
      const responseText = await res.text();
      let errorDetails = responseText;
      
      try {
        // Try to parse JSON error response for more details
        const errorJson = JSON.parse(responseText);
        if (errorJson.message) {
          errorDetails = errorJson.message;
        }
      } catch (e) {
        // If not JSON, use the text as is
      }
      
      throw new Error(`Failed to save ${FILE_PATH}: ${res.status} ${res.statusText} - ${errorDetails}`);
    }
    
    // Return the response data
    const responseData = await res.json();
    return responseData;
  } catch (error) {
    // Log the error but don't block the operation
    console.error(`Error saving runs.json: ${error.message}`);
    
    // For testing - create a local fallback storage in memory
    if (!global._localRunStorage) {
      global._localRunStorage = {};
    }
    
    // Store data in memory as fallback
    // This will be lost on function restart, but allows for the current session to work
    Object.entries(data).forEach(([key, value]) => {
      global._localRunStorage[key] = value;
    });
    
    // Throw a more descriptive error
    throw new Error(`GitHub storage operation failed: ${error.message}. Fallback storage used but data may be lost on restart.`);
  }
}

/**
 * Store a new run ID mapping (creates entry with optional initial data)
 */
async function storeRunIdMapping(localRunId, data = {}) {
  try {
    const { sha, data: runs, error } = await getAllRuns();
    
    // If there was an error fetching, use fallback storage
    if (error) {
      console.warn(`Using fallback storage due to fetch error: ${error}`);
      if (!global._localRunStorage) {
        global._localRunStorage = {};
      }
      
      global._localRunStorage[localRunId] = {
        githubRunId: null,
        githubRunUrl: null,
        status: null,
        result: null,
        templateUrl: null,
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        storageType: 'fallback',
        originalError: error
      };
      return; // Exit without trying to save to GitHub
    }
    
    runs[localRunId] = {
      githubRunId: null,
      githubRunUrl: null,
      status: null,
      result: null,
      templateUrl: null,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      storageType: 'github'
    };
    
    await saveRuns(runs, sha);
  } catch (error) {
    console.error(`Error in storeRunIdMapping: ${error.message}`);
    // Use fallback storage
    if (!global._localRunStorage) {
      global._localRunStorage = {};
    }
    
    global._localRunStorage[localRunId] = {
      githubRunId: null,
      githubRunUrl: null,
      status: null,
      result: null,
      templateUrl: null,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      storageType: 'fallback',
      originalError: error.message
    };
  }
}

/**
 * Update an existing run mapping (merge fields)
 */
async function updateRunIdMapping(localRunId, updates = {}) {
  try {
    // First check if we have this run in fallback storage
    if (global._localRunStorage && global._localRunStorage[localRunId]) {
      global._localRunStorage[localRunId] = {
        ...global._localRunStorage[localRunId],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      return; // Don't try to update GitHub if we're using fallback
    }
    
    const { sha, data: runs, error } = await getAllRuns();
    
    // If there was an error fetching, use fallback storage
    if (error) {
      console.warn(`Using fallback storage due to fetch error: ${error}`);
      if (!global._localRunStorage) {
        global._localRunStorage = {};
      }
      
      global._localRunStorage[localRunId] = {
        githubRunId: null,
        githubRunUrl: null,
        status: null,
        result: null,
        templateUrl: null,
        ...updates,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        storageType: 'fallback',
        originalError: error
      };
      return; // Exit without trying to save to GitHub
    }
    
    const existing = runs[localRunId] || {};
    runs[localRunId] = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await saveRuns(runs, sha);
  } catch (error) {
    console.error(`Error in updateRunIdMapping: ${error.message}`);
    // Use fallback storage
    if (!global._localRunStorage) {
      global._localRunStorage = {};
    }
    
    // If not already in fallback, create it
    if (!global._localRunStorage[localRunId]) {
      global._localRunStorage[localRunId] = {
        githubRunId: null,
        githubRunUrl: null,
        status: null,
        result: null,
        templateUrl: null,
        ...updates,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        storageType: 'fallback',
        originalError: error.message
      };
    } else {
      // Update existing fallback record
      global._localRunStorage[localRunId] = {
        ...global._localRunStorage[localRunId],
        ...updates,
        updatedAt: new Date().toISOString()
      };
    }
  }
}

/**
 * Get mapping for a given localRunId
 */
async function getRunIdMapping(localRunId) {
  try {
    // First check if we have this run in fallback storage
    if (global._localRunStorage && global._localRunStorage[localRunId]) {
      return global._localRunStorage[localRunId];
    }
    
    const { data: runs, error } = await getAllRuns();
    
    // If there was an error fetching but we need this record, log the error
    if (error) {
      console.warn(`Error fetching run data: ${error}`);
    }
    
    return runs[localRunId] || null;
  } catch (error) {
    console.error(`Error in getRunIdMapping: ${error.message}`);
    // Check fallback storage
    if (global._localRunStorage && global._localRunStorage[localRunId]) {
      return global._localRunStorage[localRunId];
    }
    return null;
  }
}

/**
 * List all runs (for debugging)
 */
async function listRunIdMappings() {
  try {
    const { data: runs, error } = await getAllRuns();
    
    // Combine with fallback storage if it exists
    const result = { ...runs };
    
    if (global._localRunStorage) {
      Object.entries(global._localRunStorage).forEach(([key, value]) => {
        if (!result[key]) {
          result[key] = value;
        }
      });
    }
    
    // If there was an error fetching, include it in the response
    if (error) {
      result._error = error;
    }
    
    return result;
  } catch (error) {
    console.error(`Error in listRunIdMappings: ${error.message}`);
    
    // Return at least the fallback storage if available
    if (global._localRunStorage) {
      return {
        _error: error.message,
        _fallbackOnly: true,
        ...global._localRunStorage
      };
    }
    
    // Return an empty object with error if no data available
    return {
      _error: error.message,
      _noDataAvailable: true
    };
  }
}

module.exports = {
  storeRunIdMapping,
  updateRunIdMapping,
  getRunIdMapping,
  listRunIdMappings
};
