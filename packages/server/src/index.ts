import { createApp } from './server.js';
import dotenv from 'dotenv';

// Base load: .env in working directory if present
dotenv.config();
// Optional override: if ENV_FILE is specified, load that as well (later values do not override existing by default)
if (process.env.ENV_FILE) {
  const result = dotenv.config({ path: process.env.ENV_FILE, override: false });
  if (result.error) {
    // eslint-disable-next-line no-console
    console.warn('[server] Failed to load ENV_FILE', process.env.ENV_FILE, result.error.message);
  } else {
    // eslint-disable-next-line no-console
    console.log('[server] Loaded extra env file from ENV_FILE:', process.env.ENV_FILE);
  }
}
// Support common pattern of environment-specific files (.env.local, .env.production) if specified
if (process.env.NODE_ENV) {
  const envSpecific = `.env.${process.env.NODE_ENV}`;
  const envResult = dotenv.config({ path: envSpecific, override: false });
  if (!envResult.error) {
    console.log('[server] Loaded environment-specific file', envSpecific); // eslint-disable-line no-console
  }
}

const port = process.env.PORT || 4000;
const app = createApp();

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on port ${port}`);
});
