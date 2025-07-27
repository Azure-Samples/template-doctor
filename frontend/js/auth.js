// GitHub OAuth Authentication Handler

/**
 * Debug logging utility
 */
function debug(module, message, data) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}][${module}] ${message}`, data !== undefined ? data : '');
}

/**
 * GitHub OAuth configuration
 * Note: This is the client-side implementation for GitHub OAuth flow
 * Remember to register your OAuth app at: https://github.com/settings/applications/new
 * with callback URL set to your GitHub Pages URL
 */
const AUTH_CONFIG = {
    clientId: 'Ov23li2nstp4WdgRG6vZ', // Replace with your GitHub OAuth app client ID
    redirectUri: window.location.origin + '/callback.html',
    scope: 'public_repo read:user',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenStorageKey: 'gh_access_token',
    userStorageKey: 'gh_user_info'
};

class GitHubAuth {
    constructor() {
        debug('GitHubAuth', 'Initializing authentication handler');
        this.accessToken = localStorage.getItem(AUTH_CONFIG.tokenStorageKey);
        debug('GitHubAuth', 'Access token from localStorage:', this.accessToken ? 'Present' : 'Not present');
        
        this.userInfo = JSON.parse(localStorage.getItem(AUTH_CONFIG.userStorageKey) || 'null');
        debug('GitHubAuth', 'User info from localStorage:', this.userInfo);
        
        this.initEventListeners();
        this.checkAuthentication();
    }

    /**
     * Initialize event listeners for login/logout buttons
     */
    initEventListeners() {
        // Login button handler
        const loginButton = document.getElementById('login-button');
        if (loginButton) {
            loginButton.addEventListener('click', () => this.login());
        }

        // Logout button handler
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', () => this.logout());
        }

        // Handle token exchange from callback
        this.handleCallback();
    }

    /**
     * Start the OAuth flow by redirecting to GitHub
     */
    login() {
        const authUrl = new URL(AUTH_CONFIG.authUrl);
        authUrl.searchParams.append('client_id', AUTH_CONFIG.clientId);
        authUrl.searchParams.append('redirect_uri', AUTH_CONFIG.redirectUri);
        authUrl.searchParams.append('scope', AUTH_CONFIG.scope);
        authUrl.searchParams.append('state', this.generateState());
        
        // Redirect the user to GitHub login page
        window.location.href = authUrl.toString();
    }

    /**
     * Generate a random state to prevent CSRF attacks
     */
    generateState() {
        const state = Math.random().toString(36).substring(2, 15);
        localStorage.setItem('oauth_state', state);
        return state;
    }

    /**
     * Handle the OAuth callback from GitHub
     * This should be called when the page loads
     */
    handleCallback() {
        debug('handleCallback', 'Checking for code in sessionStorage');
        
        // In our app, we're storing the code in sessionStorage from the callback.html page
        const code = sessionStorage.getItem('gh_auth_code');
        const state = sessionStorage.getItem('gh_auth_state');
        const expectedState = localStorage.getItem('oauth_state');
        
        debug('handleCallback', 'Code from sessionStorage:', code, 'State:', state, 'Expected State:', expectedState);
        
        if (code) {
            debug('handleCallback', 'Found code in sessionStorage');
            
            if (state !== expectedState) {
                debug('handleCallback', 'State mismatch, potential CSRF attack');
                // We'll still try the exchange but log the warning
            }
            
            // Exchange the code for a token using our Azure Function
            this.exchangeCodeForToken(code);
            
            // Clear the session storage variables now that we've used them
            sessionStorage.removeItem('gh_auth_code');
            sessionStorage.removeItem('gh_auth_state');
        } else {
            debug('handleCallback', 'No code found in sessionStorage');
        }
    }

    /**
     * Exchange the authorization code for an access token
     * In a real app, this would call your backend which would exchange the code for a token
     * Since we're running client-side only on GitHub Pages, you'd need to use a proxy service
     * @param {string} code - The authorization code from GitHub
     */
    exchangeCodeForToken(code) {
        debug('exchangeCodeForToken', 'Starting token exchange with code', code);
        
        // Call our Azure Function to exchange the code for a token
        debug('exchangeCodeForToken', 'Sending request to Azure Function');
        
        // Store the code temporarily in sessionStorage so we can retry if needed
        sessionStorage.setItem('last_auth_code', code);
        
        // Determine the correct API URL based on the environment
        const isLocalhost = window.location.hostname === 'localhost';
        const apiUrl = isLocalhost 
            ? 'http://localhost:7071/api/github-oauth-token'
            : 'https://template-doctor-api.azurewebsites.net/api/github-oauth-token';
        debug('exchangeCodeForToken', `API URL: ${apiUrl}`);
        
        // Simple fetch with minimal options to reduce CORS complexity
        fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            mode: 'cors',
            body: JSON.stringify({ code })
        })
        .then(response => {
            debug('exchangeCodeForToken', 'Got response from token exchange', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                headers: Array.from(response.headers.entries())
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return response.json();
        })
        .then(data => {
            debug('exchangeCodeForToken', 'Token exchange response data received', data);
            
            if (data.access_token) {
                debug('exchangeCodeForToken', 'Successfully received access token');
                this.setAccessToken(data.access_token);
                this.fetchUserInfo();
                
                // Clear the temporary code since we succeeded
                sessionStorage.removeItem('last_auth_code');
                
                return true;
            } else if (data.error) {
                debug('exchangeCodeForToken', 'Error in token response', data.error);
                throw new Error(data.error);
            } else {
                debug('exchangeCodeForToken', 'No token in response', data);
                throw new Error('No access token received');
            }
        })
        .catch(error => {
            debug('exchangeCodeForToken', 'Error exchanging code for token', error.message);
            
            // Store the error in sessionStorage for display on the main page
            sessionStorage.setItem('auth_error', error.message);
            
            // Log more details to help with debugging
            debug('exchangeCodeForToken', 'Full error details:', {
                message: error.message,
                name: error.name,
                stack: error.stack
            });
            
            // Don't show alert here as we're in the callback flow
            // The main page will check for auth_error in sessionStorage
        });
    }

    /**
     * Set the access token and store it in localStorage
     * @param {string} token - The access token
     */
    setAccessToken(token) {
        this.accessToken = token;
        localStorage.setItem(AUTH_CONFIG.tokenStorageKey, token);
        this.fetchUserInfo();
    }

    /**
     * Fetch user information using the access token
     */
    fetchUserInfo() {
        debug('fetchUserInfo', 'Fetching user information');
        
        if (!this.accessToken) {
            debug('fetchUserInfo', 'No access token available');
            return Promise.reject('No access token');
        }

        debug('fetchUserInfo', 'Making request to GitHub API');
        
        return fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${this.accessToken}`
            }
        })
        .then(response => {
            debug('fetchUserInfo', 'Response from GitHub API', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch user info: ${response.status} ${response.statusText}`);
            }
            
            return response.json();
        })
        .then(data => {
            debug('fetchUserInfo', 'User data received', data);
            
            this.userInfo = {
                login: data.login,
                name: data.name || data.login,
                avatarUrl: data.avatar_url
            };
            
            debug('fetchUserInfo', 'Storing user info in localStorage');
            localStorage.setItem(AUTH_CONFIG.userStorageKey, JSON.stringify(this.userInfo));
            
            this.updateUI();
            
            // Update GitHub client with current user info
            if (window.GitHubClient) {
                window.GitHubClient.currentUser = this.userInfo;
                debug('fetchUserInfo', 'Updated GitHub client with user info');
            }
            
            return this.userInfo;
        })
        .catch(error => {
            debug('fetchUserInfo', 'Error fetching user info', error.message);
            
            // If token is invalid, clear it and log out
            if (error.message.includes('401')) {
                debug('fetchUserInfo', 'Token is invalid, logging out');
                this.logout();
            }
            
            return null;
        });
    }

    /**
     * Check if the user is authenticated and update UI accordingly
     */
    checkAuthentication() {
        debug('checkAuthentication', 'Checking authentication status');
        
        // Check if we just came back from an OAuth flow but didn't complete it
        // This could happen if the callback page redirected too quickly
        const pendingCode = sessionStorage.getItem('github_auth_code');
        const pendingTimestamp = sessionStorage.getItem('github_auth_timestamp');
        
        if (pendingCode && pendingTimestamp) {
            const timestamp = new Date(pendingTimestamp);
            const now = new Date();
            const secondsElapsed = (now - timestamp) / 1000;
            
            // If this is a recent code (less than 30 seconds old) and we don't have a token
            // try to exchange it again
            if (secondsElapsed < 30 && !this.accessToken) {
                debug('checkAuthentication', 'Found recent pending auth code, retrying exchange');
                this.exchangeCodeForToken(pendingCode);
                
                // Clear the pending code to prevent infinite retries
                sessionStorage.removeItem('github_auth_code');
                sessionStorage.removeItem('github_auth_timestamp');
            } else if (secondsElapsed >= 30) {
                // Clear old pending codes
                debug('checkAuthentication', 'Clearing expired pending auth code');
                sessionStorage.removeItem('github_auth_code');
                sessionStorage.removeItem('github_auth_timestamp');
            }
        }
        
        // Update UI based on auth state
        this.updateUI();
        
        // If we have a token but no user info, fetch it
        if (this.accessToken && !this.userInfo) {
            debug('checkAuthentication', 'Have token but no user info, fetching user info');
            this.fetchUserInfo();
        }
        
        return !!this.accessToken;
    }

    /**
     * For development purposes, simulate a successful login
     */
    simulateLogin() {
        console.log('Simulating login for local development');
        this.accessToken = 'simulated_token';
        localStorage.setItem(AUTH_CONFIG.tokenStorageKey, this.accessToken);
        this.userInfo = {
            login: 'dev-user',
            name: 'Development User',
            avatarUrl: 'https://avatars.githubusercontent.com/u/0'
        };
        localStorage.setItem(AUTH_CONFIG.userStorageKey, JSON.stringify(this.userInfo));
    }

    /**
     * Update the UI based on authentication status
     */
    updateUI() {
        console.log('updateUI: Access Token:', this.accessToken ? 'Present' : 'Not present');
        console.log('updateUI: User Info:', this.userInfo);
        
        const loginButton = document.getElementById('login-button');
        const userProfile = document.getElementById('user-profile');
        const username = document.getElementById('username');
        const userAvatar = document.getElementById('user-avatar');
        const searchSection = document.getElementById('search-section');
        const welcomeSection = document.getElementById('welcome-section');

        if (this.accessToken && this.userInfo) {
            console.log('updateUI: User is authenticated, updating UI');
            // User is authenticated
            if (loginButton) loginButton.style.display = 'none';
            if (userProfile) userProfile.style.display = 'flex';
            if (username) username.textContent = this.userInfo.name || this.userInfo.login;
            if (userAvatar) userAvatar.src = this.userInfo.avatarUrl;
            
            // Show search section, hide welcome section
            if (searchSection) searchSection.style.display = 'block';
            if (welcomeSection) welcomeSection.style.display = 'none';
        } else {
            console.log('updateUI: User is not authenticated, updating UI');
            // User is not authenticated
            if (loginButton) loginButton.style.display = 'flex';
            if (userProfile) userProfile.style.display = 'none';
            
            // Show welcome section, hide search section
            if (searchSection) searchSection.style.display = 'none';
            if (welcomeSection) welcomeSection.style.display = 'block';
        }
    }

    /**
     * Logout the user by removing tokens and user info
     */
    logout() {
        localStorage.removeItem(AUTH_CONFIG.tokenStorageKey);
        localStorage.removeItem(AUTH_CONFIG.userStorageKey);
        this.accessToken = null;
        this.userInfo = null;
        this.updateUI();
        
        // Redirect to home
        window.location.href = '/';
    }

    /**
     * Get the access token
     * @returns {string|null} The access token or null if not authenticated
     */
    getAccessToken() {
        return this.accessToken;
    }

    /**
     * Get the current user info
     * @returns {Object|null} The user info or null if not authenticated
     */
    getUserInfo() {
        return this.userInfo;
    }

    /**
     * Check if the user is authenticated
     * @returns {boolean} True if authenticated, false otherwise
     */
    isAuthenticated() {
        return !!this.accessToken;
    }
}

// Initialize the auth handler
const auth = new GitHubAuth();

// Export the auth instance
window.GitHubAuth = auth;
