// GitHub API Client for Template Doctor

class GitHubClient {
    constructor() {
        this.baseUrl = 'https://api.github.com';
        this.graphQLUrl = 'https://api.github.com/graphql';
        this.auth = window.GitHubAuth; // Reference to the auth instance
        this.currentUser = null;
        
        // Try to load the current user info if authenticated
        this.loadCurrentUser();
    }
    
    /**
     * Load current authenticated user info
     */
    async loadCurrentUser() {
        if (this.auth.isAuthenticated()) {
            try {
                this.currentUser = await this.getAuthenticatedUser();
                console.log('Loaded current user:', this.currentUser.login);
            } catch (err) {
                console.error('Failed to load current user:', err);
            }
        }
    }

    /**
     * Make a request to the GitHub API
     * @param {string} path - The API endpoint path
     * @param {Object} options - Fetch options
     * @returns {Promise} - The fetch promise
     */
    async request(path, options = {}) {
        const token = this.auth.getAccessToken();
        if (!token) {
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

        const response = await fetch(url, requestOptions);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const error = new Error(
                errorData.message || `GitHub API error: ${response.status} ${response.statusText}`
            );
            error.status = response.status;
            error.response = response;
            error.data = errorData;
            throw error;
        }

        return response.json();
    }

    /**
     * Make a GraphQL request to GitHub API
     * @param {string} query - The GraphQL query
     * @param {Object} variables - Query variables
     * @returns {Promise} - The query result
     */
    async graphql(query, variables = {}) {
        const token = this.auth.getAccessToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

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

        const result = await response.json();
        
        if (result.errors) {
            const error = new Error('GraphQL Error: ' + result.errors[0].message);
            error.errors = result.errors;
            throw error;
        }

        return result.data;
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
     * Get a user's node_id by login (for assignee)
     * @param {string} login - GitHub username
     * @returns {Promise<string>} - The user's node_id
     */
    async getUserNodeId(login) {
        const query = `query($login: String!) { user(login: $login) { id } }`;
        const data = await this.graphql(query, { login });
        return data.user.id;
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
     * Create an issue using GraphQL and assign to copilot-swe-agent
     * @param {string} owner
     * @param {string} repo
     * @param {string} title
     * @param {string} body
     * @param {Array<string>} labelNames
     * @returns {Promise<Object>} - Created issue info
     */
    async createIssueGraphQL(owner, repo, title, body, labelNames = []) {
        // Get node IDs
        const [repoId, assigneeId, labelIds] = await Promise.all([
            this.getRepoNodeId(owner, repo),
            this.getUserNodeId('copilot-swe-agent'),
            this.getLabelNodeIds(owner, repo, labelNames)
        ]);
        const mutation = `mutation CreateIssue($repositoryId: ID!, $title: String!, $body: String, $assigneeIds: [ID!], $labelIds: [ID!]) {
            createIssue(input: {
                repositoryId: $repositoryId,
                title: $title,
                body: $body,
                assigneeIds: $assigneeIds,
                labelIds: $labelIds
            }) {
                issue { id number url title }
            }
        }`;
        const variables = {
            repositoryId: repoId,
            title,
            body,
            assigneeIds: [assigneeId],
            labelIds
        };
        const data = await this.graphql(mutation, variables);
        return data.createIssue.issue;
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
        const query = `query($owner: String!, $name: String!, $title: String!) {
            repository(owner: $owner, name: $name) {
                issues(first: 10, states: [OPEN, CLOSED], filterBy: { since: "2022-01-01T00:00:00Z" }) {
                    nodes {
                        id number title url state labels(first: 10) { nodes { name } }
                    }
                }
            }
        }`;
        const data = await this.graphql(query, { owner, name: repo });
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
