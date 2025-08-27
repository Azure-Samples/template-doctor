// Azure Function: GitHub OAuth Token Exchange
// POST /api/github-oauth-token
// Expects: { code: string }
// Returns: { access_token: string }

const fetch = require('node-fetch');

module.exports = async function (context, req) {
    context.log('GitHub OAuth token exchange function triggered');
    
    // Set up CORS headers - explicitly allow the development origin
    const headers = {
        "Access-Control-Allow-Origin": "http://localhost:8080",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true"
    };
    
    // Set CORS headers for all responses
    context.res = { headers };
    
    // Handle OPTIONS requests for CORS preflight
    if (req.method === 'OPTIONS') {
        context.log('Handling CORS preflight request');
        context.res.status = 204;
        return;
    }
    
    const code = req.body && req.body.code;
    context.log(`Authorization code received: ${code ? 'yes' : 'no'}`);
    
    if (!code) {
        context.res.status = 400;
        context.res.body = { error: 'Missing code' };
        return;
    }

    // Set these with your GitHub OAuth App credentials
    const client_id = process.env.GITHUB_CLIENT_ID;
    const client_secret = process.env.GITHUB_CLIENT_SECRET;

    if (process.env.NODE_ENV === 'development') {
        context.log(`GitHub credentials: client_id=${client_id ? 'exists' : 'missing'}, client_secret=${client_secret ? 'exists' : 'missing'}`);
    }

    if (!client_id || !client_secret) {
        context.res.status = 500;
        context.res.body = { error: 'Missing GitHub OAuth credentials in environment variables' };
        return;
    }

    try {
        context.log('Making token exchange request to GitHub');
        context.log(`Using code: ${code.slice(0, 5)}... (truncated)`);
        
        const response = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                client_id,
                client_secret,
                code
            })
        });
        
        const data = await response.json();
        context.log('GitHub response status:', response.status);
        context.log('GitHub response data:', JSON.stringify(data));
        
        if (data.error) {
            context.log('Error from GitHub:', data.error, data.error_description);
            context.res.status = 400;
            context.res.body = { error: data.error_description || 'OAuth error' };
            return;
        }
        context.log('Token exchange successful, received access_token');
        context.res.status = 200;
        context.res.body = { access_token: data.access_token };
    } catch (err) {
        context.log.error('Error during token exchange:', err);
        context.res.status = 500;
        context.res.body = { error: err.message };
    }
};
