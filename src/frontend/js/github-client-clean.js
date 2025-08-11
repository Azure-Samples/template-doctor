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

  // Rest of the class implementation will follow...
}
