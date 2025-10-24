// Central environment validation. Minimal to keep deps low.

export interface AppEnv {
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GH_WORKFLOW_TOKEN?: string;
  GITHUB_OAUTH_ALLOWED_ORIGINS: string[];
  NODE_ENV?: string;
  SETUP_ALLOWED_USERS?: string; // comma-separated allowlist for secure setup function
}

let cached: AppEnv | null = null;

/**
 * Determine which GitHub OAuth credentials to use based on environment.
 * In production (NODE_ENV=production or Azure), prefer *_PROD variables.
 * Falls back to standard GITHUB_CLIENT_ID/SECRET if _PROD variants not set.
 */
function getOAuthCredentials(): { clientId?: string; clientSecret?: string } {
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.WEBSITE_INSTANCE_ID || // Azure App Service
    process.env.CONTAINER_APP_NAME; // Azure Container Apps

  if (isProduction) {
    // Production: use _PROD if available, fall back to dev
    const clientId = process.env.GITHUB_CLIENT_ID_PROD || process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET_PROD || process.env.GITHUB_CLIENT_SECRET;
    return { clientId, clientSecret };
  } else {
    // Development: use standard variables
    return {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    };
  }
}

export function loadEnv(): AppEnv {
  if (cached) return cached;
  
  const { clientId, clientSecret } = getOAuthCredentials();
  
  const required: Array<[keyof AppEnv, boolean]> = [
    ['GITHUB_CLIENT_ID', false], // not all endpoints need both at cold start
    ['GITHUB_CLIENT_SECRET', false],
  ];
  const env: AppEnv = {
    GITHUB_CLIENT_ID: clientId,
    GITHUB_CLIENT_SECRET: clientSecret,
    GH_WORKFLOW_TOKEN: process.env.GH_WORKFLOW_TOKEN,
    // Include common dev ports (4000 Vite primary, 5173 Vite default fallback) plus legacy 8080 for backward compatibility
    GITHUB_OAUTH_ALLOWED_ORIGINS: (
      process.env.GITHUB_OAUTH_ALLOWED_ORIGINS ||
      'http://localhost:4000,http://localhost:5173,http://localhost:8080'
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    NODE_ENV: process.env.NODE_ENV,
    SETUP_ALLOWED_USERS: process.env.SETUP_ALLOWED_USERS,
  };
  // We do soft validation now; endpoint-specific strict checks happen in handlers.
  for (const [k] of required) {
    // Lazy hard requirement; can be tightened per function
    // if (!env[k]) console.warn(`[env] Optional missing: ${k}`);
  }
  cached = env;
  return env;
}
