// test-github-token.js
import dotenv from 'dotenv';
import { Octokit } from '@octokit/rest';

// Load environment variables
dotenv.config();

async function testGitHubToken() {
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    
    if (!githubToken) {
      console.error('GITHUB_TOKEN environment variable is not set.');
      process.exit(1);
    }
    
    const octokit = new Octokit({
      auth: githubToken
    });
    
    // Test the token by getting the authenticated user
    console.log('Testing GitHub token...');
    const { data } = await octokit.users.getAuthenticated();
    
    console.log('✅ GitHub token is valid!');
    console.log(`Authenticated as: ${data.login}`);
    console.log(`Token has access to create issues: ${data.permissions?.repo?.push ? 'Yes' : 'No'}`);
    
    return data;
  } catch (error) {
    console.error('❌ Error testing GitHub token:', error.message);
    if (error.status === 401) {
      console.error('Authentication failed. Your token may be invalid or expired.');
    }
    process.exit(1);
  }
}

testGitHubToken();
