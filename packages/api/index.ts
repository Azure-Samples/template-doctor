// Entry point that simply imports the src index to ensure Azure Functions typescript loader finds it.
import './src/index.js';
// Entry point for Azure Functions host when using TypeScript programmatic model.
// Re-export compiled or source registration depending on execution mode.

import './src/index';
