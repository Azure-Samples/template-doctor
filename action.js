const fs = require('fs');
const path = require('path');
const core = require('@actions/core');
const github = require('@actions/github');

async function run() {
  try {
    // Get inputs from the workflow
    const repoUrl = core.getInput('repo-url');
    const ruleSet = core.getInput('rule-set');
    const username = core.getInput('username');
    const timestamp = core.getInput('timestamp');
    const analysisDataRaw = core.getInput('analysis-data');
  const upstreamInput = core.getInput('upstream');
  const originUpstreamInput = core.getInput('origin-upstream');
    
  core.info(`Processing analysis for repo: ${repoUrl}`);
    core.info(`Rule Set: ${ruleSet}, Username: ${username}`);
  if (upstreamInput) core.info(`Upstream (from input): ${upstreamInput}`);
  if (originUpstreamInput) core.info(`Origin Upstream (from input): ${originUpstreamInput}`);
    
    // Parse analysis data
    let analysisData;
    try {
      analysisData = JSON.parse(analysisDataRaw);
      core.info('Analysis data parsed successfully');
    } catch (parseError) {
      core.warning(`Failed to parse analysis data: ${parseError.message}`);
      core.warning('Attempting to use fallback parsing...');
      
      // Try to fix common issues with the JSON
      const fixedJson = analysisDataRaw.replace(/\n/g, ' ')
        .replace(/"/g, '\\"')
        .replace(/\\/g, '\\\\');
      
      try {
        analysisData = JSON.parse(fixedJson);
        core.info('Analysis data parsed with fallback method');
      } catch (fallbackError) {
        core.setFailed(`Failed to parse analysis data after attempted fixes: ${fallbackError.message}`);
        return;
      }
    }

    // Extract repository name from URL for folder path
    const repoUrlParts = repoUrl.split('/');
    const repoName = repoUrlParts.length >= 2 ? 
      `${repoUrlParts[repoUrlParts.length - 2]}-${repoUrlParts[repoUrlParts.length - 1]}` : 
      repoUrl.split('/').pop();
    
    core.info(`Using repository folder name: ${repoName}`);
    
    // Find compliance summary data
    let complianceSummary = analysisData.compliance?.compliant?.find(c => c.id === 'compliance-summary');
    let percentageCompliant = complianceSummary?.details?.percentageCompliant || 0;
    let issuesCount = analysisData.compliance?.issues?.length || 0;
    let passedCount = analysisData.compliance?.compliant?.length || 0;
    
    core.info(`Compliance: ${percentageCompliant}% (${passedCount} passed, ${issuesCount} issues)`);
    
    // Create timestamp for file names
    const fileTimestamp = Date.now();
    
    // Determine canonical upstream (prefer origin-upstream, then upstream)
    const canonicalOriginUpstream = (originUpstreamInput || upstreamInput || '').trim();
    if (!canonicalOriginUpstream) {
      core.setFailed('origin-upstream (or upstream) is required but was not provided. Please supply the canonical azd template as owner/repo, e.g., Azure-Samples/openai-langchainjs.');
      return;
    }

    // Create the base template data object
    const templateData = {
      timestamp,
      dashboardPath: `${fileTimestamp}-dashboard.html`,
      dataPath: `${fileTimestamp}-data.js`,
      repoUrl,
      ruleSet,
      compliance: {
        percentage: percentageCompliant,
        issues: issuesCount,
        passed: passedCount
      },
      scannedBy: [username],
      relativePath: `${repoName}/${fileTimestamp}-dashboard.html`,
      ...(canonicalOriginUpstream ? { originUpstream: canonicalOriginUpstream } : {})
    };

  // Read the current index-data.js file (monorepo path)
  const indexDataPath = path.join(__dirname, 'packages', 'app', 'results', 'index-data.js');
    core.info(`Reading index data from: ${indexDataPath}`);
    
    let indexData;
    try {
      indexData = fs.readFileSync(indexDataPath, 'utf8');
      core.info('Index data file read successfully');
    } catch (readError) {
      core.warning(`Failed to read index-data.js: ${readError.message}`);
      core.warning('Creating a new index-data.js file');
      indexData = 'window.templatesData = [];';
    }
    
    // Convert the data to a JavaScript object
    let templatesData = [];
    const match = indexData.match(/window\.templatesData\s*=\s*(\[[\s\S]*?\]);/);
    
    if (match && match[1]) {
      try {
        templatesData = JSON.parse(match[1]);
        core.info(`Successfully parsed templates data (${templatesData.length} templates found)`);
      } catch (parseError) {
        core.warning(`Failed to parse existing templates data: ${parseError.message}`);
        core.warning('Starting with empty templates data');
      }
    } else {
      core.warning('No templatesData array found in index-data.js, creating a new one');
    }

    // Check if the repository already exists in the data
  const existingIndex = templatesData.findIndex(t => t.repoUrl === repoUrl);
    
    if (existingIndex >= 0) {
      // Repository exists, update it
      const existing = templatesData[existingIndex];
      core.info(`Found existing template data for ${repoUrl} at index ${existingIndex}`);
      
      // Make sure scannedBy is an array
      if (!Array.isArray(existing.scannedBy)) {
        core.warning(`scannedBy property is not an array, resetting it`);
        existing.scannedBy = [];
      }
      
      // Update the scannedBy array if username is not already included
      if (!existing.scannedBy.includes(username)) {
        existing.scannedBy.push(username);
        core.info(`Added ${username} to scannedBy array`);
      } else {
        core.info(`${username} already exists in scannedBy array`);
      }
      
      // Update timestamp and other data
      existing.timestamp = timestamp;
      existing.dashboardPath = templateData.dashboardPath;
      existing.dataPath = templateData.dataPath;
      existing.ruleSet = ruleSet;
      existing.compliance = templateData.compliance;
      existing.relativePath = templateData.relativePath;
      if (canonicalOriginUpstream) {
        existing.originUpstream = canonicalOriginUpstream;
        core.info(`Set originUpstream on existing entry: ${canonicalOriginUpstream}`);
      }
      
      // Replace in array
      templatesData[existingIndex] = existing;
      core.info('Updated existing template data');
    } else {
      // Add new repository
  core.info(`Adding new template data for ${repoUrl}`);
      templatesData.unshift(templateData);
      core.info('Template data added to beginning of array');
    }

    // Ensure the frontend/results directory exists
    const indexResultsDir = path.dirname(indexDataPath);
    if (!fs.existsSync(indexResultsDir)) {
      fs.mkdirSync(indexResultsDir, { recursive: true });
      core.info(`Created directory: ${indexResultsDir}`);
    }

    // Write updated data back to index-data.js
    const newIndexData = `window.templatesData = ${JSON.stringify(templatesData, null, 2)};`;
    fs.writeFileSync(indexDataPath, newIndexData);

    // Create results directory for the repository if it doesn't exist
    const resultsDir = path.join(__dirname, 'frontend', 'results', repoName);
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

  // Write the analysis data
    const dataFilePath = path.join(resultsDir, templateData.dataPath);
  fs.writeFileSync(dataFilePath, `window.templateData = ${JSON.stringify(analysisData, null, 2)};`);

    // Create a simple dashboard HTML file
    const dashboardHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Template Analysis: ${repoUrl}</title>
  <link rel="stylesheet" href="../../css/style.css">
  <link rel="stylesheet" href="../../css/dashboard.css">
  <script src="${templateData.dataPath}" defer></script>
  <script src="../../js/dashboard-renderer.js" defer></script>
</head>
<body>
  <div class="container">
    <header>
      <h1>Template Analysis: ${repoName}</h1>
      <div class="meta">
        <p>Repository: <a href="${repoUrl}" target="_blank">${repoUrl}</a></p>
        <p>Analyzed: ${new Date(timestamp).toLocaleString()}</p>
        <p>Rule Set: ${ruleSet.toUpperCase()}</p>
        <p>Scanned by: ${username}</p>
      </div>
    </header>
    <main id="results-container">
      <div class="loading">Loading analysis results...</div>
    </main>
  </div>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      if (window.DashboardRenderer && window.templateData) {
        const renderer = new DashboardRenderer();
        renderer.render(window.templateData, document.getElementById('results-container'));
      }
    });
  </script>
</body>
</html>`;

    const dashboardPath = path.join(resultsDir, templateData.dashboardPath);
    fs.writeFileSync(dashboardPath, dashboardHtml);

    core.setOutput('template-data', JSON.stringify(templateData));
    core.info(`Successfully updated template analysis for ${repoUrl}`);

  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
  }
}

run();
