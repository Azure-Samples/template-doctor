import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import open from 'open';
import serveStatic from 'serve-static';
import { existsSync } from 'fs';
import { Server } from 'http';
import { createGitHubIssue, testAzdProvision, getAzdProvisionStatus, getGitHubIssues, updateGitHubIssue } from './mcpClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ServerInfo {
  url: string;
  server: Server;
  close: () => void;
}

interface ServerError extends Error {
  code?: string;
}

/**
 * Serves a dashboard on localhost with the specified port
 * @param dashboardPath - Path to the dashboard HTML file
 * @param port - Port to serve the dashboard on
 * @returns Server information
 */
export async function serveDashboard(dashboardPath: string, port = 3000): Promise<ServerInfo> {
  return new Promise((resolve, reject) => {
    try {
      const app = express();
      
      // Get the directory of the dashboard file (results dir or a repo subdir)
      const dashboardDir = path.dirname(dashboardPath);
      
      // Get the base results directory (go up one level if in a repo subdir)
      const resultsBaseDir = path.resolve(dashboardDir, '..');
      const isRepoSubdir = path.basename(resultsBaseDir) === 'results';
      const resultsDir = isRepoSubdir ? resultsBaseDir : dashboardDir;
      
      console.log(`Serving entire results directory: ${resultsDir}`);
      
      // Serve the entire results directory and all subdirectories
      app.use(serveStatic(resultsDir));
      
      // Serve the assets directory
      const assetsDir = path.resolve(__dirname, '..', 'assets');
      app.use('/assets', serveStatic(assetsDir));
      
      // Serve the index at root or redirect to index if we're opening a specific report
      app.get('/', (_req, res) => {
        // Check if we have a template-index.html file in the results directory
        const indexPath = path.join(resultsDir, 'template-index.html');
        if (existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.sendFile(dashboardPath);
        }
      });
      
      // API endpoints - Defined below
      
      // Add middleware to inject a back button into HTML files
      app.use((req, res, next) => {
        // Store the original send method
        const originalSend = res.send;
        
        // Override send method
        res.send = function(body) {
          // Only process HTML files
          if (typeof body === 'string' && req.path.endsWith('.html') && !req.path.includes('template-index.html')) {
            // Add a back button to the HTML content
            const backButton = `
              <div style="position: fixed; top: 10px; right: 10px; z-index: 1000;">
                <a href="/template-index.html" style="display: inline-block; padding: 8px 16px; background-color: #0078d4; color: white; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: 500;">
                  <span style="margin-right: 5px;">&#8592;</span> Back to Index
                </a>
              </div>
            `;
            
            // Insert the back button after the opening body tag
            body = body.replace('<body>', '<body>' + backButton);
          }
          
          // Call the original send method
          return originalSend.call(this, body);
        };
        
        next();
      });
      
      // API endpoints
      
      // GitHub Issue Creation Endpoint
      app.post('/api/github-issue', express.json(), async (req, res) => {
        try {
          const { repoUrl, title, body, labels, checkForDuplicates = false, assignee } = req.body;
          
          if (!repoUrl || !title || !body) {
            res.status(400).json({ error: "Missing required parameters: repoUrl, title, body" });
            return;
          }
          
          // Extract date from the title if it exists in the format [YYYY-MM-DD]
          const dateMatch = title.match(/\[(\d{4}-\d{2}-\d{2})\]/);
          const dateStr = dateMatch ? dateMatch[1] : null;
          
          let updated = false;
          let response;
          
          // Check for duplicate issues if requested
          if (checkForDuplicates) {
            try {
              // First check open issues
              const openIssues = await getGitHubIssues(repoUrl, 'open');
              
              // Look for similar open issues with the same date or title pattern
              const openSimilarIssues = openIssues.issues.filter(issue => {
                // Check if it's a Template Doctor issue first
                if (!issue.title.startsWith('Template Doctor')) {
                  return false;
                }
                
                if (dateStr && issue.title.includes(dateStr)) {
                  // If we have a date in the new title, look for matching date
                  return true;
                }
                
                // Otherwise look for similar title (without the date part)
                const baseTitle = title.replace(/\[\d{4}-\d{2}-\d{2}\]/, '').trim();
                const issueBaseTitle = issue.title.replace(/\[\d{4}-\d{2}-\d{2}\]/, '').trim();
                
                return issueBaseTitle.includes(baseTitle) || baseTitle.includes(issueBaseTitle);
              });
              
              if (openSimilarIssues.length > 0) {
                // Update the first similar issue instead of creating a new one
                console.log(`Found similar open issue #${openSimilarIssues[0].number}. Updating instead of creating.`);
                response = await updateGitHubIssue(repoUrl, openSimilarIssues[0].number, title, body, false, assignee);
                updated = true;
              } else {
                // Check closed issues
                const closedIssues = await getGitHubIssues(repoUrl, 'closed');
                
                // Look for similar closed issues
                const closedSimilarIssues = closedIssues.issues.filter(issue => {
                  // Check if it's a Template Doctor issue first
                  if (!issue.title.startsWith('Template Doctor')) {
                    return false;
                  }
                  
                  if (dateStr && issue.title.includes(dateStr)) {
                    return true;
                  }
                  
                  const baseTitle = title.replace(/\[\d{4}-\d{2}-\d{2}\]/, '').trim();
                  const issueBaseTitle = issue.title.replace(/\[\d{4}-\d{2}-\d{2}\]/, '').trim();
                  
                  return issueBaseTitle.includes(baseTitle) || baseTitle.includes(issueBaseTitle);
                });
                
                if (closedSimilarIssues.length > 0) {
                  // Reopen and update the first closed issue
                  console.log(`Found similar closed issue #${closedSimilarIssues[0].number}. Reopening and updating.`);
                  response = await updateGitHubIssue(repoUrl, closedSimilarIssues[0].number, title, body, true, assignee);
                  updated = true;
                }
              }
            } catch (error) {
              // If we can't check for duplicates, just proceed with creation
              console.warn("Could not check for duplicate issues:", error);
            }
          }
          
          // Create a new issue if no duplicate was found or update failed
          if (!response) {
            console.log(`Creating GitHub issue: ${title} for ${repoUrl}`);
            response = await createGitHubIssue(repoUrl, title, body, labels, checkForDuplicates, assignee);
          }
          
          res.json({ ...response, updated });
        } catch (error) {
          console.error("Error creating GitHub issue:", error);
               // Check for specific GitHub API errors about disabled issues
      const errorMsg = (error as Error).message;
      const errorObj: any = error;
      
      // Check for our enhanced error with ISSUES_DISABLED code
      if (errorObj.code === 'ISSUES_DISABLED' || errorMsg.includes('Issues are disabled for this repo')) {
        const originalErrorData = errorObj.data || {};
        
        // Make sure we use an integer for the status code
        // Parse the status to an integer or use a default value (410 for disabled issues)
        const statusCode = parseInt(originalErrorData.status) || 410;
        
        // Return error response with all GitHub error details preserved
        res.status(statusCode).json({ 
          error: originalErrorData.message || "Issues are disabled for this repository. Please enable issues in the repository settings to use this feature.",
          message: originalErrorData.message || errorMsg, // Include the exact message from GitHub
          documentation_url: originalErrorData.documentation_url || "https://docs.github.com/v3/issues/",
          status: statusCode,
          code: originalErrorData.code || "ISSUES_DISABLED"
        });
      } else {
        // For other errors, forward the exact error message to make debugging easier
        // Make sure status is an integer
        const status = parseInt(errorObj.response?.status) || 500;
        const errorData = errorObj.response?.data || {};
        
        res.status(status).json({ 
          error: errorMsg,
          message: errorData.message || errorMsg,
          documentation_url: errorData.documentation_url,
          status: status,
          code: errorData.code
        });
      }
        }
      });
      
      // GitHub Issues Listing Endpoint - used to check for duplicates
      app.get('/api/github-issues', async (req, res) => {
        try {
          const repoUrl = req.query.repoUrl as string;
          const state = req.query.state as 'open' | 'closed' | 'all' || 'open';
          
          if (!repoUrl) {
            res.status(400).json({ error: "Missing required parameter: repoUrl" });
            return;
          }
          
          console.log(`Getting GitHub issues for ${repoUrl} (state: ${state})`);
          
          const issues = await getGitHubIssues(repoUrl, state);
          res.json(issues);
        } catch (error) {
          console.error("Error getting GitHub issues:", error);
          res.status(500).json({ error: (error as Error).message });
        }
      });
      
      // AZD Provision Test Endpoint
      app.post('/api/provision', express.json(), async (req, res) => {
        try {
          const { repoUrl, environment = 'dev' } = req.body;
          
          if (!repoUrl) {
            res.status(400).json({ error: "Missing required parameter: repoUrl" });
            return;
          }
          
          console.log(`Starting AZD provision test for ${repoUrl} (environment: ${environment})`);
          
          const response = await testAzdProvision(repoUrl, environment);
          res.json(response);
        } catch (error) {
          console.error("Error starting AZD provision test:", error);
          res.status(500).json({ error: (error as Error).message });
        }
      });
      
      // AZD Provision Status Endpoint
      app.get('/api/provision-status', async (req, res) => {
        try {
          const runId = req.query.runId as string;
          
          if (!runId) {
            res.status(400).json({ error: "Missing required parameter: runId" });
            return;
          }
          
          console.log(`Checking status for AZD provision test ${runId}`);
          
          const status = await getAzdProvisionStatus(runId);
          res.json(status);
        } catch (error) {
          console.error("Error checking provision status:", error);
          res.status(500).json({ error: (error as Error).message });
        }
      });
      
      // API endpoint for creating sub-issues
      app.post('/api/github-sub-issue', express.json(), async (req, res) => {
        try {
          const { 
            repoUrl, 
            title, 
            body, 
            parentIssueNumber, 
            issueId, 
            labels = ["template-doctor-issue"],
            assignee 
          } = req.body;
          
          if (!repoUrl || !title || !body || !parentIssueNumber) {
            res.status(400).json({ error: "Missing required parameters: repoUrl, title, body, parentIssueNumber" });
            return;
          }
          
          console.log(`Creating GitHub sub-issue: ${title} for parent #${parentIssueNumber}`);
          
          // Import the createSubIssue function
          const { createSubIssue } = await import('./mcpClient.js');
          
          const response = await createSubIssue(
            repoUrl, 
            title, 
            body, 
            parentIssueNumber, 
            issueId, 
            labels,
            assignee
          );
          
          res.json(response);
        } catch (error) {
          console.error("Error creating GitHub sub-issue:", error);
          res.status(500).json({ error: (error as Error).message });
        }
      });
      
      // API endpoint for reopening a closed issue
      app.post('/api/reopen-issue', express.json(), async (req, res) => {
        try {
          const { repoUrl, issueNumber, assignee } = req.body;
          
          if (!repoUrl || !issueNumber) {
            res.status(400).json({ error: "Missing required parameters: repoUrl, issueNumber" });
            return;
          }
          
          console.log(`Reopening GitHub issue #${issueNumber}`);
          
          // Use updateGitHubIssue function with a dummy title/body
          // We'll set these to their original values when we fetch them
          const response = await updateGitHubIssue(
            repoUrl,
            issueNumber,
            "Reopening issue",
            "Reopening closed issue...",
            true, // Flag to reopen the issue
            assignee
          );
          
          res.json({
            html_url: response.html_url,
            number: response.number,
            reopened: true
          });
        } catch (error) {
          console.error("Error reopening GitHub issue:", error);
          res.status(500).json({ error: (error as Error).message });
        }
      });
      
      // Start the server
      const server = app.listen(port, () => {
        const url = `http://localhost:${port}`;
        console.log(`🌐 Dashboard server running at: ${url}`);
        
        resolve({
          url,
          server,
          close: () => {
            server.close();
            console.log('Dashboard server closed');
          }
        });
      });
      
      // Handle server errors
      server.on('error', (err: ServerError) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`Port ${port} is already in use, trying ${port + 1}...`);
          // Try again with the next port
          serveDashboard(dashboardPath, port + 1)
            .then(resolve)
            .catch(reject);
        } else {
          reject(err);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Opens a dashboard in the default browser
 * @param dashboardPath - Path to the dashboard HTML file
 * @param port - Port to serve the dashboard on
 * @returns Server information
 */
export async function openDashboard(dashboardPath: string, port = 3000): Promise<ServerInfo> {
  console.log(`Opening dashboard at ${dashboardPath} on port ${port}`);
  const serverInfo = await serveDashboard(dashboardPath, port);
  
  // Calculate the relative URL path from the absolute file path
  // This ensures we navigate to the correct dashboard file and not just the root
  
  // Get the relative path for URL construction
  // We need to ensure this generates a proper URL that the browser can access
  let urlPath;
  
  if (path.basename(dashboardPath) === 'template-index.html') {
    // For the template index, just use the index
    urlPath = 'template-index.html';
  } else {
    // For repo-specific dashboards, preserve the full path from the results dir
    // First get the repo name from the path
    const pathParts = dashboardPath.split(path.sep);
    const repoIndex = pathParts.findIndex(p => p === 'results') + 1;
    if (repoIndex > 0 && repoIndex < pathParts.length) {
      // Construct the path starting from the repo name folder
      urlPath = pathParts.slice(repoIndex).join('/');
    } else {
      // Fallback to just the file name
      urlPath = path.basename(dashboardPath);
    }
  }
  
  // Build the URL with the relative path
  const dashboardUrl = `${serverInfo.url}/${urlPath}`;
  
  // Open the dashboard in the default browser
  console.log(`Opening URL in browser: ${dashboardUrl}`);
  await open(dashboardUrl);
  
  return serverInfo;
}
