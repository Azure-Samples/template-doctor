// GitHub OAuth Authentication Handler

/**
 * Debug logging utility
 */
function debug(module, message, data) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}][${module}] ${message}`, data !== undefined ? data : '');
}

// Compute the site base path to support GitHub Pages project sites
function getBasePath() {
  // Examples:
  // - Local dev: http://localhost:xxxx/index.html => basePath = ''
  // - Pages: https://<user>.github.io/<repo>/index.html => basePath = '/<repo>'
  const pathname = window.location.pathname || '/';
  // If path ends with a file, drop the file segment
  const withoutFile = pathname.match(/\.[a-zA-Z0-9]+$/)
    ? pathname.substring(0, pathname.lastIndexOf('/'))
    : pathname;
  // Ensure we don't return just '/' for base path
  if (withoutFile === '/') return '';
  return withoutFile.endsWith('/') ? withoutFile.slice(0, -1) : withoutFile;
}

/**
 * GitHub OAuth configuration
 * Note: This is the client-side implementation for GitHub OAuth flow
 * Remember to register your OAuth app at: https://github.com/settings/applications/new
 * with callback URL set to your GitHub Pages URL
 */
const AUTH_CONFIG = { 
  clientId: '', // Provided via _site/config.json at deploy time
  redirectUri: window.location.origin + getBasePath() + '/callback.html',
  scope: 'public_repo read:user', // public_repo gives issue creation/assignment for public repos
  authUrl: 'https://github.com/login/oauth/authorize',
  tokenStorageKey: 'gh_access_token',
  userStorageKey: 'gh_user_info',
}; 

// Load runtime config if present and merge into AUTH_CONFIG
async function loadRuntimeAuthConfig() {
  try {
    const basePath = getBasePath();
    const res = await fetch(`${basePath}/config.json`, { cache: 'no-store' });
    if (!res.ok) return;
    const cfg = await res.json();
    if (cfg?.githubOAuth?.clientId) {
      AUTH_CONFIG.clientId = cfg.githubOAuth.clientId;
    }
    if (cfg?.githubOAuth?.scope) {
      AUTH_CONFIG.scope = cfg.githubOAuth.scope;
    }
    if (cfg?.githubOAuth?.authUrl) {
      AUTH_CONFIG.authUrl = cfg.githubOAuth.authUrl;
    }
    if (cfg?.githubOAuth?.redirectUri) {
      AUTH_CONFIG.redirectUri = cfg.githubOAuth.redirectUri;
    }
  } catch (_) {
    // Best-effort; keep defaults
  }
}

class GitHubAuth {
  constructor() {
    debug('GitHubAuth', 'Initializing authentication handler');
    this.accessToken = localStorage.getItem(AUTH_CONFIG.tokenStorageKey);
    debug(
      'GitHubAuth',
      'Access token from localStorage:',
      this.accessToken ? 'Present' : 'Not present',
    );

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
    console.log('Starting login flow with scopes:', AUTH_CONFIG.scope);

    // Try to clear any existing GitHub session cookies
    this.clearGitHubCookies();

    const authUrl = new URL(AUTH_CONFIG.authUrl);
    authUrl.searchParams.append('client_id', AUTH_CONFIG.clientId);
    authUrl.searchParams.append('redirect_uri', AUTH_CONFIG.redirectUri);
    authUrl.searchParams.append('scope', AUTH_CONFIG.scope);
    authUrl.searchParams.append('state', this.generateState());
    if (!AUTH_CONFIG.clientId) {
      // Ensure runtime config is loaded before proceeding
      // This is synchronous if already loaded; otherwise fetch once
      // We intentionally block the login flow to avoid a broken redirect
      const notify = window.Notifications?.info?.bind(window.Notifications);
      notify && notify('Preparing login…', 'Loading authentication configuration', 2000);
      const error = window.Notifications?.error?.bind(window.Notifications);
      error
        ? error(
            'Missing OAuth client ID',
            'GitHub OAuth clientId is not configured. Set GITHUB_CLIENT_ID environment variable in your .env file.',
            6000,
          )
        : alert('GitHub OAuth clientId is not configured. Please set GITHUB_CLIENT_ID in your .env file.');
      return;
    }

    // Force consent screen to show again
    authUrl.searchParams.append('allow_signup', 'true');

    // Add timestamp and random values to avoid caching
    authUrl.searchParams.append('_t', Date.now());
    authUrl.searchParams.append('_r', Math.random().toString(36).substring(7));

    // Force approval prompt to show again
    // https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#parameters
    authUrl.searchParams.append('prompt', 'consent');

    console.log('Redirecting to GitHub OAuth URL:', authUrl.toString());

    // Redirect the user to GitHub login page
    window.location.href = authUrl.toString();
  }

  /**
   * Attempt to clear GitHub cookies to force re-authentication
   */
  clearGitHubCookies() {
    console.log('Attempting to clear GitHub cookies');
    // Try to clear some common GitHub cookies
    const cookiesToClear = [
      { name: '_gh_sess', domain: '.github.com', path: '/' },
      { name: 'user_session', domain: '.github.com', path: '/' },
      { name: '__Host-user_session_same_site', domain: '', path: '/' },
      { name: 'logged_in', domain: '.github.com', path: '/' },
      { name: 'dotcom_user', domain: '.github.com', path: '/' },
      // Add more GitHub cookies as needed
    ];

    cookiesToClear.forEach((cookie) => {
      try {
        const cookieStr = `${cookie.name}=; path=${cookie.path}; ${cookie.domain ? 'domain=' + cookie.domain + ';' : ''} expires=Thu, 01 Jan 1970 00:00:00 GMT; secure; samesite=none`;
        console.log('Clearing cookie:', cookieStr);
        document.cookie = cookieStr;
      } catch (e) {
        console.error('Error clearing cookie:', cookie.name, e);
      }
    });
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

    debug(
      'handleCallback',
      'Code from sessionStorage:',
      code,
      'State:',
      state,
      'Expected State:',
      expectedState,
    );

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
    // Use local Functions port in pure localhost dev, otherwise use SWA-managed /api proxy
    const apiUrl = isLocalhost
      ? 'http://localhost:7071/api/github-oauth-token'
      : '/api/github-oauth-token';
    debug('exchangeCodeForToken', `API URL: ${apiUrl}`);

    // Simple fetch with minimal options to reduce CORS complexity
    fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      mode: 'cors',
      body: JSON.stringify({ code }),
    })
      .then((response) => {
        debug('exchangeCodeForToken', 'Got response from token exchange', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Array.from(response.headers.entries()),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // First clone the response to log the raw response
        return response
          .clone()
          .text()
          .then((rawText) => {
            debug('exchangeCodeForToken', 'Raw token exchange response:', rawText);
            try {
              // Try parsing as JSON to see the raw response structure
              const rawJson = JSON.parse(rawText);
              debug('exchangeCodeForToken', 'Raw token exchange response as JSON:', rawJson);
              if (rawJson.scope) {
                debug('exchangeCodeForToken', 'Token scopes from response:', rawJson.scope);
              }
            } catch (e) {
              debug('exchangeCodeForToken', 'Failed to parse raw response as JSON:', e);
            }

            // Continue with the original response
            return response.json();
          });
      })
      .then((data) => {
        debug('exchangeCodeForToken', 'Token exchange response data received', data);

        // Log detailed token information
        if (data) {
          const tokenDetails = {
            hasAccessToken: !!data.access_token,
            tokenType: data.token_type || null,
            scopes: data.scope ? data.scope.split(' ') : null,
            hasRefreshToken: !!data.refresh_token,
            expiresIn: data.expires_in || null,
            responseKeys: Object.keys(data),
          };
          debug('exchangeCodeForToken', 'Detailed token information:', tokenDetails);
        }

        if (data.access_token) {
          debug('exchangeCodeForToken', 'Successfully received access token');
          debug(
            'exchangeCodeForToken',
            'Token scopes (if provided):',
            data.scope || 'Not provided in response',
          );
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
      .catch((error) => {
        debug('exchangeCodeForToken', 'Error exchanging code for token', error.message);

        // Store the error in sessionStorage for display on the main page
        sessionStorage.setItem('auth_error', error.message);

        // Log more details to help with debugging
        debug('exchangeCodeForToken', 'Full error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack,
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
        Authorization: `token ${this.accessToken}`,
      },
    })
      .then((response) => {
        debug('fetchUserInfo', 'Response from GitHub API', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch user info: ${response.status} ${response.statusText}`);
        }

        return response.json();
      })
      .then((data) => {
        debug('fetchUserInfo', 'User data received', data);

        this.userInfo = {
          login: data.login,
          name: data.name || data.login,
          avatarUrl: data.avatar_url,
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
      .catch((error) => {
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
      avatarUrl: 'https://avatars.githubusercontent.com/u/0',
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
   * Revoke the current token if possible
   * @returns {Promise}
   */
  async revokeToken() {
    if (!this.accessToken) return Promise.resolve();

    try {
      console.log('Revoking token and clearing GitHub session...');

      // Clear all GitHub cookies
      this.clearGitHubCookies();

      // Note: GitHub doesn't have a formal revoke endpoint for OAuth apps
      // The best we can do is clear local storage and cookies
      return Promise.resolve();
    } catch (error) {
      console.error('Error revoking token:', error);
      return Promise.resolve(); // Continue with logout anyway
    }
  }

  /**
   * Logout the user by removing tokens and user info
   */
  logout() {
    console.log('Logging out user...');

    // Try to revoke the token first
    this.revokeToken().finally(() => {
      console.log('Clearing all storage...');

      // Clear ALL session storage
      sessionStorage.clear();

      // Clear specific items from local storage
      localStorage.removeItem(AUTH_CONFIG.tokenStorageKey);
      localStorage.removeItem(AUTH_CONFIG.userStorageKey);
      localStorage.removeItem('oauth_state');

      // Clear all auth-related local storage items to be safe
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.includes('gh_') ||
            key.includes('github') ||
            key.includes('oauth') ||
            key.includes('token'))
        ) {
          console.log('Removing localStorage item:', key);
          localStorage.removeItem(key);
        }
      }

      // Update state
      this.accessToken = null;
      this.userInfo = null;
      this.updateUI();

      console.log('Logged out successfully, redirecting to home page');

      // Add timestamp and random parameters to avoid caching
      const redirectUrl = new URL(window.location.origin);
      redirectUrl.searchParams.append('_t', Date.now());
      redirectUrl.searchParams.append('_r', Math.random().toString(36).substring(7));
      redirectUrl.searchParams.append('logged_out', 'true');
      redirectUrl.searchParams.append('require_permissions', 'public_repo');

      if (window.Notifications) {
        window.Notifications.success(
          'Logged Out Successfully',
          'You have been logged out of GitHub. Please log in again with the required permissions.',
          5000,
        );

        // Give the notification a chance to show before redirecting
        setTimeout(() => {
          // Redirect to home
          window.location.href = redirectUrl.toString();
        }, 1000);
      } else {
        // Redirect to home immediately
        window.location.href = redirectUrl.toString();
      }
    });
  }

  /**
   * Get the access token
   * @returns {string|null} The access token or null if not authenticated
   */
  getAccessToken() {
    return this.accessToken;
  }

  /**
   * Backward-compatibility alias for tokens
   * Some callers use auth.getToken(); keep it working.
   * @returns {string|null}
   */
  getToken() {
    return this.getAccessToken();
  }

  /**
   * Get the current user info
   * @returns {Object|null} The user info or null if not authenticated
   */
  getUserInfo() {
    return this.userInfo;
  }

  /**
   * Backward-compatibility helper to return the username (login)
   * Some callers use auth.getUsername(); keep it working.
   * @returns {string|null}
   */
  getUsername() {
    const username = this.userInfo?.login || this.userInfo?.name;
    return username || null;
  }

  /**
   * Check if the user is authenticated
   * @returns {boolean} True if authenticated, false otherwise
   */
  isAuthenticated() {
    return !!this.accessToken;
  }
}

// Initialize after loading runtime config to ensure clientId is set
window.GitHubAuth = null;
loadRuntimeAuthConfig()
  .catch(() => {})
  .finally(() => {
    const auth = new GitHubAuth();
    window.GitHubAuth = auth;
  });
