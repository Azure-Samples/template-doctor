// Load environment variables from .env.container
require('dotenv').config({ path: '../../../.env.container' });

// Set SERVE_FRONTEND to true
process.env.SERVE_FRONTEND = 'true';

// Import and run the server
require('./dist/index.js');