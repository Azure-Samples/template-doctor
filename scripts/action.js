const fs = require('fs');
const path = require('path');
const core = require('@actions/core');

async function run() {
  try {
    // Inputs
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
      core.setFailed(`Invalid JSON in analysis-data input.`);
      return;
    }

    // Repo folder name
    const repoUrlParts = repoUrl.split('/');
    const repoName = repoUrlParts.length >= 2
      ? `${repoUrlParts[repoUrlParts.length - 2]}-${repoUrlParts[repoUrlParts.length - 1]}`
      : repoUrl.split('/').pop();

    // Compliance summary
    const complianceSummary = analysisData.compliance?.compliant?.find(c => c.id === 'compliance-summary');
    const percentageCompliant = complianceSummary?.details?.percentageCompliant || 0;
    const issuesCount = analysisData.compliance?.issues?.length || 0;
    const passedCount = analysisData.compliance?.compliant?.length || 0;

    // Timestamp for file names
    const fileTimestamp = Date.now();

    // Canonical upstream
    const canonicalOriginUpstream = (originUpstreamInput || upstreamInput || '').trim();
    if (!canonicalOriginUpstream) {
      core.setFailed('origin-upstream (or upstream) is required but missing. Provide owner/repo, e.g. Azure-Samples/openai-langchainjs');
      return;
    }

    // Template data
    const templateData = {
      timestamp,
      dashboardPath: `${fileTimestamp}-dashboard.html`,
      dataPath: `${fileTimestamp}-data.js`,
      repoUrl,
      ruleSet,
      compliance: {
        percentage: percentageCompliant,
        issues: issuesCount,
        passed: passedCount,
      },
      scannedBy: [username],
      relativePath: `${repoName}/${fileTimestamp}-dashboard.html`,
      originUpstream: canonicalOriginUpstream,
    };

    // Resolve root of repo (scripts/ is under root)
    const rootDir = path.resolve(__dirname, '..');

    // Index-data path under monorepo app/results
    const indexDataPath = path.join(rootDir, 'packages', 'app', 'results', 'index-data.js');
    core.info(`Index data path: ${indexDataPath}`);

    // Read or init index-data
    let indexDataText;
    try {
      indexDataText = fs.readFileSync(indexDataPath, 'utf8');
    } catch (readErr) {
      core.warning(`index-data.js not found, initializing new. Reason: ${readErr.message}`);
      indexDataText = 'window.templatesData = [];' ;
    }

    // Parse templatesData
    let templatesData = [];
    const match = indexDataText.match(/window\.templatesData\s*=\s*(\[[\s\S]*?\]);/);
    if (match && match[1]) {
      try {
        templatesData = JSON.parse(match[1]);
      } catch (e) {
        core.warning(`Failed to parse templatesData; reinitializing. ${e.message}`);
        templatesData = [];
      }
    }

    // Upsert entry
    const existingIndex = templatesData.findIndex(t => t.repoUrl === repoUrl);
    if (existingIndex >= 0) {
      const existing = templatesData[existingIndex];
      if (!Array.isArray(existing.scannedBy)) existing.scannedBy = [];
      if (!existing.scannedBy.includes(username)) existing.scannedBy.push(username);
      existing.timestamp = timestamp;
      existing.dashboardPath = templateData.dashboardPath;
      existing.dataPath = templateData.dataPath;
      existing.ruleSet = ruleSet;
      existing.compliance = templateData.compliance;
      existing.relativePath = templateData.relativePath;
      existing.originUpstream = canonicalOriginUpstream;
      templatesData[existingIndex] = existing;
    } else {
      templatesData.unshift(templateData);
    }

    // Ensure results dir exists (packages/app/results)
    const resultsRootDir = path.dirname(indexDataPath);
    if (!fs.existsSync(resultsRootDir)) {
      fs.mkdirSync(resultsRootDir, { recursive: true });
    }

    // Write index-data.js
    const newIndexDataText = `window.templatesData = ${JSON.stringify(templatesData, null, 2)};`;
    fs.writeFileSync(indexDataPath, newIndexDataText);

    // Repository-specific results dir inside packages/app/results
    const repoResultsDir = path.join(resultsRootDir, repoName);
    if (!fs.existsSync(repoResultsDir)) fs.mkdirSync(repoResultsDir, { recursive: true });

    // Data file (window.templateData)
    const dataFilePath = path.join(repoResultsDir, templateData.dataPath);
    fs.writeFileSync(dataFilePath, `window.templateData = ${JSON.stringify(analysisData, null, 2)};`);

    // Dashboard HTML referencing app assets under ../../ (relative to repoResultsDir)
    const dashboardHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Template Analysis: ${repoUrl}</title>
  <link rel="stylesheet" href="../../css/style.css" />
  <link rel="stylesheet" href="../../css/dashboard.css" />
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
        <p>Rule Set: ${ruleSet?.toUpperCase?.() || ruleSet}</p>
        <p>Scanned by: ${username}</p>
      </div>
    </header>
    <main id="results-container">
      <div class="loading">Loading analysis results...</div>
    </main>
  </div>
  <script>
    document.addEventListener('DOMContentLoaded', function () {
      if (window.DashboardRenderer && window.templateData) {
        const renderer = new DashboardRenderer();
        renderer.render(window.templateData, document.getElementById('results-container'));
      }
    });
  </script>
</body>
</html>`;

    const dashboardPath = path.join(repoResultsDir, templateData.dashboardPath);
    fs.writeFileSync(dashboardPath, dashboardHtml);

    core.setOutput('template-data', JSON.stringify(templateData));
    core.info(`Successfully updated template analysis for ${repoUrl}`);
  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
  }
}

run();
