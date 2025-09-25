
// analyzer-node.js - Node.js-compatible CLI for Template Doctor analysis (calls real analyzer logic)
// Usage: node scripts/analyzer-node.js <repo_url> [--security-scan] [--skip-resources] [...other options]

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Octokit } = require('@octokit/rest');

// Polyfill fetch for Node.js and add support for local file paths used by the web app
const realNodeFetch = (typeof fetch !== 'undefined')
  ? fetch
  : (...args) => import('node-fetch').then(({ default: fetchImpl }) => fetchImpl(...args));

global.fetch = async function(nodeUrl, options = {}) {
  try {
    const url = String(nodeUrl);
    const isHttp = /^https?:\/\//i.test(url);
    if (isHttp) {
      return await realNodeFetch(url, options);
    }
    // Handle relative paths like './configs/*.json' from packages/app
    let filePath;
    if (url.startsWith('./')) {
      const sub = url.slice(2); // remove './'
      filePath = path.resolve(__dirname, '../packages/app', sub);
    } else if (path.isAbsolute(url)) {
      filePath = url;
    } else {
      // Treat as relative to packages/app
      filePath = path.resolve(__dirname, '../packages/app', url);
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => JSON.parse(content),
      text: async () => content,
    };
  } catch (err) {
    return {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => { throw err; },
      text: async () => { throw err; },
    };
  }
};

// Minimal Node-compatible GitHubClient for analyzer.js
class NodeGitHubClient {
  constructor(token) {
    this.octokit = new Octokit({ auth: token });
    this.token = token;
    this.currentUsername = null;
  }
  getCurrentUsername() {
    return this.currentUsername;
  }
  async init() {
    const user = await this.octokit.users.getAuthenticated();
    this.currentUsername = user.data.login;
    return this.currentUsername;
  }
  async ensureAccessibleRepo(owner, repo, { forceFork = false } = {}) {
    // Always fork if forceFork or owner mismatch
    const userLogin = this.getCurrentUsername();
    let forked = false;
    let repoMeta;
    if (forceFork || (userLogin && owner.toLowerCase() !== userLogin.toLowerCase())) {
      // Check if fork exists
      try {
        repoMeta = await this.octokit.repos.get({ owner: userLogin, repo });
        forked = true;
      } catch (e) {
        if (e.status === 404) {
          // Create fork (SAML/SSO does not block forking). Retry briefly if needed.
          try {
            await this.octokit.repos.createFork({ owner, repo });
          } catch (forkErr) {
            // Do not attribute to SAML; surface neutral guidance and continue
            console.error(`Fork request failed for ${owner}/${repo}:`, forkErr);
            throw new Error(`Fork request failed for ${owner}/${repo}. Please verify repository visibility and retry, or create a fork via the GitHub UI and re-run the scan.`);
          }
          // Wait for fork to be ready
          let retries = 0;
          while (retries < 12) { // up to ~36s
            try {
              repoMeta = await this.octokit.repos.get({ owner: userLogin, repo });
              break;
            } catch (err) {
              await new Promise(res => setTimeout(res, 3000));
              retries++;
            }
          }
          if (!repoMeta) {
            throw new Error(`Fork ${userLogin}/${repo} not visible yet after waiting. Please check your GitHub account forks and re-run.`);
          }
          forked = true;
        } else {
          throw e;
        }
      }
    } else {
      repoMeta = await this.octokit.repos.get({ owner, repo });
    }
    return { repo: repoMeta.data, forked };
  }
  async listAllFiles(owner, repo, ref = 'main') {
    // Use the GitHub API to get the tree recursively
    const { data } = await this.octokit.git.getTree({ owner, repo, tree_sha: ref, recursive: 'true' });
    return data.tree.filter((item) => item.type === 'blob').map((item) => item.path);
  }
  getDefaultBranchFromMeta(meta) {
    return meta.default_branch || 'main';
  }
  async getFileContent(owner, repo, filePath) {
    const { data } = await this.octokit.repos.getContent({ owner, repo, path: filePath });
    if (Array.isArray(data)) {
      throw new Error('Path is a directory, expected file');
    }
    if (data.encoding === 'base64') {
      return Buffer.from(data.content, 'base64').toString('utf8');
    }
    // Fallback: if content is present as plain text
    if (data.content) return data.content;
    throw new Error('Unsupported encoding');
  }
}

// Patch: Node.js doesn't have window/global, so fake minimal window for analyzer.js
global.window = {};
// Patch: Provide a minimal config loader for analyzer.js
window.TemplateDoctorConfig = {};
// Patch: Provide a minimal fetch polyfill (see above)
// Patch: Provide a minimal localStorage for custom config (noop)
window.localStorage = { getItem: () => null };

// Polyfill CustomEvent
global.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
window.CustomEvent = global.CustomEvent;

// Minimal document polyfill
global.document = { dispatchEvent: () => {}, addEventListener: () => {} };

// Load the real Docs ruleset analyzer so TemplateAnalyzerDocs is defined
const docsAnalyzerPath = path.resolve(__dirname, '../packages/app/js/ruleset-docs/analyzer.js');
const { Script } = require('vm');
const docsAnalyzerCode = fs.readFileSync(docsAnalyzerPath, 'utf8');
new Script(docsAnalyzerCode).runInThisContext();

// Patch: Provide a minimal NotificationSystem (noop)
window.NotificationSystem = { showWarning: () => {} };

// Patch: Provide a minimal GitHubClient for analyzer.js
const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error('GITHUB_TOKEN environment variable is required.');
  process.exit(1);
}
window.GitHubClient = new NodeGitHubClient(token);

// Import analyzer logic (as a module)
const analyzerPath = path.resolve(__dirname, '../packages/app/js/analyzer.js');
const analyzerCode = fs.readFileSync(analyzerPath, 'utf8');
// Evaluate analyzer.js in the current context (populates window.TemplateAnalyzer)
new Script(analyzerCode).runInThisContext();

async function main() {
  const args = process.argv.slice(2);
  if (!args[0] || args[0].startsWith('-')) {
    console.error('Usage: node scripts/analyzer-node.js <repo_url> [--security-scan] [--skip-resources]');
    process.exit(1);
  }
  const repoUrl = args[0];
  const options = args.slice(1);

  // Ensure GitHub client is initialized with current username (sync access)
  await window.GitHubClient.init();

  // Run the real analyzer logic
  const analyzer = window.TemplateAnalyzer;
  if (!analyzer || typeof analyzer.analyzeTemplate !== 'function') {
    console.error('Analyzer logic not loaded or missing analyzeTemplate method.');
    process.exit(1);
  }

  // Run analysis (default to DoD ruleset)
  const result = await analyzer.analyzeTemplate(repoUrl, 'dod');

  // Write result file in web app JS format and directory structure
  const match = repoUrl.match(/github.com[/:]([^/]+)\/([^/]+)(.git)?$/);
  const owner = match[1];
  const repo = match[2].replace(/.git$/, '');
  const userLogin = window.GitHubClient.getCurrentUsername();
  const targetOwner = userLogin;
  const targetRepo = repo;
  const timestamp = Date.now();
  const resultDir = path.resolve(__dirname, `../packages/app/results/${targetOwner}-${targetRepo}`);
  if (!fs.existsSync(resultDir)) {
    fs.mkdirSync(resultDir, { recursive: true });
  }
  // Output as window.reportData for dashboard compatibility
  const resultFile = path.join(resultDir, `${timestamp}-data.js`);
  const jsContent = `window.reportData = ${JSON.stringify(result, null, 2)};\n`;
  fs.writeFileSync(resultFile, jsContent);
  console.log('Result written to', resultFile);

  // Also write latest.json and history.json to support index backfill and PROD parity
  try {
    const issuesCount = Array.isArray(result?.compliance?.issues) ? result.compliance.issues.length : (Number(result?.compliance?.issues) || 0);
    const passedCount = Array.isArray(result?.compliance?.compliant) ? result.compliance.compliant.length : (Number(result?.compliance?.passed) || 0);
    const percentage = Number(result?.compliance?.percentage) || 0;
    const repoUrlOut = result?.repoUrl || repoUrl;
    const ruleSetOut = result?.ruleSet || 'dod';
    const dashboardFile = `${timestamp}-dashboard.html`;
    const latest = {
      timestamp: new Date(timestamp).toISOString(),
      repoUrl: repoUrlOut,
      ruleSet: ruleSetOut,
      dataPath: path.basename(resultFile),
      dashboardPath: dashboardFile,
      compliance: { percentage, issues: issuesCount, passed: passedCount }
    };
    fs.writeFileSync(path.join(resultDir, 'latest.json'), JSON.stringify(latest, null, 2));
    // Append to history.json
    const historyPath = path.join(resultDir, 'history.json');
    let history = [];
    if (fs.existsSync(historyPath)) {
      try { history = JSON.parse(fs.readFileSync(historyPath, 'utf8')); } catch (_) { history = []; }
    }
    history.push(latest);
    // Keep most recent first
    history.sort((a,b)=> new Date(b.timestamp) - new Date(a.timestamp));
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));

    // Additionally write a per-scan meta file that the index can consume directly
    const slug = `${targetOwner}-${targetRepo}`;
    const metaEntry = {
      timestamp: latest.timestamp,
      repoUrl: repoUrlOut,
      ruleSet: ruleSetOut,
      dashboardPath: dashboardFile,
      dataPath: path.basename(resultFile),
      compliance: { percentage, issues: issuesCount, passed: passedCount },
      relativePath: `${slug}/${dashboardFile}`
    };
    const scanMetaFile = path.join(resultDir, `scan-meta-${timestamp}.js`);
    const scanMetaJs = `window.__TD_DYNAMIC_RESULTS = window.__TD_DYNAMIC_RESULTS || [];\nwindow.__TD_DYNAMIC_RESULTS.push(${JSON.stringify(metaEntry)});\n`;
    fs.writeFileSync(scanMetaFile, scanMetaJs, 'utf8');
  } catch (e) {
    console.warn('Failed to write latest/history metadata:', e?.message || e);
  }
}

main().catch((err) => {
  console.error('Analysis failed:', err);
  process.exit(1);
});
