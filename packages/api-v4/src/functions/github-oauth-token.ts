import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

export async function githubOauthTokenHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('GitHub OAuth token exchange function triggered');
    
    // Set up CORS headers - explicitly allow the development origin
    const headers = {
        "Access-Control-Allow-Origin": "http://localhost:8080",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true"
    };
    
    // Handle OPTIONS requests for CORS preflight
    if (request.method === 'OPTIONS') {
        context.log('Handling CORS preflight request');
        return { status: 204, headers };
    }
    
    const body = await request.text();
    const requestBody = body ? JSON.parse(body) : {};
    const code = requestBody && requestBody.code;
    context.log(`Authorization code received: ${code ? 'yes' : 'no'}`);
    
    if (!code) {
        return { 
            status: 400, 
            headers, 
            jsonBody: { error: 'Missing code' } 
        };
    }

    // Set these with your GitHub OAuth App credentials
    const client_id = process.env.GITHUB_CLIENT_ID;
    const client_secret = process.env.GITHUB_CLIENT_SECRET;

    if (process.env.NODE_ENV === 'development') {
        context.log(`GitHub credentials: client_id=${client_id ? 'exists' : 'missing'}, client_secret=${client_secret ? 'exists' : 'missing'}`);
    }

    if (!client_id || !client_secret) {
        return { 
            status: 500, 
            headers, 
            jsonBody: { error: 'Missing GitHub OAuth credentials in environment variables' } 
        };
    }

    try {
        context.log('Making token exchange request to GitHub');
        
        // Using native Fetch API
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
        
        const data = await response.json() as { error?: string; error_description?: string; access_token?: string };
        context.log('GitHub response status:', response.status);
        // Avoid logging full GitHub response data to prevent leaking sensitive info
        
        if (data.error) {
            context.log('Error from GitHub:', data.error, data.error_description);
            return { 
                status: 400, 
                headers, 
                jsonBody: { error: data.error_description || 'OAuth error' } 
            };
        }
        context.log('Token exchange successful, received access_token');
        return { 
            status: 200, 
            headers, 
            jsonBody: { access_token: data.access_token } 
        };
    } catch (err: any) {
        context.log('Error during token exchange:', err);
        return { 
            status: 500, 
            headers, 
            jsonBody: { error: err.message } 
        };
    }
}

// Register the function with Azure Functions
app.http('github-oauth-token', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'api/v4/github-oauth-token',
    handler: githubOauthTokenHandler
});