import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Extracts the repository name from a GitHub URL
 * @param url - GitHub repository URL
 * @returns Repository name in format {owner}-{repo}
 */
function extractRepoName(url: string): string {
  const match = url.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (!match) return "unknown-repo";
  return `${match[1]}-${match[2]}`;
}

/**
 * Generates an HTML dashboard from the analysis results
 * @param analysisResults - The analysis results JSON object
 * @param outputPath - The directory where the dashboard should be saved
 * @returns Path to the generated dashboard HTML file
 */
export async function generateDashboard(analysisResults: any, outputPath: string): Promise<string> {
  try {
    // Get the directory name using import.meta.url
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    // Read the dashboard template
    const templatePath = path.resolve(__dirname, 'templates', 'dashboard.html');
    let dashboardTemplate = await fs.readFile(templatePath, 'utf8');
    
    // Extract the repo name from the URL to create a directory
    const repoName = extractRepoName(analysisResults.repoUrl);
    
    // Create timestamp for the file
    const timestamp = new Date().getTime();
    
    // Generate paths for results folder structure
    const resultsBaseDir = path.dirname(outputPath); // 'results' directory
    const repoDir = path.join(resultsBaseDir, repoName);
    
    // Create the template-specific directory
    await fs.mkdir(repoDir, { recursive: true });
    
    // Generate the dashboard HTML file
    const dashboardFilename = `${timestamp}-dashboard.html`;
    const dashboardPath = path.join(repoDir, dashboardFilename);
    
    // Create a data.js file with the report data
    const dataJsFilename = `${timestamp}-data.js`;
    const dataJsPath = path.join(repoDir, dataJsFilename);
    
    // Create a latest.json file to track the latest analysis
    const latestData = {
      timestamp: analysisResults.timestamp,
      dashboardPath: dashboardFilename,
      dataPath: dataJsFilename,
      repoUrl: analysisResults.repoUrl,
      ruleSet: analysisResults.ruleSet || 'dod', // Include the rule set used
      compliance: {
        percentage: analysisResults.compliance.compliant.find((item: any) => item.category === 'meta')?.details?.percentageCompliant || 0,
        issues: analysisResults.compliance.issues.length,
        passed: analysisResults.compliance.compliant.filter((item: any) => item.category !== 'meta').length
      }
    };
    
    // Check if there's existing historical data for this repository
    const historyFilePath = path.join(repoDir, 'history.json');
    const latestFilePath = path.join(repoDir, 'latest.json');
    let historyData = [];
    
    try {
      const historyExists = await fs.stat(historyFilePath).then(() => true).catch(() => false);
      if (historyExists) {
        const historyContent = await fs.readFile(historyFilePath, 'utf8');
        historyData = JSON.parse(historyContent);
      }
    } catch (err) {
      console.warn('Could not read history file, starting with empty history', err);
    }
    
    // Add current analysis to history
    const historyEntry = {
      timestamp: analysisResults.timestamp,
      ruleSet: analysisResults.ruleSet || 'dod', // Include the rule set used
      percentage: analysisResults.compliance.compliant.find((item: any) => item.category === 'meta')?.details?.percentageCompliant || 0,
      issues: analysisResults.compliance.issues.length,
      passed: analysisResults.compliance.compliant.filter((item: any) => item.category !== 'meta').length,
      dashboardPath: dashboardFilename
    };
    
    historyData.push(historyEntry);
    
    // Keep only the last 10 entries
    if (historyData.length > 10) {
      historyData = historyData.slice(historyData.length - 10);
    }
    
    // Write the updated history and latest files
    await fs.writeFile(historyFilePath, JSON.stringify(historyData, null, 2));
    await fs.writeFile(latestFilePath, JSON.stringify(latestData, null, 2));
    
    // Add history to the report data
    const reportDataWithHistory = {
      ...analysisResults,
      history: historyData
    };
    
    // Write the data to a separate JavaScript file with proper JSON escaping
    // Use a simpler approach to avoid parsing errors
    await fs.writeFile(dataJsPath, `window.reportData = ${JSON.stringify(reportDataWithHistory, null, 2)};`);
    
    // Copy the GitHub issue handler script to the repo directory
    const issueHandlerSrc = path.resolve(__dirname, 'templates', 'github-issue-handler.js');
    const issueHandlerDest = path.join(repoDir, 'github-issue-handler.js');
    
    try {
      await fs.copyFile(issueHandlerSrc, issueHandlerDest);
    } catch (err) {
      console.warn('Could not copy GitHub issue handler script:', err);
    }
    
    // Add script tags to load the data file and GitHub issue handler before the closing body tag
    dashboardTemplate = dashboardTemplate.replace('</body>', 
      `<script src="${dataJsFilename}"></script>
       <script src="github-issue-handler.js"></script>
       </body>`);
    
    // Create the dashboard HTML file
    await fs.writeFile(dashboardPath, dashboardTemplate);
    
    // Check if we need to copy assets folder
    const sourceAssetsDir = path.resolve(__dirname, 'templates', 'assets');
    const targetAssetsDir = path.join(resultsBaseDir, 'assets');
    
    try {
      // Check if source assets directory exists
      await fs.access(sourceAssetsDir);
      
      // Create target assets directory if it doesn't exist
      await fs.mkdir(targetAssetsDir, { recursive: true });
      
      // Copy all files from source assets to target assets
      const assetFiles = await fs.readdir(sourceAssetsDir, { withFileTypes: true });
      for (const file of assetFiles) {
        if (file.isDirectory()) {
          // Handle subdirectories
          const subDir = file.name;
          const sourceSubDir = path.join(sourceAssetsDir, subDir);
          const targetSubDir = path.join(targetAssetsDir, subDir);
          
          // Create subdirectory
          await fs.mkdir(targetSubDir, { recursive: true });
          
          // Copy files from subdirectory
          const subFiles = await fs.readdir(sourceSubDir);
          for (const subFile of subFiles) {
            const sourceFilePath = path.join(sourceSubDir, subFile);
            const targetFilePath = path.join(targetSubDir, subFile);
            await fs.copyFile(sourceFilePath, targetFilePath);
          }
        } else {
          // Copy file
          const sourceFilePath = path.join(sourceAssetsDir, file.name);
          const targetFilePath = path.join(targetAssetsDir, file.name);
          await fs.copyFile(sourceFilePath, targetFilePath);
        }
      }
    } catch (err) {
      console.warn('Assets directory not found or could not be copied:', err);
    }
    
    // Update or create the index file with all templates
    await updateIndexFile(resultsBaseDir);

    return dashboardPath;
  } catch (err) {
    console.error('Error generating dashboard:', err);
    throw err;
  }
}

/**
 * Updates or creates an index file with all templates
 * @param resultsBaseDir - The base directory for results
 * @param currentRepoName - The name of the current repository (optional)
 * @param latestData - The latest analysis data (optional)
 */
export async function updateIndexFile(resultsBaseDir: string): Promise<void> {
  try {
    // Create template-index.html if it doesn't exist
    const indexPath = path.join(resultsBaseDir, 'template-index.html');
    const indexTemplate = path.resolve(fileURLToPath(import.meta.url), '..', 'templates', 'index-template.html');
    
    let indexHtml;
    // Check if the template exists, otherwise create a default one
    try {
      indexHtml = await fs.readFile(indexTemplate, 'utf8');
    } catch (err) {
      // Create default template
      indexHtml = createDefaultIndexTemplate();
    }
    
    // Get all repository folders
    const repoDirs = await findRepoDirs(resultsBaseDir);
    
    // Build data for index
    const templatesData = [];
    
    for (const repoDir of repoDirs) {
      const dirPath = path.join(resultsBaseDir, repoDir);
      
      try {
        // Check for latest.json
        const latestFilePath = path.join(dirPath, 'latest.json');
        const latestExists = await fs.stat(latestFilePath).then(() => true).catch(() => false);
        
        if (latestExists) {
          const latestContent = await fs.readFile(latestFilePath, 'utf8');
          const repoData = JSON.parse(latestContent);
          
          // Add path info relative to the index - now using URL-style paths for web server compatibility
          repoData.relativePath = `${repoDir}/${repoData.dashboardPath}`;
          
          templatesData.push(repoData);
        }
      } catch (err) {
        console.warn(`Could not read latest data for ${repoDir}`, err);
      }
    }
    
    // Sort templates by name
    templatesData.sort((a, b) => {
      const nameA = extractRepoName(a.repoUrl).toLowerCase();
      const nameB = extractRepoName(b.repoUrl).toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
    // Create a data.js file for the index
    const indexDataPath = path.join(resultsBaseDir, 'index-data.js');
    await fs.writeFile(
      indexDataPath, 
      `window.templatesData = ${JSON.stringify(templatesData, null, 2)};`
    );
    
    // Add script tag to load the data
    indexHtml = indexHtml.replace('</body>', `<script src="index-data.js"></script></body>`);
    
    // Write the index file
    await fs.writeFile(indexPath, indexHtml);
  } catch (err) {
    console.warn('Error updating index file:', err);
  }
}

/**
 * Finds all repository directories in the results folder
 * @param resultsBaseDir - The base directory for results
 * @returns Array of directory names
 */
async function findRepoDirs(resultsBaseDir: string): Promise<string[]> {
  try {
    const files = await fs.readdir(resultsBaseDir, { withFileTypes: true });
    return files
      .filter(file => file.isDirectory() && !['assets', 'node_modules'].includes(file.name))
      .map(dir => dir.name);
  } catch (err) {
    console.warn('Error reading result directories:', err);
    return [];
  }
}

/**
 * Creates a default index template HTML
 * @returns HTML string for the index template
 */
function createDefaultIndexTemplate(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Template Doctor - Template Index</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root {
            --primary-color: #0078d4;
            --primary-light: #60a5fa;
            --primary-dark: #005a9e;
            --success-color: #107c10;
            --success-light: #dff6dd;
            --warning-color: #d83b01;
            --warning-light: #fed9cc;
            --background-color: #f5f5f5;
            --card-background: #ffffff;
            --text-color: #323130;
            --text-secondary: #605e5c;
            --border-color: #edebe9;
            --shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', sans-serif;
            line-height: 1.6;
            color: var(--text-color);
            background-color: var(--background-color);
        }

        .container {
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
        }

        /* Header Styles */
        header {
            background-color: var(--card-background);
            box-shadow: var(--shadow);
            position: sticky;
            top: 0;
            z-index: 100;
            padding: 16px 0;
        }

        .header-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .logo {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .logo img {
            height: 36px;
            width: auto;
        }

        .logo h1 {
            font-size: 1.5rem;
            font-weight: 600;
        }

        /* Main Content Styles */
        main {
            padding: 32px 0;
        }

        .overview {
            background-color: var(--card-background);
            border-radius: 8px;
            padding: 24px;
            box-shadow: var(--shadow);
            margin-bottom: 24px;
        }

        .overview h2 {
            font-size: 1.25rem;
            margin-bottom: 16px;
            color: var(--primary-color);
        }

        .overview-text {
            margin-bottom: 24px;
            color: var(--text-secondary);
        }

        /* Template Card Styles */
        .templates-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
        }

        .template-card {
            background-color: var(--card-background);
            border-radius: 8px;
            box-shadow: var(--shadow);
            padding: 20px;
            transition: transform 0.2s;
            display: flex;
            flex-direction: column;
        }

        .template-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
        }

        .template-header {
            margin-bottom: 12px;
        }

        .template-name {
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 6px;
            color: var(--primary-color);
        }

        .template-url {
            font-size: 0.85rem;
            color: var(--text-secondary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .template-stats {
            display: flex;
            justify-content: space-between;
            margin: 16px 0;
        }

        .stat-item {
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .stat-value {
            font-size: 1.5rem;
            font-weight: 600;
        }

        .stat-label {
            font-size: 0.75rem;
            color: var(--text-secondary);
        }

        .template-timestamp {
            color: var(--text-secondary);
            font-size: 0.8rem;
            margin-top: auto;
            padding-top: 12px;
            border-top: 1px solid var(--border-color);
            text-align: right;
        }

        .btn {
            display: inline-block;
            padding: 8px 16px;
            background-color: var(--primary-color);
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-size: 0.9rem;
            font-weight: 500;
            margin-top: 12px;
            text-align: center;
            transition: background-color 0.2s;
        }

        .btn:hover {
            background-color: var(--primary-dark);
        }

        .gauge {
            width: 100%;
            height: 8px;
            background-color: #e0e0e0;
            border-radius: 4px;
            overflow: hidden;
            margin: 8px 0;
        }

        .gauge-fill {
            height: 100%;
            border-radius: 4px;
            transition: width 1s;
        }

        .high {
            background-color: var(--success-color);
        }

        .medium {
            background-color: #f0ad4e;
        }

        .low {
            background-color: var(--warning-color);
        }

        .empty-state {
            text-align: center;
            padding: 40px;
            color: var(--text-secondary);
            font-style: italic;
        }

        /* Footer Styles */
        .site-footer {
            background-color: var(--primary-dark);
            color: white;
            padding: 16px 0;
            text-align: center;
            position: fixed;
            bottom: 0;
            width: 100%;
            box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
            z-index: 100;
        }

        .footer-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
        }

        .copyright {
            font-size: 0.9rem;
        }

        /* Add padding to ensure content isn't hidden behind fixed footer */
        body {
            padding-bottom: 60px;
        }

        @media (max-width: 768px) {
            .templates-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <header>
        <div class="container header-content">
            <div class="logo">
                <img src="assets/images/logo.svg" alt="Template Doctor Logo">
                <h1>Template Doctor</h1>
            </div>
        </div>
    </header>

    <main class="container">
        <section class="overview">
            <h2>Azure Template Index</h2>
            <p class="overview-text">
                This page displays all Azure templates that have been analyzed with Template Doctor.
                Select a template to view its detailed compliance report.
            </p>
        </section>

        <div class="templates-grid" id="templates-container">
            <!-- Templates will be populated here via JavaScript -->
            <div class="empty-state" id="empty-state">
                <i class="fas fa-search fa-3x" style="margin-bottom: 16px;"></i>
                <p>No templates have been analyzed yet.</p>
            </div>
        </div>
    </main>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            // Wait for templatesData to be available
            function initIndex() {
                if (typeof window.templatesData === 'undefined') {
                    setTimeout(initIndex, 100);
                    return;
                }
                
                const templatesContainer = document.getElementById('templates-container');
                const emptyState = document.getElementById('empty-state');
                
                // If no templates, show empty state
                if (window.templatesData.length === 0) {
                    return;
                }
                
                // Hide empty state if we have templates
                emptyState.style.display = 'none';
                
                // Render template cards
                window.templatesData.forEach(template => {
                    const card = createTemplateCard(template);
                    templatesContainer.appendChild(card);
                });
            }
            
            function createTemplateCard(template) {
                const div = document.createElement('div');
                div.className = 'template-card';
                
                // Determine repository name for display
                const repoNameMatch = template.repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
                const repoName = repoNameMatch ? \`\${repoNameMatch[1]}/\${repoNameMatch[2]}\` : 'Unknown';
                
                // Determine gauge class based on compliance percentage
                let gaugeClass = 'low';
                if (template.compliance.percentage >= 80) {
                    gaugeClass = 'high';
                } else if (template.compliance.percentage >= 50) {
                    gaugeClass = 'medium';
                }
                
                // Format date
                const date = new Date(template.timestamp);
                const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                
                div.innerHTML = \`
                    <div class="template-header">
                        <div class="template-name">\${repoName}</div>
                        <div class="template-url" title="\${template.repoUrl}">\${template.repoUrl}</div>
                    </div>
                    
                    <div>
                        <div style="display: flex; justify-content: space-between;">
                            <div>Compliance:</div>
                            <div><strong>\${template.compliance.percentage}%</strong></div>
                        </div>
                        <div class="gauge">
                            <div class="gauge-fill \${gaugeClass}" style="width: \${template.compliance.percentage}%"></div>
                        </div>
                    </div>
                    
                    <div class="template-stats">
                        <div class="stat-item">
                            <div class="stat-value">\${template.compliance.issues}</div>
                            <div class="stat-label">Issues</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">\${template.compliance.passed}</div>
                            <div class="stat-label">Passed</div>
                        </div>
                    </div>
                    
                    <a href="\${template.relativePath}" class="btn">
                        <i class="fas fa-chart-bar"></i> View Report
                    </a>
                    
                    <div class="template-timestamp">
                        <i class="far fa-clock"></i> \${formattedDate}
                    </div>
                \`;
                
                return div;
            }
            
            initIndex();
        });
    </script>
    
    <footer class="site-footer">
        <div class="container footer-content">
            <div class="copyright">©2025 - DevDiv Microsoft</div>
        </div>
    </footer>
</body>
</html>`;
}
