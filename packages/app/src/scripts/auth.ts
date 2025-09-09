// @ts-nocheck
// Migrated from js/auth.js (behavior preserved)

function debug(module, message, data) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}][${module}] ${message}`, data !== undefined ? data : '');
}
function getBasePath(){
  const pathname = window.location.pathname || '/';
  const withoutFile = pathname.match(/\.[a-zA-Z0-9]+$/) ? pathname.substring(0, pathname.lastIndexOf('/')) : pathname;
  if (withoutFile === '/') return '';
  return withoutFile.endsWith('/') ? withoutFile.slice(0,-1) : withoutFile;
}
const AUTH_CONFIG = {
  clientId: '',
  redirectUri: window.location.origin + getBasePath() + '/callback.html',
  scope: 'public_repo read:user',
  authUrl: 'https://github.com/login/oauth/authorize',
  tokenStorageKey: 'gh_access_token',
  userStorageKey: 'gh_user_info'
};
console.log('AUTH_CONFIG.redirectUri:', AUTH_CONFIG.redirectUri);
console.log('window.location.origin:', window.location.origin);
console.log('getBasePath():', getBasePath());
async function loadRuntimeAuthConfig(){
  try {
    if ((window as any).ConfigLoader && (window as any).ConfigLoader.loadConfig){
      const config = await (window as any).ConfigLoader.loadConfig();
      if (config.githubOAuth){
        if (config.githubOAuth.clientId) AUTH_CONFIG.clientId = config.githubOAuth.clientId;
        if (config.githubOAuth.scope) AUTH_CONFIG.scope = config.githubOAuth.scope;
        if (config.githubOAuth.authUrl) AUTH_CONFIG.authUrl = config.githubOAuth.authUrl;
        if (config.githubOAuth.redirectUri && config.githubOAuth.redirectUri.trim() !== '') AUTH_CONFIG.redirectUri = config.githubOAuth.redirectUri;
      }
      if (config.GITHUB_CLIENT_ID) AUTH_CONFIG.clientId = config.GITHUB_CLIENT_ID;
      console.log('Updated AUTH_CONFIG:', { clientId: AUTH_CONFIG.clientId ? 'Set' : 'Not set', redirectUri: AUTH_CONFIG.redirectUri, scope: AUTH_CONFIG.scope, authUrl: AUTH_CONFIG.authUrl });
      return;
    }
    const basePath = getBasePath();
    const res = await fetch(`${basePath}/config.json`, { cache: 'no-store' });
    if (!res.ok) return; const cfg = await res.json();
    if (cfg?.githubOAuth?.clientId) AUTH_CONFIG.clientId = cfg.githubOAuth.clientId;
    if (cfg?.githubOAuth?.scope) AUTH_CONFIG.scope = cfg.githubOAuth.scope;
    if (cfg?.githubOAuth?.authUrl) AUTH_CONFIG.authUrl = cfg.githubOAuth.authUrl;
    if (cfg?.githubOAuth?.redirectUri && cfg.githubOAuth.redirectUri.trim() !== '') AUTH_CONFIG.redirectUri = cfg.githubOAuth.redirectUri;
  } catch (error){ console.error('Error loading runtime config:', error); }
}
// Edge-case helper: Sometimes GitHub may redirect directly to index.html with ?code&state instead of callback.html
// (e.g., misconfigured redirect or older bookmarked URL). We capture that here early.
function captureAuthParamsOnIndex(){
  try {
    if (!window.location.search) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (code && !sessionStorage.getItem('gh_auth_code')){
      console.warn('[GitHubAuth][captureAuthParamsOnIndex] Found OAuth params on index.html; stashing and cleaning URL');
      sessionStorage.setItem('gh_auth_code', code);
      if (state) sessionStorage.setItem('gh_auth_state', state);
      // clean URL (remove sensitive query params) without full reload
      const clean = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, clean);
    }
  } catch(e){ console.debug('[GitHubAuth][captureAuthParamsOnIndex] No-op', e); }
}
captureAuthParamsOnIndex();
class GitHubAuth {
  constructor(){
    debug('GitHubAuth','Initializing authentication handler');
    this.accessToken = localStorage.getItem(AUTH_CONFIG.tokenStorageKey);
    debug('GitHubAuth','Access token from localStorage:', this.accessToken ? 'Present':'Not present');
    this.userInfo = JSON.parse(localStorage.getItem(AUTH_CONFIG.userStorageKey) || 'null');
    debug('GitHubAuth','User info from localStorage:', this.userInfo);
    this.initEventListeners();
    this.checkAuthentication();
  }
  initEventListeners(){
    const loginButton = document.getElementById('login-button');
    if (loginButton) loginButton.addEventListener('click', () => this.login());
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) logoutButton.addEventListener('click', () => this.logout());
    this.handleCallback();
  }
  login(){
    console.log('Starting login flow with scopes:', AUTH_CONFIG.scope);
    console.log('Configured redirectUri:', AUTH_CONFIG.redirectUri);
    this.clearGitHubCookies();
    const authUrl = new URL(AUTH_CONFIG.authUrl);
    authUrl.searchParams.append('client_id', AUTH_CONFIG.clientId);
    authUrl.searchParams.append('redirect_uri', AUTH_CONFIG.redirectUri);
    authUrl.searchParams.append('scope', AUTH_CONFIG.scope);
    authUrl.searchParams.append('state', this.generateState());
    console.log('Full auth URL:', authUrl.toString());
    if (!AUTH_CONFIG.clientId){
      const notify = (window as any).Notifications?.info?.bind((window as any).Notifications);
      notify && notify('Preparing login…','Loading authentication configuration',2000);
      const error = (window as any).Notifications?.error?.bind((window as any).Notifications);
      error ? error('Missing OAuth client ID','GitHub OAuth clientId is not configured. Set GITHUB_CLIENT_ID environment variable in your .env file.',6000) : alert('GitHub OAuth clientId is not configured. Please set GITHUB_CLIENT_ID in your .env file.');
      return;
    }
    authUrl.searchParams.append('allow_signup','true');
    authUrl.searchParams.append('_t', Date.now());
    authUrl.searchParams.append('_r', Math.random().toString(36).substring(7));
    authUrl.searchParams.append('prompt','consent');
    console.log('Redirecting to GitHub OAuth URL:', authUrl.toString());
    window.location.href = authUrl.toString();
  }
  clearGitHubCookies(){
    console.log('Attempting to clear GitHub cookies');
    const cookiesToClear = [
      { name: '_gh_sess', domain: '.github.com', path: '/' },
      { name: 'user_session', domain: '.github.com', path: '/' },
      { name: '__Host-user_session_same_site', domain: '', path: '/' },
      { name: 'logged_in', domain: '.github.com', path: '/' },
      { name: 'dotcom_user', domain: '.github.com', path: '/' },
    ];
    cookiesToClear.forEach(cookie => {
      try {
        const cookieStr = `${cookie.name}=; path=${cookie.path}; ${cookie.domain ? 'domain=' + cookie.domain + ';' : ''} expires=Thu, 01 Jan 1970 00:00:00 GMT; secure; samesite=none`;
        console.log('Clearing cookie:', cookieStr);
        document.cookie = cookieStr;
      } catch(e){ console.error('Error clearing cookie:', cookie.name, e); }
    });
  }
  generateState(){
    const state = Math.random().toString(36).substring(2,15); localStorage.setItem('oauth_state', state); return state;
  }
  handleCallback(){
    debug('handleCallback','Checking for code in sessionStorage');
    const code = sessionStorage.getItem('gh_auth_code');
    const state = sessionStorage.getItem('gh_auth_state');
    const expectedState = localStorage.getItem('oauth_state');
    debug('handleCallback','Code from sessionStorage:', code,'State:', state,'Expected State:', expectedState);
    if (code){
      debug('handleCallback','Found code in sessionStorage');
      if (state !== expectedState){ debug('handleCallback','State mismatch, potential CSRF attack'); }
      this.exchangeCodeForToken(code);
      sessionStorage.removeItem('gh_auth_code');
      sessionStorage.removeItem('gh_auth_state');
    } else { debug('handleCallback','No code found in sessionStorage'); }
  }
  exchangeCodeForToken(code){
    debug('exchangeCodeForToken','Starting token exchange with code', code);
    debug('exchangeCodeForToken','Sending request to Azure Function');
    sessionStorage.setItem('last_auth_code', code);
    const isLocalhost = window.location.hostname === 'localhost';
    let apiUrl;
    if (isLocalhost) {
      apiUrl = (window.location.port === '7071')
        ? 'http://localhost:7071/api/v4/github-oauth-token'
        : `${window.location.origin}/v4/github-oauth-token`;
    } else if ((window as any).ApiRoutes) {
      apiUrl = (window as any).ApiRoutes.build('github-oauth-token');
    } else {
      apiUrl = '/api/v4/github-oauth-token';
    }
    debug('exchangeCodeForToken', `API URL: ${apiUrl}`);
    fetch(apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json', Accept:'application/json'}, mode:'cors', body: JSON.stringify({ code }) })
      .then(response => {
        debug('exchangeCodeForToken','Got response from token exchange', { status: response.status, statusText: response.statusText, ok: response.ok, headers: Array.from(response.headers.entries()) });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.clone().text().then(rawText => { debug('exchangeCodeForToken','Raw token exchange response:', rawText); try { const rawJson = JSON.parse(rawText); debug('exchangeCodeForToken','Raw token exchange response as JSON:', rawJson); if (rawJson.error){ const errorMsg = `${rawJson.error}: ${rawJson.error_description || 'Unknown error'}`; const errorNotify = (window as any).Notifications?.error?.bind((window as any).Notifications); errorNotify ? errorNotify('GitHub OAuth Error', errorMsg, 10000) : alert(`GitHub OAuth Error: ${errorMsg}`); throw new Error(errorMsg); } if (rawJson.scope) debug('exchangeCodeForToken','Token scopes from response:', rawJson.scope); } catch(e){ debug('exchangeCodeForToken','Failed to parse raw response as JSON:', e); } return response.json(); });
      })
      .then(data => {
        debug('exchangeCodeForToken','Token exchange response data received', data);
        if (data){ debug('exchangeCodeForToken','Detailed token information:', { hasAccessToken: !!data.access_token, tokenType: data.token_type || null, scopes: data.scope ? data.scope.split(' ') : null, hasRefreshToken: !!data.refresh_token, expiresIn: data.expires_in || null, responseKeys: Object.keys(data) }); }
        if (data.access_token){ debug('exchangeCodeForToken','Successfully received access token'); debug('exchangeCodeForToken','Token scopes (if provided):', data.scope || 'Not provided in response'); this.setAccessToken(data.access_token); this.fetchUserInfo(); sessionStorage.removeItem('last_auth_code'); return true; }
        else if (data.error){ debug('exchangeCodeForToken','Error in token response', data.error); throw new Error(data.error); }
        else { debug('exchangeCodeForToken','No token in response', data); throw new Error('No access token received'); }
      })
      .catch(error => {
        debug('exchangeCodeForToken','Error exchanging code for token', error.message);
        sessionStorage.setItem('auth_error', error.message);
        debug('exchangeCodeForToken','Full error details:', { message: error.message, name: error.name, stack: error.stack });
      });
  }
  setAccessToken(token){ this.accessToken = token; localStorage.setItem(AUTH_CONFIG.tokenStorageKey, token); this.fetchUserInfo(); }
  fetchUserInfo(){
    debug('fetchUserInfo','Fetching user information');
    if (!this.accessToken){ debug('fetchUserInfo','No access token available'); return Promise.reject('No access token'); }
    debug('fetchUserInfo','Making request to GitHub API');
    return fetch('https://api.github.com/user', { headers: { Authorization: `token ${this.accessToken}` } })
      .then(response => { debug('fetchUserInfo','Response from GitHub API', { status: response.status, statusText: response.statusText, ok: response.ok }); if (!response.ok) throw new Error(`Failed to fetch user info: ${response.status} ${response.statusText}`); return response.json(); })
      .then(data => { debug('fetchUserInfo','User data received', data); this.userInfo = { login: data.login, name: data.name || data.login, avatarUrl: data.avatar_url }; localStorage.setItem(AUTH_CONFIG.userStorageKey, JSON.stringify(this.userInfo)); this.updateUI(); if ((window as any).GitHubClient){ (window as any).GitHubClient.currentUser = this.userInfo; debug('fetchUserInfo','Updated GitHub client with user info'); } return this.userInfo; })
      .catch(error => { debug('fetchUserInfo','Error fetching user info', error.message); if (error.message.includes('401')){ debug('fetchUserInfo','Token is invalid, logging out'); this.logout(); } return null; });
  }
  checkAuthentication(){
    debug('checkAuthentication','Checking authentication status');
    const pendingCode = sessionStorage.getItem('github_auth_code');
    const pendingTimestamp = sessionStorage.getItem('github_auth_timestamp');
    const directCode = sessionStorage.getItem('gh_auth_code');
    if (!this.accessToken && directCode){
      debug('checkAuthentication','Found gh_auth_code but no access token yet. Attempting exchange now.');
      this.exchangeCodeForToken(directCode);
    }
    if (pendingCode && pendingTimestamp){
      const timestamp = new Date(pendingTimestamp); const now = new Date(); const secondsElapsed = (now - timestamp)/1000;
      if (secondsElapsed < 30 && !this.accessToken){ debug('checkAuthentication','Found recent pending auth code, retrying exchange'); this.exchangeCodeForToken(pendingCode); sessionStorage.removeItem('github_auth_code'); sessionStorage.removeItem('github_auth_timestamp'); }
      else if (secondsElapsed >= 30){ debug('checkAuthentication','Clearing expired pending auth code'); sessionStorage.removeItem('github_auth_code'); sessionStorage.removeItem('github_auth_timestamp'); }
    }
    this.updateUI();
    if (this.accessToken && !this.userInfo){ debug('checkAuthentication','Have token but no user info, fetching user info'); this.fetchUserInfo(); }
    return !!this.accessToken;
  }
  simulateLogin(){ console.log('Simulating login for local development'); this.accessToken = 'simulated_token'; localStorage.setItem(AUTH_CONFIG.tokenStorageKey, this.accessToken); this.userInfo = { login: 'dev-user', name: 'Development User', avatarUrl: 'https://avatars.githubusercontent.com/u/0' }; localStorage.setItem(AUTH_CONFIG.userStorageKey, JSON.stringify(this.userInfo)); }
  updateUI(){
    console.log('updateUI: Access Token:', this.accessToken ? 'Present':'Not present');
    console.log('updateUI: User Info:', this.userInfo);
    const loginButton = document.getElementById('login-button');
    const userProfile = document.getElementById('user-profile');
    const username = document.getElementById('username');
    const userAvatar = document.getElementById('user-avatar');
    const searchSection = document.getElementById('search-section');
    const welcomeSection = document.getElementById('welcome-section');
    if (this.accessToken && this.userInfo){
      if (loginButton) loginButton.style.display = 'none';
      if (userProfile) userProfile.style.display = 'flex';
      if (username) username.textContent = this.userInfo.name || this.userInfo.login;
      if (userAvatar) userAvatar.src = this.userInfo.avatarUrl;
      if (searchSection) searchSection.style.display = 'block';
      if (welcomeSection) welcomeSection.style.display = 'none';
      document.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { authenticated: true }, bubbles: true, cancelable: true }));
    } else {
      if (loginButton) loginButton.style.display = 'flex';
      if (userProfile) userProfile.style.display = 'none';
      if (searchSection) searchSection.style.display = 'none';
      if (welcomeSection) welcomeSection.style.display = 'block';
      document.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { authenticated: false }, bubbles: true, cancelable: true }));
    }
  }
  async revokeToken(){ if (!this.accessToken) return Promise.resolve(); try { console.log('Revoking token and clearing GitHub session...'); this.clearGitHubCookies(); return Promise.resolve(); } catch(e){ console.error('Error revoking token:', e); return Promise.resolve(); } }
  logout(){
    console.log('Logging out user...');
    this.revokeToken().finally(() => {
      console.log('Clearing all storage...');
      sessionStorage.clear();
      localStorage.removeItem(AUTH_CONFIG.tokenStorageKey);
      localStorage.removeItem(AUTH_CONFIG.userStorageKey);
      localStorage.removeItem('oauth_state');
      for (let i=0; i<localStorage.length; i++){
        const key = localStorage.key(i);
        if (key && (key.includes('gh_') || key.includes('github') || key.includes('oauth') || key.includes('token'))){
          console.log('Removing localStorage item:', key);
          localStorage.removeItem(key);
        }
      }
      this.accessToken = null; this.userInfo = null; this.updateUI();
      console.log('Logged out successfully, redirecting to home page');
      const redirectUrl = new URL(window.location.origin);
      redirectUrl.searchParams.append('_t', Date.now());
      redirectUrl.searchParams.append('_r', Math.random().toString(36).substring(7));
      redirectUrl.searchParams.append('logged_out','true');
      redirectUrl.searchParams.append('require_permissions','public_repo');
      if ((window as any).Notifications){
        (window as any).Notifications.success('Logged Out Successfully','You have been logged out of GitHub. Please log in again with the required permissions.',5000);
        setTimeout(()=>{ window.location.href = redirectUrl.toString(); }, 1000);
      } else { window.location.href = redirectUrl.toString(); }
    });
  }
  getAccessToken(){ return this.accessToken; }
  getToken(){ return this.getAccessToken(); }
  getUserInfo(){ return this.userInfo; }
  getUsername(){ const username = this.userInfo?.login || this.userInfo?.name; return username || null; }
  isAuthenticated(){ const authenticated = !!this.accessToken; console.log('isAuthenticated check - token exists:', authenticated); return authenticated; }
}
(window as any).GitHubAuth = null;
loadRuntimeAuthConfig().catch(()=>{}).finally(()=>{ const auth = new GitHubAuth(); (window as any).GitHubAuth = auth; });
export {};
