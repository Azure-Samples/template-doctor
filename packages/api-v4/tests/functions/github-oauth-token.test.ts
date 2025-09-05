import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createMockContext, createMockRequest, withEnvVars } from '../utils/azure-functions-test-utils';

// Import the handler function from the function module
import { githubOauthTokenHandler } from '../../src/functions/github-oauth-token';

describe('github-oauth-token function', () => {
  const testEnvVars = {
    GITHUB_CLIENT_ID: 'test-client-id',
    GITHUB_CLIENT_SECRET: 'test-client-secret'
  };

  withEnvVars(testEnvVars, () => {
    let context: ReturnType<typeof createMockContext>;
    let request: ReturnType<typeof createMockRequest>;

    beforeEach(() => {
      context = createMockContext();
      
      // Create a POST request with a code
      request = createMockRequest({
        method: 'POST',
        body: { code: 'test-code' }
      });

      // Reset fetch mock
      vi.mocked(global.fetch).mockReset();
    });

    test('should exchange code for token and return response', async () => {
      // Mock successful GitHub API response
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'github-access-token',
          token_type: 'bearer',
          scope: 'repo,workflow'
        })
      } as Response);

      // Call the function
      const response = await githubOauthTokenHandler(request, context);

      // Verify response
      expect(response.status).toBe(200);
      expect(response.headers).toEqual({
        'Access-Control-Allow-Origin': 'http://localhost:8080',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true'
      });

      // Verify response body
      const body = response.jsonBody as any;
      expect(body).toHaveProperty('access_token', 'github-access-token');

      // Verify fetch call
      expect(global.fetch).toHaveBeenCalledWith(
        'https://github.com/login/oauth/access_token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({
            client_id: 'test-client-id',
            client_secret: 'test-client-secret',
            code: 'test-code'
          })
        })
      );
    });

    test('should handle OPTIONS request with CORS headers', async () => {
      // Create OPTIONS request
      const optionsRequest = createMockRequest({ method: 'OPTIONS' });
      
      // Call the function
      const response = await githubOauthTokenHandler(optionsRequest, context);

      // Verify response
      expect(response.status).toBe(204);
      expect(response.headers).toEqual({
        'Access-Control-Allow-Origin': 'http://localhost:8080',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true'
      });
      // Verify fetch was not called
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('should handle missing code parameter', async () => {
      // Create request without code
      const requestWithoutCode = createMockRequest({
        method: 'POST',
        body: {}
      });
      
      // Call the function
      const response = await githubOauthTokenHandler(requestWithoutCode, context);

      // Verify response
      expect(response.status).toBe(400);
      expect(response.jsonBody).toEqual({ error: 'Missing code' });
      // Verify fetch was not called
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('should handle GitHub API error', async () => {
      // Mock GitHub API error response
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'bad_verification_code', error_description: 'The code passed is incorrect or expired.' })
      } as Response);

      // Call the function
      const response = await githubOauthTokenHandler(request, context);

      // Verify response
      expect(response.status).toBe(400);
      expect(response.jsonBody).toEqual({
        error: 'The code passed is incorrect or expired.'
      });
      
      // Verify fetch was called
      expect(global.fetch).toHaveBeenCalled();
      // Verify error was logged
      expect(context.log).toHaveBeenCalled();
    });

    test('should handle missing environment variables', async () => {
      // Save original environment variables
      const originalEnv = { 
        GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
        GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET 
      };
      
      try {
        // Manually set environment variables to empty
        process.env.GITHUB_CLIENT_ID = '';
        process.env.GITHUB_CLIENT_SECRET = '';
        
        // Call the function
        const response = await githubOauthTokenHandler(request, context);
        
        // Verify response
        expect(response.status).toBe(500);
        expect(response.jsonBody).toEqual({
          error: 'Missing GitHub OAuth credentials in environment variables'
        });
        
        // Verify fetch was not called
        expect(global.fetch).not.toHaveBeenCalled();
      } finally {
        // Restore original environment variables
        process.env.GITHUB_CLIENT_ID = originalEnv.GITHUB_CLIENT_ID;
        process.env.GITHUB_CLIENT_SECRET = originalEnv.GITHUB_CLIENT_SECRET;
      }
    });
  });
});