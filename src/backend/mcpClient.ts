import dotenv from "dotenv";
import { Octokit } from "@octokit/rest";
import { graphql } from "@octokit/graphql";

// Load environment variables
dotenv.config();

// NOTE: This file was updated to use Octokit for direct GitHub API access
// instead of relying on an MCP server. To use this:
//
// 1. Create a GitHub Personal Access Token with 'repo' scope permissions
// 2. Set it as an environment variable: GITHUB_TOKEN=your_token_here
// 3. For AZD provision testing, create a GitHub Actions workflow in your repository
//    that triggers on the 'repository_dispatch' event with type 'azd-provision-test'

/**
 * Client for interacting with GitHub API using Octokit
 */

// Initialize Octokit with the GitHub token
function getOctokit(): Octokit {
  const githubToken = process.env.GITHUB_TOKEN;
  
  if (!githubToken) {
    throw new Error('GITHUB_TOKEN environment variable is not set. Please set it to a valid GitHub Personal Access Token.');
  }
  
  return new Octokit({
    auth: githubToken
  });
}

/**
 * Creates a GitHub issue based on template analysis results
 * @param repoUrl GitHub repository URL
 * @param issueTitle Issue title
 * @param issueBody Issue body
 * @param labels Optional labels to add to the issue
 * @param checkForDuplicates Whether to check for duplicate issues before creating
 * @param assignee Optional assignee for the issue
 * @returns Created issue information
 */
export async function createGitHubIssue(
  repoUrl: string, 
  issueTitle: string, 
  issueBody: string, 
  labels: string[] = ["template-doctor"],
  checkForDuplicates: boolean = false,
  assignee?: string 
): Promise<{ html_url: string; number: number; updated?: boolean; existed?: boolean }> {
  try {
    // Extract owner and repo from the URL
    const urlParts = new URL(repoUrl).pathname.split('/').filter(Boolean);
    const owner = urlParts[0];
    const repo = urlParts[1];
    
    // Get authenticated Octokit client
    const octokit = getOctokit();

    // Check for duplicate issues if requested
    if (checkForDuplicates) {
      try {
        // First check open issues
        const openIssues = await getGitHubIssues(repoUrl, 'open');
        
        // Look for Template Doctor Analysis issues with matching title pattern
        const openSimilarIssues = findSimilarIssues(openIssues.issues, issueTitle);
        
        if (openSimilarIssues.length > 0) {
          // Update the first similar issue instead of creating a new one
          console.log(`Found similar open issue #${openSimilarIssues[0].number}. Updating instead of creating.`);
          const response = await updateGitHubIssue(
            repoUrl, 
            openSimilarIssues[0].number, 
            issueTitle, 
            issueBody, 
            false,
            assignee
          );
          return { ...response, updated: true };
        }
        
        // If no open issues found, check closed issues
        const closedIssues = await getGitHubIssues(repoUrl, 'closed');
        const closedSimilarIssues = findSimilarIssues(closedIssues.issues, issueTitle);
        
        if (closedSimilarIssues.length > 0) {
          // Reopen and update the first closed issue
          console.log(`Found similar closed issue #${closedSimilarIssues[0].number}. Reopening and updating.`);
          const response = await updateGitHubIssue(
            repoUrl, 
            closedSimilarIssues[0].number, 
            issueTitle, 
            issueBody, 
            true,
            assignee
          );
          return { ...response, updated: true };
        }
      } catch (error) {
        // If we can't check for duplicates, just proceed with creation
        console.warn("Could not check for duplicate issues, proceeding with creation:", error);
      }
    }
    
    // Check if this is a request to assign to Copilot
    if (assignee === "Copilot" || assignee === "copilot-swe-agent") {
      try {
        // For Copilot assignment, we need to use GraphQL API directly to create the issue
        console.log("Creating issue with Copilot assignment using GraphQL API...");
        
        const githubToken = process.env.GITHUB_TOKEN;
        
        if (!githubToken) {
          throw new Error('GITHUB_TOKEN environment variable is not set. Please set it to a valid GitHub Personal Access Token.');
        }
        
        const graphqlWithAuth = graphql.defaults({
          headers: {
            authorization: `token ${githubToken}`
          }
        });
        
        // First get the repository ID and check if Copilot is available
        const repoData: any = await graphqlWithAuth(`
          query GetRepoAndCopilotInfo($owner: String!, $repo: String!) {
            repository(owner: $owner, name: $repo) {
              id
              suggestedActors(capabilities: [CAN_BE_ASSIGNED], first: 10) {
                nodes {
                  login
                  __typename
                  ... on Bot {
                    id
                  }
                  ... on User {
                    id
                  }
                }
              }
            }
          }
        `, {
          owner,
          repo
        });
        
        const repoId = repoData.repository.id;
        
        // Find the Copilot bot in the suggested actors
        const copilotActor = repoData.repository.suggestedActors.nodes.find(
          (actor: any) => actor.login === "copilot-swe-agent"
        );
        
        if (!copilotActor) {
          console.warn("Copilot bot not found in suggested actors. Creating issue without Copilot assignment.");
          
          // Fall back to regular issue creation
          const requestParams: any = {
            owner,
            repo,
            title: issueTitle,
            body: issueBody,
            labels
          };
          
          const response = await octokit.issues.create(requestParams);
          
          return {
            html_url: response.data.html_url,
            number: response.data.number,
            updated: false
          };
        }
        
        // Create the issue with Copilot assignment in one step using GraphQL
        const createIssueResult: any = await graphqlWithAuth(`
          mutation CreateIssue($input: CreateIssueInput!) {
            createIssue(input: $input) {
              issue {
                number
                url
              }
            }
          }
        `, {
          input: {
            repositoryId: repoId,
            title: issueTitle,
            body: issueBody,
            assigneeIds: [copilotActor.id],
            labelIds: [] // We'll add labels separately as we only have label names, not IDs
          }
        });
        
        // Add labels using REST API since GraphQL requires label IDs
        if (labels && labels.length > 0) {
          await octokit.issues.addLabels({
            owner,
            repo,
            issue_number: createIssueResult.createIssue.issue.number,
            labels
          });
        }
        
        console.log(`Created issue #${createIssueResult.createIssue.issue.number} with Copilot assignment`);
        
        return {
          html_url: createIssueResult.createIssue.issue.url,
          number: createIssueResult.createIssue.issue.number,
          updated: false
        };
      } catch (error) {
        console.warn("Failed to create issue with Copilot assignment via GraphQL:", error);
        console.log("Falling back to REST API and separate assignment...");
        // Continue with REST API if GraphQL approach fails
      }
    }
    
    // Create the issue using REST API
    const requestParams: any = {
      owner,
      repo,
      title: issueTitle,
      body: issueBody,
      labels
    };

    // Only include assignees for non-Copilot assignees
    if (assignee && assignee !== "Copilot" && assignee !== "copilot-swe-agent") {
      requestParams.assignees = [assignee];
    }

    const response = await octokit.issues.create(requestParams);
    
    // If this is an issue meant for Copilot, try to assign it separately
    if (assignee === "Copilot" || assignee === "copilot-swe-agent") {
      try {
        // Using the newly created issue number
        await assignIssueToCopilotBot(repoUrl, response.data.number);
      } catch (error) {
        console.warn("Could not assign issue to Copilot bot:", error);
        // Continue even if Copilot assignment fails
      }
    }
    
    return {
      html_url: response.data.html_url,
      number: response.data.number,
      updated: false
    };
  }  catch (error) {
    console.error("Failed to create GitHub issue:", error);
    
    // Check if this is an error about issues being disabled
    if (error instanceof Error) {
      const errorObj: any = error;
      
      // Extract the original error data if available (might be in different places depending on the error source)
      const originalErrorData = errorObj.response?.data || errorObj.data || {};
      
      // Check for GitHub API error response about disabled issues (status 410 Gone or 403 Forbidden)
      if (errorObj.message?.includes('Issues are disabled for this repo') || 
          (originalErrorData?.message === 'Issues are disabled for this repo')) {
        
        // Create enhanced error that preserves the original error data
        const enhancedError = new Error(originalErrorData?.message || 'Issues are disabled for this repository. Please enable issues in the repository settings to use this feature.');
        (enhancedError as any).code = originalErrorData?.code || 'ISSUES_DISABLED';
        (enhancedError as any).originalError = error;
        (enhancedError as any).data = originalErrorData;
        (enhancedError as any).documentation_url = originalErrorData?.documentation_url;
        // Make sure status is always an integer (410 is Gone, which is appropriate for disabled resources)
        (enhancedError as any).status = parseInt(originalErrorData?.status as string) || 
                                        parseInt(errorObj.response?.status as string) || 
                                        410;
        throw enhancedError;
      }
      
      // For other errors, preserve as much information as possible
      if (originalErrorData && Object.keys(originalErrorData).length > 0) {
        // Enhance the error with additional properties from the GitHub API response
        errorObj.data = originalErrorData;
        errorObj.documentation_url = originalErrorData?.documentation_url;
        errorObj.status = originalErrorData?.status || errorObj.response?.status;
        errorObj.code = originalErrorData?.code;
      }
    }
    
    throw error;
  }
}

/**
 * Updates an existing GitHub issue with new content
 * @param repoUrl GitHub repository URL
 * @param issueNumber Issue number to update
 * @param issueTitle Updated issue title
 * @param issueBody Updated issue body
 * @param reopen Whether to reopen a closed issue
 * @param assignee Optional assignee for the issue
 * @returns Updated issue information
 */
export async function updateGitHubIssue(
  repoUrl: string,
  issueNumber: number,
  issueTitle: string,
  issueBody: string,
  reopen: boolean = false,
  assignee?: string
): Promise<{ html_url: string; number: number }> {
  try {
    // Extract owner and repo from the URL
    const urlParts = new URL(repoUrl).pathname.split('/').filter(Boolean);
    const owner = urlParts[0];
    const repo = urlParts[1];
    
    // Get authenticated Octokit client
    const octokit = getOctokit();
    
    // Prepare update parameters
    const updateParams: any = {
      owner,
      repo,
      issue_number: issueNumber,
      title: issueTitle,
      body: issueBody
    };
    
    // Only include assignees if an assignee is provided and it's not for Copilot
    // For Copilot, we'll use GraphQL API after updating the issue
    if (assignee && assignee !== "Copilot" && assignee !== "copilot-swe-agent") {
      updateParams.assignees = [assignee];
    }
    
    // If reopening, set the state to open
    if (reopen) {
      updateParams.state = 'open';
    }
    
    // Update the issue
    const response = await octokit.issues.update(updateParams);
    
    // If this is an issue meant for Copilot, try to assign it directly to the Copilot bot
    // This is a special case since Copilot requires GraphQL API to assign
    if (assignee === "Copilot" || assignee === "copilot-swe-agent") {
      try {
        await assignIssueToCopilotBot(repoUrl, issueNumber);
      } catch (error) {
        console.warn("Could not assign issue to Copilot bot:", error);
        // Continue even if Copilot assignment fails
      }
    }
    
    return {
      html_url: response.data.html_url,
      number: response.data.number
    };
  } catch (error) {
    console.error(`Failed to update GitHub issue #${issueNumber}:`, error);
    throw error;
  }
}

/**
 * Helper function to find similar issues by title pattern
 */
function findSimilarIssues(issues: any[], title: string): any[] {
  return issues.filter(issue => {
    // Extract date from titles if they exist in the format [YYYY-MM-DD]
    const titleDateMatch = title.match(/\[(\d{4}-\d{2}-\d{2})\]/);
    const issueDateMatch = issue.title?.match(/\[(\d{4}-\d{2}-\d{2})\]/);
    
    const titleDate = titleDateMatch ? titleDateMatch[1] : null;
    const issueDate = issueDateMatch ? issueDateMatch[1] : null;
    
    if (titleDate && issueDate && titleDate === issueDate) {
      // If both have dates and they match, consider them similar
      return true;
    }
    
    // Remove the date part and check for title similarity
    const baseTitle = title.replace(/\[\d{4}-\d{2}-\d{2}\]/, '').trim();
    const issueBaseTitle = issue.title?.replace(/\[\d{4}-\d{2}-\d{2}\]/, '').trim();
    
    // Check if the title starts with Template Doctor Analysis
    if (!issueBaseTitle?.startsWith('Template Doctor Analysis:')) {
      return false;
    }
    
    // Fuzzy match the remaining title
    return issueBaseTitle?.includes(baseTitle) || baseTitle.includes(issueBaseTitle);
  });
}

/**
 * Starts an AZD provision test for a repository
 * Without the MCP server, this creates a new GitHub issue to track the request
 */
export async function testAzdProvision(
  repoUrl: string,
  environment: string = 'dev'
): Promise<{ runId: string; status: string; issueUrl?: string; issueNumber?: number }> {
  try {
    // Extract owner and repo from the URL
    const urlParts = new URL(repoUrl).pathname.split('/').filter(Boolean);
    const owner = urlParts[0];
    const repo = urlParts[1];
    
    // Get authenticated Octokit client
    const octokit = getOctokit();
    
    // Without the MCP server, we'll create a GitHub issue to track this request
    // The issue will include instructions on how to run AZD provisioning manually
    
    // Create a unique run ID to track this job
    const runId = `azd-provision-${Date.now()}`;
    
    // Format the issue body with instructions
    const issueBody = `
# AZD Provision Test

This issue was automatically created to track an AZD provision test for this repository.

## Details
- Environment: ${environment}
- Run ID: \`${runId}\`
- Requested on: ${new Date().toISOString()}

## Instructions

To run the AZD provision test manually:

1. Clone this repository
2. Install the Azure Developer CLI (AZD) if not already installed:
   https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/install-azd
3. Run \`azd auth login\`
4. Run \`azd provision -e ${environment}\`

## Status

This issue will be updated with the status of the provision test.
`;

    // Create the issue
    const issue = await octokit.issues.create({
      owner,
      repo,
      title: `AZD Provision Test [${environment}] ${new Date().toISOString().split('T')[0]}`,
      body: issueBody,
      labels: ["azd-provision-test"]
    });
    
    console.log(`Created AZD provision test issue: ${issue.data.html_url}`);
    
    return {
      runId,
      status: 'pending',
      issueUrl: issue.data.html_url,
      issueNumber: issue.data.number
    };
  } catch (error) {
    console.error("Failed to start AZD provision test:", error);
    throw error;
  }
}

/**
 * Gets the status of an AZD provisioning job
 * Without the MCP server, this method checks GitHub Actions workflow runs
 */
export async function getAzdProvisionStatus(runId: string): Promise<{
  status: "pending" | "running" | "completed" | "failed";
  progress?: string;
  success?: boolean;
  logs?: string;
  error?: string;
}> {
  try {
    // Since we no longer have an MCP server to track the status,
    // we'll need to rely on GitHub issues to track this
    console.log(`Checking status for AZD provision test ${runId}`);
    console.log(`Note: Without the MCP server, detailed status is not available`);
    console.log(`Check the GitHub repository for workflow runs and issues with label 'azd-provision-test'`);
    
    // Return a placeholder status
    return {
      status: "pending",
      progress: "GitHub Actions workflow may be running. Check the repository's Actions tab.",
      success: undefined,
      logs: "Logs not available without MCP server. Please check GitHub Actions logs."
    };
  } catch (error) {
    console.error("Failed to get AZD provision status:", error);
    throw error;
  }
}

/**
 * Gets open GitHub issues for a repository
 * This helps prevent duplicate issue creation
 */
export async function getGitHubIssues(
  repoUrl: string,
  state: 'open' | 'closed' | 'all' = 'open',
  labels: string[] = []
): Promise<{ issues: Array<{ title: string; body: string; html_url: string; number: number; labels?: string[]; state?: string }> }> {
  try {
    // Extract owner and repo from the URL
    const urlParts = new URL(repoUrl).pathname.split('/').filter(Boolean);
    const owner = urlParts[0];
    const repo = urlParts[1];
    
    // Get authenticated Octokit client
    const octokit = getOctokit();
    
    // Get issues from the repository
    const params: any = {
      owner,
      repo,
      state,
      per_page: 100 // Limit to most recent 100 issues for performance
    };
    
    // Add labels filter if provided
    if (labels && labels.length > 0) {
      params.labels = labels.join(',');
    }
    
    const response = await octokit.issues.listForRepo(params);
    
    // Return simplified issue data
    return {
      issues: response.data.map(issue => ({
        title: issue.title,
        body: issue.body || '',
        html_url: issue.html_url,
        number: issue.number,
        labels: issue.labels?.map((label: any) => typeof label === 'string' ? label : label.name),
        state: issue.state
      }))
    };
  } catch (error) {
    console.error("Failed to get GitHub issues:", error);
    throw error;
  }
}

/**
 * Creates a sub-issue linked to a parent issue 
 * @param repoUrl GitHub repository URL
 * @param issueTitle Issue title
 * @param issueBody Issue body
 * @param parentIssueNumber The number of the parent issue to link this to
 * @param issueId Optional unique ID for the issue for deduplication
 * @param labels Optional labels to add to the issue
 * @param assignee Optional assignee for the issue
 * @returns Created issue information
 */
export async function createSubIssue(
  repoUrl: string,
  issueTitle: string,
  issueBody: string,
  parentIssueNumber: number,
  issueId?: string,
  labels: string[] = ["template-doctor-issue"],
  assignee?: string
): Promise<{ html_url: string; number: number; updated?: boolean; existed?: boolean }> {
  try {
    // Extract owner and repo from the URL
    const urlParts = new URL(repoUrl).pathname.split('/').filter(Boolean);
    const owner = urlParts[0];
    const repo = urlParts[1];
    
    // Get authenticated Octokit client
    const octokit = getOctokit();
    
    // Add a reference to the parent issue
    const bodyWithReference = `${issueBody}\n\n_This issue is part of [Template Doctor Full Scan #${parentIssueNumber}](${repoUrl}/issues/${parentIssueNumber})._`;
    
    // Add a unique identifier if provided
    const finalBody = issueId ? 
      `${bodyWithReference}\n\n<!-- Issue ID: ${issueId} -->` : 
      bodyWithReference;
    
    // Check for duplicate issues with the same ID - check both open and closed
    if (issueId) {
      try {
        // Check open issues first
        const openIssues = await getGitHubIssues(repoUrl, 'open');
        
        // Look for issues with the same ID
        const existingOpenIssue = openIssues.issues.find(issue => {
          const idMatch = issue.body.match(/<!-- Issue ID: (.+?) -->/);
          return idMatch && idMatch[1] === issueId;
        });
        
        if (existingOpenIssue) {
          // Update the existing issue instead of creating a new one
          console.log(`Found existing open issue #${existingOpenIssue.number} with ID ${issueId}. Updating instead of creating.`);
          const response = await updateGitHubIssue(repoUrl, existingOpenIssue.number, issueTitle, finalBody, false, assignee);
          return { ...response, updated: true, existed: true };
        }
        
        // If no open issue found with this ID, check closed issues
        const closedIssues = await getGitHubIssues(repoUrl, 'closed');
        
        const existingClosedIssue = closedIssues.issues.find(issue => {
          const idMatch = issue.body.match(/<!-- Issue ID: (.+?) -->/);
          return idMatch && idMatch[1] === issueId;
        });
        
        if (existingClosedIssue) {
          // Reopen and update the closed issue
          console.log(`Found existing closed issue #${existingClosedIssue.number} with ID ${issueId}. Reopening and updating.`);
          const response = await updateGitHubIssue(repoUrl, existingClosedIssue.number, issueTitle, finalBody, true, assignee);
          return { ...response, updated: true, existed: true };
        }
      } catch (error) {
        // If we can't check for duplicates, just proceed with creation
        console.warn("Could not check for duplicate issues, proceeding with creation:", error);
      }
    }
    
    // Create the issue with assignee if provided
    const createParams: any = {
      owner,
      repo,
      title: issueTitle,
      body: finalBody,
      labels
    };
    
    // Only include assignee if provided and it's not for Copilot
    // For Copilot, we'll use GraphQL API after creating the issue
    if (assignee && assignee !== "Copilot" && assignee !== "copilot-swe-agent") {
      createParams.assignees = [assignee];
    }
    
    const response = await octokit.issues.create(createParams);
    
    // If this is an issue meant for Copilot, try to assign it directly to the Copilot bot
    if (assignee === "Copilot" || assignee === "copilot-swe-agent") {
      try {
        await assignIssueToCopilotBot(repoUrl, response.data.number);
      } catch (error) {
        console.warn("Could not assign issue to Copilot bot:", error);
        // Continue even if Copilot assignment fails
      }
    }
    
    return {
      html_url: response.data.html_url,
      number: response.data.number,
      updated: false,
      existed: false
    };
  } catch (error) {
    console.error("Failed to create sub-issue:", error);
    throw error;
  }
}

/**
 * Assigns an issue to a Copilot project (not to the Copilot bot)
 * @param repoUrl GitHub repository URL
 * @param issueNumber Issue number to assign
 * @param projectId Copilot project ID to assign the issue to
 */
export async function assignIssueToCopilot(
  _repoUrl: string, // Adding underscore prefix to indicate it's intentionally unused
  issueNumber: number,
  projectId: string
): Promise<void> {
  try {
    // We only need the projectId and issueNumber which are passed as parameters
    
    // Assign the issue to the project using GraphQL
    const query = `
      mutation($input: AddProjectCardsInput!) {
        addProjectCards(input: $input) {
          clientMutationId
        }
      }
    `;
    
    const variables = {
      input: {
        projectId,
        issueIds: [issueNumber]
      }
    };
    
    await graphql(query, {
      ...variables,
      headers: {
        authorization: `token ${process.env.GITHUB_TOKEN}`
      }
    });
    
    console.log(`Assigned issue #${issueNumber} to Copilot project ${projectId}`);
  } catch (error) {
    console.error("Failed to assign issue to Copilot project:", error);
    throw error;
  }
}

/**
 * Assigns an issue directly to the Copilot bot using GraphQL API
 * This is different from assignIssueToCopilot which adds issues to a Copilot project
 * @param repoUrl GitHub repository URL
 * @param issueNumber Issue number to assign
 * @returns True if successful, false otherwise
 */
export async function assignIssueToCopilotBot(
  repoUrl: string,
  issueNumber: number
): Promise<boolean> {
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    
    if (!githubToken) {
      throw new Error('GITHUB_TOKEN environment variable is not set. Please set it to a valid GitHub Personal Access Token.');
    }
    
    // Extract owner and repo from the URL directly into variables for the GraphQL query
    const urlParts = new URL(repoUrl).pathname.split('/').filter(Boolean);
    
    const graphqlWithAuth = graphql.defaults({
      headers: {
        authorization: `token ${githubToken}`
      }
    });
    
    // First, get both the issue ID and verify that Copilot is available for assignment
    const repoData: any = await graphqlWithAuth(`
      query GetIssueIdAndCopilotInfo($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            id
          }
          # Check for available actors that can be assigned
          suggestedActors(capabilities: [CAN_BE_ASSIGNED], first: 10) {
            nodes {
              login
              __typename
              ... on Bot {
                id
              }
              ... on User {
                id
              }
            }
          }
        }
      }
    `, {
      owner: urlParts[0],
      repo: urlParts[1],
      number: issueNumber
    });
    
    const issueId = repoData.repository.issue.id;
    
    // Find the Copilot bot in the suggested actors
    const copilotActor = repoData.repository.suggestedActors.nodes.find(
      (actor: any) => actor.login === "copilot-swe-agent"
    );
    
    if (!copilotActor) {
      console.warn("Copilot bot not found in suggested actors. Make sure Copilot is enabled for this repository.");
      return false;
    }
    
    // Then assign the issue to Copilot bot using its actual ID
    await graphqlWithAuth(`
      mutation AssignCopilot($issueId: ID!, $assigneeId: ID!) {
        addAssigneesToAssignable(input: {
          assignableId: $issueId,
          assigneeIds: [$assigneeId]
        }) {
          clientMutationId
        }
      }
    `, {
      issueId,
      assigneeId: copilotActor.id
    });
    
    console.log(`Assigned issue #${issueNumber} to Copilot bot`);
    return true;
  } catch (error) {
    console.error("Failed to assign issue to Copilot bot:", error);
    return false;
  }
}
