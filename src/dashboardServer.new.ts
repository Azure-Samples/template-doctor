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
      
      // API endpoints
      
      // GitHub Issue Creation Endpoint
      app.post('/api/github-issue', express.json(), async (req, res) => {
        try {
          const { repoUrl, title, body, labels, checkForDuplicates = true } = req.body;
          
          if (!repoUrl || !title || !body) {
            res.status(400).json({ error: "Missing required parameters: repoUrl, title, body" });
            return;
          }
          
          console.log(`Creating GitHub issue: ${title} for ${repoUrl}`);
          
          // Add date in square brackets to title if it's not there yet
          const today = new Date();
          const formattedDate = `[${today.toISOString().split('T')[0]}]`;
          const finalTitle = title.includes('[20') ? title : `${title} ${formattedDate}`;
          
          if (checkForDuplicates) {
            try {
              // Check for existing issues with similar titles
              const issueKeywords = title.split(' ').filter((word: string) => word.length > 4);
              const { issues } = await getGitHubIssues(repoUrl, 'open');                // Check if there's a similar issue based on title
              const similarIssue = issues.find(issue => {
                if (title === issue.title) return true;
                
                // Check if the issue is about the same topic
                if (issue.title.includes('Template Doctor') && 
                    issueKeywords.some((keyword: string) => issue.title.includes(keyword))) {
                  return true;
                }
                
                return false;
              });
              
              if (similarIssue) {
                // Instead of creating a duplicate, update the existing issue
                console.log(`Found similar issue #${similarIssue.number}, updating instead of creating new`);
                const response = await updateGitHubIssue(repoUrl, similarIssue.number, finalTitle, body);
                const enhancedResponse = { 
                  ...response, 
                  updated: true  // Add flag to indicate this was an update
                };
                res.json(enhancedResponse);
                return;
              }
            } catch (error) {
              console.warn("Error checking for duplicate issues, proceeding with creation:", error);
              // Continue with creating a new issue if checking fails
            }
          }
          
          const response = await createGitHubIssue(repoUrl, finalTitle, body, labels);
          res.json(response);
        } catch (error) {
          console.error("Error creating GitHub issue:", error);
          res.status(500).json({ error: (error as Error).message });
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
