// Global type declarations for browser usage
// These allow legacy scripts (still loaded via script tags) to access migrated TS modules

// Shared auth facade used across migrated TS modules and transitional JS.
// Centralizing here avoids divergent structural merges when augmenting Window.
interface GitHubAuthLike {
  isAuthenticated: () => boolean;
  getAccessToken?: () => string | null | undefined;
  getToken?: () => string | null | undefined; // legacy helper sometimes used
  logout?: () => void;
  login?: () => void;
  getUsername?: () => string | null | undefined; // optional convenience used by client
}

declare interface Window {
  NotificationSystem?: any;
  Notifications?: any;
  TemplateDoctorConfig?: any;
  TemplateDoctorRuntime?: any;
  GitHubAuth?: GitHubAuthLike; // unified global auth handle
  GitHubClient?: any;          // legacy compatibility surface (now TS instance)
  GitHubClientTS?: any;        // direct reference to TS client for debugging/tests
  showRulesetModal?: (repoUrl: string) => void; // ruleset modal launcher
  TemplateValidation?: any; // backward compat
  GitHubWorkflowValidation?: any; // backward compat
  initGithubWorkflowValidation?: any;
  runGithubWorkflowValidation?: any;
}
