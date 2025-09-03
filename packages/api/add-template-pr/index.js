// Azure Function: GitHub PR for Adding Template
// POST /api/add-template-pr
// Creates a PR to add a new template to the index-data.js file
// and creates the result files for the template

const fetch = require('node-fetch');
// Using dynamic import for @octokit/rest which is an ES Module
let Octokit;

module.exports = async function (context, req) {
    // Dynamically import the Octokit module
    const { Octokit: OctokitModule } = await import('@octokit/rest');
    Octokit = OctokitModule;
    context.log('Add Template PR function triggered');
    
    // Enable CORS
    context.res = {
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
    };
    
    // Handle OPTIONS requests for CORS preflight
    if (req.method === 'OPTIONS') {
        context.log('Handling CORS preflight request');
        context.res.status = 204;
        return;
    }
    
    // Check for required parameters
    const token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;
    const templateData = req.body;
    
    if (!token) {
        context.res = {
            status: 401,
            body: { error: 'Authorization token is required' }
        };
        return;
    }
    
    if (!templateData || !validateTemplateData(templateData)) {
        context.res = {
            status: 400,
            body: { error: 'Invalid or missing template data' }
        };
        return;
    }

    try {
        // Initialize GitHub client
        const octokit = new Octokit({
            auth: token
        });
        
        // Get authenticated user
        const { data: user } = await octokit.users.getAuthenticated();
        context.log(`Authenticated as GitHub user: ${user.login}`);

        // GitHub repository configuration
        const owner = process.env.GITHUB_REPO_OWNER || user.login;  // Use authenticated user as owner by default
        const repo = process.env.GITHUB_REPO_NAME || 'template-doctor';  // Set your default repository name
    const DEFAULT_BRANCH_NAME = 'main';  // Default branch name
    let baseBranch = DEFAULT_BRANCH_NAME;  // Default base branch
    // Track the actual source branch we branched from (may be default branch if 'main' doesn't exist)
    let sourceBranch = DEFAULT_BRANCH_NAME;
        
        // Check if repository exists and is accessible
        try {
            // First, check if the repo exists and is accessible
            await octokit.repos.get({
                owner,
                repo
            });
            context.log(`Repository ${owner}/${repo} is accessible`);
        } catch (repoError) {
            context.log.error(`Repository access error: ${repoError.message}`);
            context.res = {
                status: 400,
                body: {
                    error: 'Repository access error',
                    details: `Cannot access repository ${owner}/${repo}. Please check repository name and permissions.`,
                    originalError: repoError.message
                }
            };
            return;
        }
        
        // Generate a unique branch name based on timestamp and template
        const timestamp = new Date().getTime();
        const branchName = `add-template-${timestamp}`;
        const repoIdentifier = getRepoIdentifier(templateData.repoUrl);
        
        // Get the latest commit on the base branch to branch from
        let baseCommitSha;
        try {
            const { data: refData } = await octokit.git.getRef({
                owner,
                repo,
                ref: `heads/${baseBranch}`
            });
            baseCommitSha = refData.object.sha;
            context.log(`Found base branch: ${baseBranch}, SHA: ${baseCommitSha}`);
    } catch (branchError) {
            // Try default branch if specified branch doesn't exist
            context.log.error(`Branch ${baseBranch} not found: ${branchError.message}`);
            
            // Get default branch
            const { data: repoData } = await octokit.repos.get({
                owner,
                repo
            });
            
            const defaultBranch = repoData.default_branch;
            context.log(`Trying default branch: ${defaultBranch}`);
            
            const { data: defaultRefData } = await octokit.git.getRef({
                owner,
                repo,
                ref: `heads/${defaultBranch}`
            });
            baseCommitSha = defaultRefData.object.sha;
            sourceBranch = defaultBranch;
            baseBranch = defaultBranch;
            context.log(`Using default branch: ${defaultBranch}, SHA: ${baseCommitSha}`);
        }
        
        // Create a new branch
        await octokit.git.createRef({
            owner,
            repo,
            ref: `refs/heads/${branchName}`,
            sha: baseCommitSha
        });
        context.log(`Created branch: ${branchName}`);
        
        // Create folder for the template results if it doesn't exist
    const folderName = getTemplateFolderName(templateData.repoUrl);
    const folderPath = `packages/app/results/${folderName}`;
        
        try {
            // Check if folder exists
            await octokit.repos.getContent({
                owner,
                repo,
                path: folderPath,
                ref: branchName
            });
            context.log(`Folder ${folderPath} already exists`);
        } catch (folderError) {
            // Folder doesn't exist, create it by adding a .gitkeep file
            // (GitHub API doesn't allow creating empty folders)
            context.log(`Creating folder ${folderPath}`);
            await octokit.repos.createOrUpdateFileContents({
                owner,
                repo,
                path: `${folderPath}/.gitkeep`,
                message: `Create folder for template: ${repoIdentifier}`,
                content: Buffer.from('').toString('base64'),
                branch: branchName
            });
        }
        
        // Generate timestamp-based filenames
        const timestampStr = timestamp.toString();
        const dashboardFileName = `${timestampStr}-dashboard.html`;
        const dataFileName = `${timestampStr}-data.js`;
        
        // Create the data.js file
        const resultData = createResultData(templateData);
        await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: `${folderPath}/${dataFileName}`,
            message: `Add data file for template: ${repoIdentifier}`,
            content: Buffer.from(resultData).toString('base64'),
            branch: branchName
        });
        context.log(`Created data file: ${folderPath}/${dataFileName}`);
        
        // Create the dashboard.html file
        const dashboardHtml = createDashboardHtml(templateData, dataFileName);
        await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: `${folderPath}/${dashboardFileName}`,
            message: `Add dashboard file for template: ${repoIdentifier}`,
            content: Buffer.from(dashboardHtml).toString('base64'),
            branch: branchName
        });
        context.log(`Created dashboard file: ${folderPath}/${dashboardFileName}`);

        // Create or update latest.json (used by frontend to find current data file)
        let latestSha = undefined;
        try {
            const { data: latestFile } = await octokit.repos.getContent({
                owner,
                repo,
                path: `${folderPath}/latest.json`,
                ref: sourceBranch
            });
            latestSha = latestFile && latestFile.sha ? latestFile.sha : undefined;
        } catch (e) {
            context.log(`latest.json not found for ${folderPath}, will create new one.`);
        }
        const latestJsonObj = createLatestJson(templateData, dataFileName, dashboardFileName);
        const latestJsonContent = JSON.stringify(latestJsonObj, null, 2);
        await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: `${folderPath}/latest.json`,
            message: `Update latest.json for template: ${repoIdentifier}`,
            content: Buffer.from(latestJsonContent).toString('base64'),
            branch: branchName,
            sha: latestSha
        });
        context.log(`Created/Updated latest.json: ${folderPath}/latest.json`);

        // Create or update history.json (append this run)
        let historyArray = [];
        let historySha = undefined;
        try {
            const { data: historyFile } = await octokit.repos.getContent({
                owner,
                repo,
                path: `${folderPath}/history.json`,
                // Read from the source branch (the branch we branched from), not the new branch
                ref: sourceBranch
            });
            const decoded = Buffer.from(historyFile.content, 'base64').toString();
            const parsed = JSON.parse(decoded);
            historySha = historyFile?.sha;
            if (Array.isArray(parsed)) historyArray = parsed;
        } catch (e) {
            context.log(`history.json not found for ${folderPath}, will create new one.`);
        }
        historyArray.push(createHistoryEntry(templateData, dataFileName, dashboardFileName));
        const historyJsonContent = JSON.stringify(historyArray, null, 2);
        await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: `${folderPath}/history.json`,
            message: `Update history.json for template: ${repoIdentifier}`,
            content: Buffer.from(historyJsonContent).toString('base64'),
            branch: branchName,
            sha: historySha
        });
        context.log(`Created/Updated history.json: ${folderPath}/history.json`);
        
        // Get the current index-data.js file
        const { data: fileData } = await octokit.repos.getContent({
            owner,
            repo,
            path: 'packages/app/results/index-data.js',
            ref: branchName
        });
        
        // Decode the file content
        const content = Buffer.from(fileData.content, 'base64').toString();
        
        // Update template data with the newly created files
        templateData.dashboardPath = dashboardFileName;
        templateData.dataPath = dataFileName;
        templateData.relativePath = `${folderName}/${dashboardFileName}`;
        // If caller provided originUpstream (canonical upstream owner/repo), persist it
        if (templateData.originUpstream && typeof templateData.originUpstream === 'string') {
            templateData.originUpstream = templateData.originUpstream.trim();
        }
        
        // Update the content by adding the new template
        const updatedContent = addTemplateToIndexData(content, templateData);
        
        // Commit the updated file
        await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: 'packages/app/results/index-data.js',
            message: `Add template: ${repoIdentifier} to index`,
            content: Buffer.from(updatedContent).toString('base64'),
            branch: branchName,
            sha: fileData.sha
        });
        context.log(`Updated index-data.js file`);
        
        // Create a pull request
        const { data: prData } = await octokit.pulls.create({
            owner,
            repo,
            title: `Add template: ${repoIdentifier}`,
            head: branchName,
            base: baseBranch,
            body: `This PR adds a new template scan for ${templateData.repoUrl} to the template doctor.
            
### Template Details
- Repository: ${templateData.repoUrl}
- Rule Set: ${templateData.ruleSet || 'default'}
- Compliance: ${templateData.compliance.percentage}%
- Issues: ${templateData.compliance.issues}
- Passed: ${templateData.compliance.passed}
- Scanned By: ${templateData.scannedBy ? templateData.scannedBy.join(', ') : 'Template Doctor'}

### Files Created/Updated
- Added template to index-data.js
- Created folder: ${folderPath}
- Created dashboard file: ${folderPath}/${dashboardFileName}
- Created data file: ${folderPath}/${dataFileName}
- Created/Updated latest.json: ${folderPath}/latest.json
- Created/Updated history.json: ${folderPath}/history.json
            `
        });
        context.log(`Created PR: ${prData.html_url}`);
        
        // Return success
        context.res = {
            status: 200,
            body: {
                success: true,
                message: 'Pull request created successfully',
                prUrl: prData.html_url
            }
        };
    } catch (error) {
        context.log.error(`Error creating PR: ${error.message}`, error);
        context.res = {
            status: 500,
            body: {
                error: 'Failed to create pull request',
                details: error.message
            }
        };
    }
};

/**
 * Validate that all required template data is present
 * @param {Object} data - Template data object
 * @returns {boolean} - True if valid
 */
function validateTemplateData(data) {
    return data &&
        data.timestamp &&
        data.repoUrl &&
        data.compliance &&
        typeof data.compliance.percentage === 'number' &&
        typeof data.compliance.issues === 'number' &&
        typeof data.compliance.passed === 'number';
}

/**
 * Add the new template data to the index-data.js content
 * @param {string} content - Current file content
 * @param {Object} templateData - New template data to add
 * @returns {string} - Updated file content
 */
function addTemplateToIndexData(content, templateData) {
    // Find the opening bracket of the array
    const arrayStart = content.indexOf('[');
    if (arrayStart === -1) {
        throw new Error('Could not find array start in index-data.js');
    }
    
    // Format the new template data as JSON with proper indentation
    const templateJson = JSON.stringify(templateData, null, 2)
        .replace(/^{/gm, '  {')
        .replace(/^}/gm, '  }')
        .replace(/^  "(.+)":/gm, '    "$1":');
    
    // Insert the new template at the beginning of the array
    return content.slice(0, arrayStart + 1) + 
        '\n' + templateJson + ',' + 
        content.slice(arrayStart + 1);
}

/**
 * Extract a friendly identifier from the repository URL
 * @param {string} url - Repository URL
 * @returns {string} - Repository identifier
 */
function getRepoIdentifier(url) {
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        if (pathParts.length >= 3) {
            // For GitHub URLs, return owner/repo format
            return `${pathParts[1]}/${pathParts[2]}`;
        }
        return url.replace(/https?:\/\//, '');
    } catch (error) {
        return url;
    }
}

/**
 * Create a folder name for the template based on the repository URL
 * @param {string} url - Repository URL
 * @returns {string} - Folder name
 */
function getTemplateFolderName(url) {
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        if (pathParts.length >= 3) {
            // For GitHub URLs, use owner-repo format
            return `${pathParts[1]}-${pathParts[2]}`;
        }
        return url.replace(/https?:\/\/|[^a-zA-Z0-9-]/g, '-').replace(/--+/g, '-').replace(/^-|-$/g, '');
    } catch (error) {
        return url.replace(/https?:\/\/|[^a-zA-Z0-9-]/g, '-').replace(/--+/g, '-').replace(/^-|-$/g, '');
    }
}

/**
 * Create the result data file content
 * @param {Object} templateData - Template data object
 * @returns {string} - Result data file content
 */
function createResultData(templateData) {
    // Create a basic compliance report if detailed data is not available
    const issues = templateData.compliance.issues ? 
        Array.isArray(templateData.compliance.issues) ? 
            templateData.compliance.issues : 
            Array(templateData.compliance.issues).fill().map((_, i) => ({
                id: `issue-${i+1}`,
                severity: "info",
                message: `Placeholder issue ${i+1}`
            })) : [];
            
    const compliant = templateData.compliance.passed ? 
        Array(templateData.compliance.passed).fill().map((_, i) => ({
            id: `passed-${i+1}`,
            category: "placeholder",
            message: `Placeholder passed check ${i+1}`
        })) : [];
    
    const reportData = {
        repoUrl: templateData.repoUrl,
        ruleSet: templateData.ruleSet || 'default',
        timestamp: templateData.timestamp,
        compliance: {
            issues: issues,
            compliant: compliant,
            summary: `Issues found - Compliance: ${templateData.compliance.percentage}%`
        },
        // Propagate canonical upstream template name if provided (used by frontend to run azd init)
        upstreamTemplate: (typeof templateData.originUpstream === 'string' && templateData.originUpstream.includes('/'))
            ? templateData.originUpstream.trim()
            : undefined,
        history: [
            {
                timestamp: templateData.timestamp,
                ruleSet: templateData.ruleSet || 'default',
                percentage: templateData.compliance.percentage,
                issues: templateData.compliance.issues,
                passed: templateData.compliance.passed,
                dashboardPath: templateData.dashboardPath || ''
            }
        ]
    };
    
    return `window.reportData = ${JSON.stringify(reportData, null, 2)};`;
}

/**
 * Create the dashboard HTML file content
 * @param {Object} templateData - Template data object
 * @param {string} dataFileName - Name of the data file
 * @returns {string} - Dashboard HTML content
 */
function createDashboardHtml(templateData, dataFileName) {
    const fs = require('fs');
    const path = require('path');
    
    try {
        // Get template from file if it exists
        const templatePath = path.join(__dirname, 'dashboard-template.html');
        let htmlTemplate = '';
        
        if (fs.existsSync(templatePath)) {
            // Read template file
            htmlTemplate = fs.readFileSync(templatePath, 'utf8');
            
            // Get basic template values
            const repoName = getRepoIdentifier(templateData.repoUrl);
            const timestamp = new Date(templateData.timestamp).toLocaleString();
            const compliancePercent = templateData.compliance.percentage;
            const gaugeClass = compliancePercent >= 80 ? 'high' : 
                             compliancePercent >= 50 ? 'medium' : 'low';
            const badgeClass = compliancePercent >= 80 ? 'badge-high' : 
                             compliancePercent >= 50 ? 'badge-medium' : 'badge-low';
            
            // Replace template placeholders with actual values
            htmlTemplate = htmlTemplate
                .replace(/\{\{REPO_NAME\}\}/g, repoName)
                .replace(/\{\{REPO_URL\}\}/g, templateData.repoUrl)
                .replace(/\{\{RULE_SET\}\}/g, templateData.ruleSet || 'Default')
                .replace(/\{\{TIMESTAMP\}\}/g, timestamp)
                .replace(/\{\{COMPLIANCE_PERCENTAGE\}\}/g, compliancePercent)
                .replace(/\{\{GAUGE_CLASS\}\}/g, gaugeClass)
                .replace(/\{\{BADGE_CLASS\}\}/g, badgeClass)
                .replace(/\{\{ISSUES_COUNT\}\}/g, templateData.compliance.issues)
                .replace(/\{\{PASSED_COUNT\}\}/g, templateData.compliance.passed)
                .replace(/\{\{TOTAL_CHECKS\}\}/g, templateData.compliance.issues + templateData.compliance.passed)
                .replace(/\{\{DATA_FILE_NAME\}\}/g, dataFileName);
            
            return htmlTemplate;
        }
    } catch (error) {
        console.error('Error creating dashboard HTML from template:', error);
    }
    
    // Fallback to direct string creation if template file doesn't exist or fails
    const repoName = getRepoIdentifier(templateData.repoUrl);
    const timestamp = new Date(templateData.timestamp).toLocaleString();
    const compliancePercent = templateData.compliance.percentage;
    const gaugeClass = compliancePercent >= 80 ? 'high' : 
                     compliancePercent >= 50 ? 'medium' : 'low';
    const badgeClass = compliancePercent >= 80 ? 'badge-high' : 
                     compliancePercent >= 50 ? 'badge-medium' : 'badge-low';
    
    // Create basic HTML
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Template Doctor - ${repoName} Analysis</title>
    <style>
        body { 
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            line-height: 1.6;
        }
        .container {
            max-width: 1000px;
            margin: 0 auto;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        .gauge {
            height: 20px;
            background-color: #eee;
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
        }
        .gauge-fill {
            height: 100%;
            border-radius: 10px;
        }
        .high { background-color: #107c10; }
        .medium { background-color: #f0ad4e; }
        .low { background-color: #d83b01; }
        .stats {
            display: flex;
            gap: 20px;
            margin: 20px 0;
        }
        .stat-card {
            flex: 1;
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 5px;
            text-align: center;
        }
        .back-link {
            display: inline-block;
            margin-top: 20px;
            color: #0078d4;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Template Doctor Analysis</h1>
            <a href="../template-index.html" class="back-link">Back to Templates</a>
        </div>
        
        <div>
            <h2>Repository: <a href="${templateData.repoUrl}" target="_blank">${templateData.repoUrl}</a></h2>
            <p>Rule Set: ${templateData.ruleSet || 'Default'}</p>
            <p>Analyzed on: ${timestamp}</p>
            
            <h3>Compliance Score: ${compliancePercent}%</h3>
            <div class="gauge">
                <div class="gauge-fill ${gaugeClass}" style="width: ${compliancePercent}%;"></div>
            </div>
            
            <div class="stats">
                <div class="stat-card">
                    <h3>${templateData.compliance.issues}</h3>
                    <p>Issues Found</p>
                </div>
                <div class="stat-card">
                    <h3>${templateData.compliance.passed}</h3>
                    <p>Checks Passed</p>
                </div>
                <div class="stat-card">
                    <h3>${templateData.compliance.issues + templateData.compliance.passed}</h3>
                    <p>Total Checks</p>
                </div>
            </div>
            
            <p>See detailed report data for more information.</p>
        </div>
    </div>
    <script src="${dataFileName}"></script>
</body>
</html>`;
}

/**
 * Create latest.json payload for a template folder
 * @param {Object} templateData
 * @param {string} dataFileName
 * @param {string} dashboardFileName
 */
function createLatestJson(templateData, dataFileName, dashboardFileName) {
    return {
        repoUrl: templateData.repoUrl,
        ruleSet: templateData.ruleSet || 'default',
        timestamp: templateData.timestamp,
        // Frontend expects dataPath relative to the folder
        dataPath: dataFileName,
        dashboardPath: dashboardFileName,
        compliance: {
            percentage: templateData.compliance.percentage,
            issues: templateData.compliance.issues,
            passed: templateData.compliance.passed
        }
    };
}

/**
 * Create a single history entry object
 * @param {Object} templateData
 * @param {string} dataFileName
 * @param {string} dashboardFileName
 */
function createHistoryEntry(templateData, dataFileName, dashboardFileName) {
    return {
        timestamp: templateData.timestamp,
        ruleSet: templateData.ruleSet || 'default',
        percentage: templateData.compliance.percentage,
        issues: templateData.compliance.issues,
        passed: templateData.compliance.passed,
        dataPath: dataFileName,
        dashboardPath: dashboardFileName
    };
}
