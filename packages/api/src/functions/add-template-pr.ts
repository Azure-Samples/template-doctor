import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { Octokit } from '@octokit/rest';
import { randomUUID } from 'crypto';

export async function addTemplatePrHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  function corsHeaders() {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
  }

  if (request.method === 'OPTIONS') {
    return { status: 204, headers: corsHeaders() };
  }

  try {
    if (request.method !== 'POST') {
      return {
        status: 405,
        headers: corsHeaders(),
        jsonBody: { error: 'Method not allowed' }
      };
    }

    const requestBody = await request.json() as {
      repoUrl: string;
      analysis: any;
      repoCategory?: string;
    };
    
    // Validate required request fields
    if (!requestBody || !requestBody.repoUrl || !requestBody.analysis) {
      return {
        status: 400,
        headers: corsHeaders(),
        jsonBody: { error: 'Missing required fields in request body' }
      };
    }

    const { repoUrl, analysis, repoCategory } = requestBody;
    
    // Repo targeting: prefer explicit owner/name vars if provided, then GITHUB_REPOSITORY, then default
    let owner = process.env.GITHUB_REPO_OWNER;
    let repo = process.env.GITHUB_REPO_NAME;
    let repoSource = 'env:owner-name';
    if (!owner || !repo) {
      const repoSlug = process.env.GITHUB_REPOSITORY || "Template-Doctor/template-doctor";
      [owner, repo] = repoSlug.split("/");
      repoSource = process.env.GITHUB_REPOSITORY ? 'env:repository' : 'default';
    }
    
    const targetBranch = process.env.GITHUB_REPO_BRANCH || 'main';
    
    // Create a unique branch name for this PR
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const prId = randomUUID().substring(0, 8);
    const branchName = `add-template-${prId}`;
    
    // Get the token for GitHub API access
    const token = process.env.GH_WORKFLOW_TOKEN;
    if (!token) {
      return {
        status: 500,
        headers: corsHeaders(),
        jsonBody: { error: 'GitHub token not configured' }
      };
    }
    
    // Initialize Octokit
    const octokit = new Octokit({ auth: token, userAgent: 'TemplateDoctorApp' });
    
    // Extract repo owner and name from the provided URL
    const urlPattern = /github\.com\/([^/]+)\/([^/]+)/;
    const urlMatch = repoUrl.match(urlPattern);
    if (!urlMatch) {
      return {
        status: 400,
        headers: corsHeaders(),
        jsonBody: { error: 'Invalid GitHub repository URL format' }
      };
    }
    
    const [_, templateOwner, templateRepo] = urlMatch;
    
    // Create a new branch from the target branch
    try {
      // Get the SHA of the latest commit on the target branch
      const { data: refData } = await octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${targetBranch}`
      });
      
      // Create a new branch
      await octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha: refData.object.sha
      });
      
      context.log(`Created branch ${branchName} from ${targetBranch}`);
    } catch (err: any) {
      context.log(`Error creating branch: ${err.message}`);
      return {
        status: 500,
        headers: corsHeaders(),
        jsonBody: { error: `Failed to create branch: ${err.message}` }
      };
    }
    
    // Prepare the template data in JSON format
    const templateData = {
      url: repoUrl,
      category: repoCategory || 'uncategorized',
      analysis: analysis
    };
    
    // Create a new file in the templates directory
    const filename = `templates/${templateRepo}-${templateOwner}.json`;
    const fileContent = JSON.stringify(templateData, null, 2);
    
    try {
      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: filename,
        message: `Add template: ${templateOwner}/${templateRepo}`,
        content: Buffer.from(fileContent).toString('base64'),
        branch: branchName
      });
      
      context.log(`Created file ${filename} in branch ${branchName}`);
    } catch (err: any) {
      context.log(`Error creating file: ${err.message}`);
      
      // Try to delete the branch if we failed to create the file
      try {
        await octokit.git.deleteRef({
          owner,
          repo,
          ref: `heads/${branchName}`
        });
      } catch (deleteErr) {
        // Just log this error, don't fail the main response
        context.log(`Error deleting branch after file creation failure: ${deleteErr instanceof Error ? deleteErr.message : String(deleteErr)}`);
      }
      
      return {
        status: 500,
        headers: corsHeaders(),
        jsonBody: { error: `Failed to create template file: ${err.message}` }
      };
    }
    
    // Create a pull request
    try {
      const prResponse = await octokit.pulls.create({
        owner,
        repo,
        title: `Add template: ${templateOwner}/${templateRepo}`,
        body: `This PR adds a new template from ${repoUrl} to the template collection.
        
## Template Details
- Repository: ${templateOwner}/${templateRepo}
- Category: ${repoCategory || 'uncategorized'}
- Added via Template Doctor

## Analysis Summary
${JSON.stringify(analysis, null, 2)}`,
        head: branchName,
        base: targetBranch
      });
      
      context.log(`Created PR #${prResponse.data.number}`);
      
      return {
        status: 201,
        headers: corsHeaders(),
        jsonBody: {
          success: true,
          prUrl: prResponse.data.html_url,
          prNumber: prResponse.data.number,
          branch: branchName
        }
      };
    } catch (err: any) {
      context.log(`Error creating PR: ${err.message}`);
      
      // Try to clean up by deleting the branch
      try {
        await octokit.git.deleteRef({
          owner,
          repo,
          ref: `heads/${branchName}`
        });
      } catch (deleteErr) {
        context.log(`Error deleting branch after PR creation failure: ${deleteErr instanceof Error ? deleteErr.message : String(deleteErr)}`);
      }
      
      return {
        status: 500,
        headers: corsHeaders(),
        jsonBody: { error: `Failed to create pull request: ${err.message}` }
      };
    }
  } catch (err: any) {
    context.log(`Unhandled error in add-template-pr: ${err.message}`);
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { error: 'Internal server error', message: err.message }
    };
  }
}

// registration moved to barrel index.ts