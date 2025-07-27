// GitHub API Client for Template Doctor

class GitHubClient {
    constructor() {
        this.baseUrl = 'https://api.github.com';
        this.graphQLUrl = 'https://api.github.com/graphql';
        this.auth = window.GitHubAuth; // Reference to the auth instance
        this.currentUser = null;
        
        // Wait for DOM to be ready before trying to load user info
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initializeAfterAuth();
            });
        } else {
            // DOM already loaded, initialize now
            this.initializeAfterAuth();
        }
    }
    
    /**
     * Initialize the client after auth is ready
     */
    initializeAfterAuth() {
        console.log('Initializing GitHub client after auth');
        // If auth isn't ready yet, try again in a moment
        if (!this.auth) {
            this.auth = window.GitHubAuth;
            if (!this.auth) {
                console.log('Auth not ready yet, retrying in 500ms');
                setTimeout(() => this.initializeAfterAuth(), 500);
                return;
            }
        }
        
        // Try to load the current user info if authenticated
        this.loadCurrentUser().then(() => {
            // After loading user, check if token has all required scopes
            this.checkTokenScopes().then(scopes => {
                console.log('Current token scopes:', scopes);
                
                // Check if we have the required scopes
                const requiredScopes = ['public_repo'];
                const hasRequiredScopes = requiredScopes.some(scope => 
                    scopes.includes(scope) || 
                    scopes.includes('repo') // Full 'repo' scope would also work
                );
                
                if (!hasRequiredScopes && this.auth.isAuthenticated()) {
                    console.warn('Token missing required scopes, showing warning');
                    
                    // Show a notification after a short delay
                    setTimeout(() => {
                        if (window.NotificationSystem) {
                            window.NotificationSystem.showWarning(
                                'Limited GitHub Access',
                                'Your GitHub authorization is missing the "public_repo" permission that is required to create issues. ' +
                                'If you encounter permission errors, please log out and log back in.',
                                10000,
                                {
                                    actions: [
                                        {
                                            label: 'Log Out Now',
                                            onClick: () => {
                                                if (this.auth) this.auth.logout();
                                            },
                                            primary: true
                                        }
                                    ]
                                }
                            );
                        }
                    }, 2000);
                }
            }).catch(err => {
                console.error('Error checking token scopes:', err);
            });
        });
    }
    
    /**
     * Load current authenticated user info
     */
    async loadCurrentUser() {
        console.log('Loading current user, auth state:', this.auth ? 'Auth exists' : 'No auth');
        
        if (this.auth && this.auth.isAuthenticated()) {
            console.log('User is authenticated, getting user info');
            try {
                this.currentUser = await this.getAuthenticatedUser();
                console.log('Loaded current user:', this.currentUser.login);
            } catch (err) {
                console.error('Failed to load current user:', err);
                // If we get a 401, the token might be invalid
                if (err.status === 401 && this.auth) {
                    console.log('Token appears invalid, logging out');
                    this.auth.logout();
                }
            }
        } else {
            console.log('User is not authenticated or auth not available');
        }
    }

    /**
     * Make a request to the GitHub API
     * @param {string} path - The API endpoint path
     * @param {Object} options - Fetch options
     * @returns {Promise} - The fetch promise
     */
    async request(path, options = {}) {
        console.log(`[GitHubClient] Making request to: ${path}`);
        const token = this.auth.getAccessToken();
        if (!token) {
            console.error('[GitHubClient] Not authenticated, no token available');
            throw new Error('Not authenticated');
        }

        const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `token ${token}`,
            ...(options.headers || {})
        };

        const requestOptions = {
            ...options,
            headers
        };

        console.log(`[GitHubClient] Sending request to: ${url}`, {
            method: requestOptions.method || 'GET',
            hasToken: !!token
        });

        try {
            const response = await fetch(url, requestOptions);
            console.log(`[GitHubClient] Response received: ${response.status} ${response.statusText}`);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error(`[GitHubClient] Error response:`, errorData);
                const error = new Error(
                    errorData.message || `GitHub API error: ${response.status} ${response.statusText}`
                );
                error.status = response.status;
                error.response = response;
                error.data = errorData;
                throw error;
            }

            const data = await response.json();
            console.log(`[GitHubClient] Response data received:`, {
                type: Array.isArray(data) ? 'array' : typeof data,
                length: Array.isArray(data) ? data.length : (data ? Object.keys(data).length : 0)
            });
            return data;
        } catch (err) {
            console.error(`[GitHubClient] Request failed:`, err);
            throw err;
        }
    }

    /**
     * Make a GraphQL request to GitHub API
     * @param {string} query - The GraphQL query
     * @param {Object} variables - Query variables
     * @returns {Promise} - The query result
     */
    async graphql(query, variables = {}) {
        console.log('Making GraphQL request with variables:', variables);
        
        // First, let's check what scopes we currently have
        const scopes = await this.checkTokenScopes();
        console.log('Current token scopes before GraphQL request:', scopes);
        
        const token = this.auth.getAccessToken();
        if (!token) {
            console.error('No token available for GraphQL request');
            if (window.Notifications) {
                window.Notifications.error('Authentication Error', 'You need to be logged in to perform this action.');
            }
            throw new Error('Not authenticated');
        }

        try {
            console.log('Sending GraphQL request to:', this.graphQLUrl);
            console.log('GraphQL query:', query);
            
            const response = await fetch(this.graphQLUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `token ${token}`
                },
                body: JSON.stringify({
                    query,
                    variables
                })
            });
            
            console.log('GraphQL response status:', response.status);
            // Log headers for debugging
            const headers = {};
            response.headers.forEach((value, key) => {
                headers[key] = value;
            });
            console.log('GraphQL response headers:', headers);

            const result = await response.json();
            console.log('GraphQL response:', result);
            
            if (result.errors) {
                const errorMessage = result.errors[0].message;
                console.error('GraphQL Error (full):', result.errors);
                
                // Log each error separately with detailed information
                result.errors.forEach((error, index) => {
                    console.error(`GraphQL Error #${index + 1}:`, {
                        message: error.message,
                        type: error.type || 'Not specified',
                        path: error.path || 'Not specified',
                        locations: error.locations || 'Not specified',
                        extensions: error.extensions || 'Not specified'
                    });
                    
                    // Check for specific extension data that might have more info
                    if (error.extensions) {
                        console.error(`GraphQL Error #${index + 1} Extensions:`, error.extensions);
                    }
                });
                
                // Check for specific error types
                if (errorMessage.includes('scope') || errorMessage.includes('permission')) {
                    console.error('Permission/scope error detected in GraphQL response');
                    
                    // Get detailed token information
                    const tokenInfo = { scopes: await this.checkTokenScopes() };
                    console.log('Current token information:', tokenInfo);
                    
                    // Log detailed diagnostic information about the error
                    console.log('Error diagnostic info:', {
                        errorContainsScope: errorMessage.includes('scope'),
                        errorContainsPermission: errorMessage.includes('permission'),
                        errorContainsResource: errorMessage.includes('resource'),
                        errorContainsRepository: errorMessage.includes('repository'),
                        errorContainsAccess: errorMessage.includes('access'),
                        publicRepoScope: tokenInfo.scopes.includes('public_repo'),
                        repoScope: tokenInfo.scopes.includes('repo'),
                        fullErrorText: errorMessage
                    });
                    
                    if (window.NotificationSystem) {
                        window.NotificationSystem.showError(
                            'Permission Error', 
                            `Your GitHub token does not have the "public_repo" permission required to create issues. Please log out and log back in to grant this permission.<br><br>
                            <strong>Current Scopes:</strong> ${tokenInfo.scopes.join(', ') || 'None'}<br>
                            <strong>Error:</strong> ${errorMessage}`,
                            15000,
                            {
                                actions: [
                                    {
                                        label: 'Log Out Now',
                                        onClick: () => {
                                            if (this.auth) {
                                                console.log('Logging out user from permission error action');
                                                this.auth.logout();
                                            }
                                        },
                                        primary: true
                                    }
                                ]
                            }
                        );
                    }
                }
                
                const error = new Error('GraphQL Error: ' + errorMessage);
                error.errors = result.errors;
                throw error;
            }

            return result.data;
        } catch (error) {
            console.error('GraphQL request failed:', error);
            if (!error.errors && window.Notifications) {
                window.Notifications.error('Request Failed', 'Failed to communicate with GitHub API. Please try again later.');
            }
            throw error;
        }
    }

    /**
     * Search for repositories
     * @param {string} query - Search query
     * @param {number} page - Page number
     * @param {number} perPage - Results per page
     * @returns {Promise} - Search results
     */
    async searchRepositories(query, page = 1, perPage = 10) {
        if (!query) return { items: [] };
        
        const searchQuery = encodeURIComponent(`${query} in:name,description,readme`);
        return this.request(`/search/repositories?q=${searchQuery}&page=${page}&per_page=${perPage}`);
    }

    /**
     * Get repository details
     * @param {string} owner - Repository owner
     * @param {string} repo - Repository name
     * @returns {Promise} - Repository details
     */
    async getRepository(owner, repo) {
        return this.request(`/repos/${owner}/${repo}`);
    }

    /**
     * List files in a repository
     * @param {string} owner - Repository owner
     * @param {string} repo - Repository name
     * @param {string} path - Path within the repository (optional)
     * @returns {Promise} - List of files
     */
    async listRepoFiles(owner, repo, path = '') {
        return this.request(`/repos/${owner}/${repo}/contents/${path}`);
    }

    /**
     * Get the content of a file
     * @param {string} owner - Repository owner
     * @param {string} repo - Repository name
     * @param {string} path - File path
     * @returns {Promise} - File content
     */
    async getFileContent(owner, repo, path) {
        const response = await this.request(`/repos/${owner}/${repo}/contents/${path}`);
        if (response.encoding === 'base64') {
            return atob(response.content); // Decode base64
        }
        throw new Error('Unsupported encoding');
    }

    /**
     * Get the default branch of a repository
     * @param {string} owner - Repository owner
     * @param {string} repo - Repository name
     * @returns {Promise<string>} - Default branch name
     */
    async getDefaultBranch(owner, repo) {
        const repoInfo = await this.getRepository(owner, repo);
        return repoInfo.default_branch;
    }

    /**
     * List all files in a repository recursively
     * @param {string} owner - Repository owner
     * @param {string} repo - Repository name
     * @param {string} ref - Git reference (branch, commit, or tag)
     * @returns {Promise<Array<string>>} - List of file paths
     */
    async listAllFiles(owner, repo, ref = 'HEAD') {
        const response = await this.request(`/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`);
        return response.tree
            .filter(item => item.type === 'blob')
            .map(item => item.path);
    }

    /**
     * Create an issue in a repository
     * @param {string} owner - Repository owner
     * @param {string} repo - Repository name
     * @param {string} title - Issue title
     * @param {string} body - Issue body
     * @param {Array<string>} labels - Issue labels
     * @returns {Promise} - Created issue
     */
    async createIssue(owner, repo, title, body, labels = []) {
        return this.request(`/repos/${owner}/${repo}/issues`, {
            method: 'POST',
            body: JSON.stringify({
                title,
                body,
                labels
            })
        });
    }

    /**
     * Get a repository's node_id by owner/name
     * @param {string} owner
     * @param {string} name
     * @returns {Promise<string>} - The repo node_id
     */
    async getRepoNodeId(owner, name) {
        const query = `query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { id } }`;
        const data = await this.graphql(query, { owner, name });
        return data.repository.id;
    }

    /**
     * Get label node_ids by name for a repo
     * @param {string} owner
     * @param {string} name
     * @param {Array<string>} labelNames
     * @returns {Promise<Array<string>>}
     */
    async getLabelNodeIds(owner, name, labelNames) {
        if (!labelNames || labelNames.length === 0) return [];
        const query = `query($owner: String!, $name: String!) {
            repository(owner: $owner, name: $name) {
                labels(first: 20) { nodes { id name } }
            }
        }`;
        const data = await this.graphql(query, { owner, name });
        const allLabels = data.repository.labels.nodes;
        return labelNames.map(label => {
            const found = allLabels.find(l => l.name === label);
            return found ? found.id : null;
        }).filter(Boolean);
    }

    /**
     * Create an issue using GraphQL and assign to the Copilot agent
     * @param {string} owner
     * @param {string} repo
     * @param {string} title
     * @param {string} body
     * @param {Array<string>} labelNames
     * @returns {Promise<Object>} - Created issue info
     */
    async createIssueGraphQL(owner, repo, title, body, labelNames = []) {
        console.log(`Creating GitHub issue via GraphQL for ${owner}/${repo}`);
        
        try {
            // First check token permissions
            const scopes = await this.checkTokenScopes();
            console.log('Current token scopes for issue creation:', scopes);
            
            if (!scopes.includes('public_repo') && !scopes.includes('repo')) {
                console.error('Missing required scopes for issue creation');
                throw new Error('Your GitHub token does not have the "public_repo" permission required to create issues');
            }
            
            // Get repository ID
            console.log('Getting repository ID');
            let repoId;
            
            try {
                repoId = await this.getRepoNodeId(owner, repo);
                console.log('Repository ID:', repoId);
            } catch (error) {
                console.error('Error getting repository node ID:', error);
                throw new Error(`Could not find repository: ${owner}/${repo}`);
            }
            
            // Get label IDs
            let labelIds = [];
            try {
                labelIds = await this.getLabelNodeIds(owner, repo, labelNames);
                console.log('Label IDs:', labelIds);
            } catch (error) {
                console.error('Error getting label IDs:', error);
                // Continue without labels
            }
            
            // First create the issue without assignment (we'll assign it in a separate step)
            const createMutation = `mutation CreateIssue($repositoryId: ID!, $title: String!, $body: String, $labelIds: [ID!]) {
                createIssue(input: {
                    repositoryId: $repositoryId,
                    title: $title,
                    body: $body,
                    labelIds: $labelIds
                }) {
                    issue { 
                        id 
                        number 
                        url 
                        title
                    }
                }
            }`;
            
            const variables = {
                repositoryId: repoId,
                title,
                body,
                labelIds
            };
            
            console.log('Creating issue without assignment first');
            const data = await this.graphql(createMutation, variables);
            
            console.log('Issue created successfully:', data.createIssue.issue);
            
            // Now try to assign the issue to the Copilot agent
            try {
                const issueId = data.createIssue.issue.id;
                const issueNumber = data.createIssue.issue.number;
                
                // Using the REST API to assign the Copilot agent with @ prefix
                console.log(`Attempting to assign issue #${issueNumber} to @copilot-agent-swe using REST API...`);
                
                const response = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/issues/${issueNumber}/assignees`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `token ${this.auth.getAccessToken()}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        assignees: ["@copilot-agent-swe"]  // Using the @ prefix as per GitHub docs
                    })
                });
                
                if (response.ok) {
                    const responseData = await response.json();
                    console.log('✅ Successfully assigned issue to Copilot:', responseData);
                } else {
                    const errorText = await response.text();
                    console.warn(`❌ Could not assign issue to Copilot (status ${response.status}):`, errorText);
                }
            } catch (assignError) {
                console.error('Error assigning issue to Copilot:', assignError);
                // Continue even if assignment fails - the issue was created
            }
            
            return data.createIssue.issue;
        } catch (error) {
            console.error('Error creating issue via GraphQL:', error);
            throw error;
        }
    }

    /**
     * Find existing issues by title and label (optional)
     * @param {string} owner
     * @param {string} repo
     * @param {string} title
     * @param {string} labelName
     * @returns {Promise<Array>} - Array of matching issues
     */
    async findIssuesByTitle(owner, repo, title, labelName) {
        // We'll filter by title client-side after getting the issues
        const query = `query($owner: String!, $name: String!) {
            repository(owner: $owner, name: $name) {
                issues(first: 20, states: [OPEN, CLOSED], filterBy: { since: "2022-01-01T00:00:00Z" }) {
                    nodes {
                        id number title url state labels(first: 10) { nodes { name } }
                    }
                }
            }
        }`;
        const data = await this.graphql(query, { owner, name: repo });
        
        // Log the returned issues for debugging
        console.log(`Found ${data.repository.issues.nodes.length} issues in repository, filtering for title match`);
        
        return data.repository.issues.nodes.filter(issue => {
            const titleMatch = issue.title === title;
            const labelMatch = !labelName || issue.labels.nodes.some(l => l.name === labelName);
            return titleMatch && labelMatch;
        });
    }
    
    /**
     * Get the currently authenticated user
     * @returns {Promise<Object>} - User info
     */
    async getAuthenticatedUser() {
        return this.request('/user');
    }
    
    /**
     * Check the scopes of the current token
     * @returns {Promise<Array<string>>} - Array of scopes
     */
    async checkTokenScopes() {
        try {
            const token = this.auth.getAccessToken();
            if (!token) {
                console.log('No token available to check scopes');
                return [];
            }
            
            console.log('Checking token scopes...');
            console.log('Token first 10 chars:', token.substring(0, 10) + '...');
            
            const response = await fetch(`${this.baseUrl}/user`, {
                headers: {
                    'Authorization': `token ${token}`
                }
            });
            
            // Log detailed information about the response
            console.log('Token check response status:', response.status, response.statusText);
            console.log('Token check response type:', response.type);
            console.log('Token check response URL:', response.url);
            
            // Log all headers for debugging
            const headers = {};
            response.headers.forEach((value, key) => {
                headers[key] = value;
            });
            console.log('Response headers (full):', headers);
            
            // The scopes are in the 'X-OAuth-Scopes' header
            const scopesHeader = response.headers.get('X-OAuth-Scopes');
            console.log('X-OAuth-Scopes header (direct):', scopesHeader);
            
            // Also check other authorization headers
            console.log('Authorization headers:', {
                'X-OAuth-Scopes': response.headers.get('X-OAuth-Scopes'),
                'X-Accepted-OAuth-Scopes': response.headers.get('X-Accepted-OAuth-Scopes'),
                'X-GitHub-Request-Id': response.headers.get('X-GitHub-Request-Id')
            });
            
            // Clone and log response body for more debug information
            const clonedResponse = response.clone();
            clonedResponse.json().then(data => {
                console.log('User response data:', data);
                if (data && data.login) {
                    console.log('Authenticated as:', data.login);
                }
            }).catch(e => console.log('Could not parse response as JSON:', e));
            
            if (!scopesHeader) {
                console.warn('No X-OAuth-Scopes header found in response');
                return [];
            }
            
            // Parse the scopes header which is a comma-separated list
            const scopes = scopesHeader.split(',').map(scope => scope.trim());
            console.log('Parsed scopes (array):', scopes);
            
            // Additional helpful debug info
            if (scopes.includes('public_repo')) {
                console.log('✅ Token has public_repo scope');
            } else if (scopes.includes('repo')) {
                console.log('✅ Token has full repo scope');
            } else {
                console.warn('⚠️ Token does not have public_repo or repo scope');
                console.log('Missing public_repo scope may cause issue creation to fail');
            }
            
            return scopes;
        } catch (error) {
            console.error('Error checking token scopes:', error);
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            return [];
        }
    }
    
    /**
     * Check if a user is a collaborator on a repository
     * @param {string} owner - Repository owner
     * @param {string} repo - Repository name
     * @param {string} username - GitHub username
     * @returns {Promise<boolean>} - Whether the user is a collaborator
     */
    async isUserCollaborator(owner, repo, username) {
        console.log(`Checking if ${username} is a collaborator on ${owner}/${repo}`);
        try {
            const response = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/collaborators/${username}`, {
                headers: {
                    'Authorization': `token ${this.auth.getAccessToken()}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            console.log(`Collaborator check status: ${response.status}`);
            // 204 means the user is a collaborator
            return response.status === 204;
        } catch (error) {
            console.error(`Error checking if ${username} is a collaborator:`, error);
            return false;
        }
    }
    
    /**
     * Fork a repository to the user's account
     * @param {string} owner - Repository owner
     * @param {string} repo - Repository name
     * @returns {Promise<Object>} - Forked repository info
     */
    async forkRepository(owner, repo) {
        return this.request(`/repos/${owner}/${repo}/forks`, {
            method: 'POST'
        });
    }
}

// Create and export the GitHub client instance
const githubClient = new GitHubClient();
window.GitHubClient = githubClient;
