// Azure Function: GitHub OAuth Token Exchange
// POST /api/github-oauth-token
// Expects: { code: string }
// Returns: { access_token: string }

const fetch = require('node-fetch');

module.exports = async function (context, req) {
    context.log('GitHub OAuth token exchange function triggered');
    
    // Enable CORS
    context.res = {
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        }
    };
    
    // Handle OPTIONS requests for CORS preflight
    if (req.method === 'OPTIONS') {
        context.log('Handling CORS preflight request');
        context.res.status = 204;
        return;
    }
    
    const code = req.body && req.body.code;
    context.log(`Authorization code received: ${code ? 'yes' : 'no'}`);
    
    if (!code) {
        context.res = {
            status: 400,
            body: { error: 'Missing code' }
        };
        return;
    }

    // Set these with your GitHub OAuth App credentials
    const client_id = process.env.GITHUB_CLIENT_ID;
    const client_secret = process.env.GITHUB_CLIENT_SECRET;

    if (!client_id || !client_secret) {
        context.res = {
            status: 500,
            body: { error: 'Missing GitHub OAuth credentials in environment variables' }
        };
        return;
    }

    try {
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
        if (data.error) {
            context.res = {
                status: 400,
                body: { error: data.error_description || 'OAuth error' }
            };
            return;
        }
        context.log('Token exchange successful, received access_token');
        context.res = {
            status: 200,
            body: { access_token: data.access_token }
        };
    } catch (err) {
        context.log.error('Error during token exchange:', err);
        context.res = {
            status: 500,
            body: { error: err.message }
        };
    }
};
