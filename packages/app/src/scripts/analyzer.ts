// @ts-nocheck
// Migrated from js/analyzer.js (behavior preserved)

import { formatViolationAsIssue, mapAnalyzerIssueToViolation } from './issue-format';

// Minimal inlined TemplateAnalyzerDocs implementation (previously relied on a removed legacy global)
class TemplateAnalyzerDocs {
  async getConfig() {
    const docsResponse = await fetch('./configs/docs-config.json');
    if (!docsResponse.ok) throw new Error(`Failed to load docs config: ${docsResponse.status}`);
    const cfg = await docsResponse.json();
    if (cfg.requiredWorkflowFiles) {
      cfg.requiredWorkflowFiles = cfg.requiredWorkflowFiles.map((item: any) => ({
        pattern: new RegExp(item.pattern, 'i'),
        message: item.message,
      }));
    }
    return cfg;
  }
  evaluateDefaultBranchRule(config: any, _repoInfo: any, defaultBranch: string, issues: any[], compliant: any[]) {
    const expected = config?.githubRepositoryConfiguration?.defaultBranch?.mustBe;
    if (!expected) return;
    const norm = (s: any) => String(s).trim();
    if (norm(defaultBranch) !== norm(expected)) {
      issues.push({
        id: `default-branch-not-${expected}`,
        severity: 'error',
        message: `Default branch must be '${expected}'. Current default branch is '${defaultBranch}'.`,
        error: `Default branch is '${defaultBranch}', expected '${expected}'`,
      });
    } else {
      compliant.push({
        id: `default-branch-is-${expected}`,
        category: 'branch',
        message: `Default branch is '${expected}'`,
        details: { defaultBranch },
      });
    }
  }
  validateRepoConfiguration(config: any, repoInfo: any, defaultBranch: string, files: string[], issues: any[], compliant: any[]) {
    try {
      this.evaluateDefaultBranchRule(config, repoInfo, defaultBranch, issues, compliant);
      // Future repo-level validations can be added here.
    } catch (err: any) {
      console.error('Error validating repository configuration:', err);
      issues.push({
        id: 'repo-configuration-validation-failed',
        severity: 'warning',
        message: 'Repository configuration validation failed',
        error: err?.message || String(err),
      });
    }
  }
}

class TemplateAnalyzer {
  constructor() {
    this.githubClient = (window as any).GitHubClient;
    this.ruleSetConfigs = { dod: {}, partner: {}, docs: [], custom: {} };
    this.loadRuleSetConfigs();
    this.debug = (tag, message, data) => {
      if ((window as any).debug) {
        (window as any).debug(tag, message, data);
      } else {
        console.log(`[${tag}] ${message}`, data || '');
      }
    };
  }
  async loadRuleSetConfigs() { try { const dodResponse = await fetch('./configs/dod-config.json'); if (!dodResponse.ok) throw new Error(`Failed to load DoD config: ${dodResponse.status}`); this.ruleSetConfigs.dod = await dodResponse.json(); if (this.ruleSetConfigs.dod.requiredWorkflowFiles) { this.ruleSetConfigs.dod.requiredWorkflowFiles = this.ruleSetConfigs.dod.requiredWorkflowFiles.map((item) => ({ pattern: new RegExp(item.pattern, 'i'), message: item.message })); } const partnerResponse = await fetch('./configs/partner-config.json'); if (!partnerResponse.ok) throw new Error(`Failed to load Partner config: ${partnerResponse.status}`); this.ruleSetConfigs.partner = await partnerResponse.json(); if (this.ruleSetConfigs.partner.requiredWorkflowFiles) { this.ruleSetConfigs.partner.requiredWorkflowFiles = this.ruleSetConfigs.partner.requiredWorkflowFiles.map((item) => ({ pattern: new RegExp(item.pattern, 'i'), message: item.message })); } this.ruleSetConfigs.docs = await (TemplateAnalyzerDocs as any).prototype.getConfig(); const customResponse = await fetch('./configs/custom-config.json'); if (!customResponse.ok) throw new Error(`Failed to load Custom config: ${customResponse.status}`); this.ruleSetConfigs.custom = await customResponse.json(); if (this.ruleSetConfigs.custom.requiredWorkflowFiles) { this.ruleSetConfigs.custom.requiredWorkflowFiles = this.ruleSetConfigs.custom.requiredWorkflowFiles.map((item) => ({ pattern: new RegExp(item.pattern, 'i'), message: item.message })); } console.log('Rule set configurations loaded'); } catch (error) { console.error('Failed to load rule set configurations:', error); this.ruleSetConfigs.dod = { requiredFiles: ['README.md', 'azure.yaml', 'LICENSE'], requiredFolders: ['infra', '.github'], requiredWorkflowFiles: [{ pattern: /\.github\/workflows\/azure-dev\.yml/i, message: 'Missing required GitHub workflow: azure-dev.yml' }], readmeRequirements: { requiredHeadings: ['Prerequisites', 'Getting Started'], architectureDiagram: { heading: 'Architecture', requiresImage: true } } }; this.ruleSetConfigs.partner = { ...this.ruleSetConfigs.dod, requiredFiles: ['README.md', 'azure.yaml'] }; this.ruleSetConfigs.custom = { requiredFiles: ['README.md', 'azure.yaml'], requiredFolders: ['infra'] }; } }
  getConfig(ruleSet = 'dod') { if (!ruleSet || ruleSet === 'dod') { const cfg = (window as any).TemplateDoctorConfig || {}; if (cfg.defaultRuleSet && typeof cfg.defaultRuleSet === 'string') { ruleSet = cfg.defaultRuleSet; } } switch (ruleSet) { case 'partner': return this.ruleSetConfigs.partner; case 'custom': return this.ruleSetConfigs.custom; case 'docs': return this.ruleSetConfigs.docs; case 'dod': default: return this.ruleSetConfigs.dod; } }
  extractRepoInfo(url) { const match = url.match(/github\.com\/([^/]+)\/([^/]+)(\.git)?/); if (!match) throw new Error('Invalid GitHub URL'); return { owner: match[1], repo: match[2], fullName: `${match[1]}/${match[2]}` }; }
  parseMarkdownHeadings(markdown) { const headings = []; const headingRegex = /^(#{1,6})\s+(.+)$/gm; let match; while ((match = headingRegex.exec(markdown)) !== null) { const level = match[1].length; const text = match[2].trim(); const nextLines = markdown.substring(match.index + match[0].length); const hasImage = /^\s*!\[.*?\]\(.*?\)/m.test(nextLines.split('\n').slice(0, 5).join('\n')); headings.push({ level, text, hasImage }); } return headings; }
  checkReadmeRequirements(readmeContent, issues, compliant, config) { const headings = this.parseMarkdownHeadings(readmeContent); const readmeSnippet = readmeContent.split('\n').slice(0,80).join('\n'); if (config.readmeRequirements?.requiredHeadings) { for (const requiredHeading of config.readmeRequirements.requiredHeadings) { const headingMatch = headings.find((h) => h.level === 2 && h.text.toLowerCase() === requiredHeading.toLowerCase()); if (!headingMatch) { issues.push({ id: `readme-missing-heading-${requiredHeading.toLowerCase().replace(/\s+/g, '-')}`, severity: 'error', message: `README.md is missing required h2 heading: ${requiredHeading}`, error: `README.md does not contain required h2 heading: ${requiredHeading}`, filePath: 'README.md', snippet: readmeSnippet }); } else { compliant.push({ id: `readme-heading-${requiredHeading.toLowerCase().replace(/\s+/g, '-')}`, category: 'readmeHeading', message: `README.md contains required h2 heading: ${requiredHeading}`, details: { heading: requiredHeading, level: headingMatch.level } }); } } } if (config.readmeRequirements?.architectureDiagram) { const { heading, requiresImage } = config.readmeRequirements.architectureDiagram; const architectureHeading = headings.find((h) => h.level === 2 && h.text.toLowerCase() === heading.toLowerCase()); if (!architectureHeading) { issues.push({ id: 'readme-missing-architecture-diagram-heading', severity: 'error', message: `README.md is missing required h2 heading: ${heading}`, error: `README.md does not contain required h2 heading: ${heading}`, filePath: 'README.md', snippet: readmeSnippet }); } else { compliant.push({ id: 'readme-architecture-diagram-heading', category: 'readmeHeading', message: `README.md contains required h2 heading: ${heading}`, details: { heading: heading, level: architectureHeading.level } }); if (requiresImage && !architectureHeading.hasImage) { issues.push({ id: 'readme-missing-architecture-diagram-image', severity: 'error', message: `Architecture Diagram section does not contain an image`, error: `README.md has Architecture Diagram heading but is missing an image`, filePath: 'README.md', snippet: readmeSnippet }); } else if (requiresImage && architectureHeading.hasImage) { compliant.push({ id: 'readme-architecture-diagram-image', category: 'readmeImage', message: `Architecture Diagram section contains an image`, details: { heading: heading } }); } } } }
  async analyzeTemplate(repoUrl, ruleSet = 'dod') { if (!ruleSet || ruleSet === 'dod') { const cfg = (window as any).TemplateDoctorConfig || {}; if (cfg.defaultRuleSet && typeof cfg.defaultRuleSet === 'string') { ruleSet = cfg.defaultRuleSet; } } const cfg = (window as any).TemplateDoctorConfig || {}; const preferServerSide = cfg.preferServerSideAnalysis === true || cfg.analysis?.useServerSide === true; const allowFallback = false; if (preferServerSide) { try { const result = await this.analyzeTemplateServerSide(repoUrl, ruleSet); (window as any).TemplateDoctorRuntime = Object.assign({}, (window as any).TemplateDoctorRuntime, { lastMode: 'server', lastServerAttemptFailed: false, fallbackUsed: false }); document.dispatchEvent(new CustomEvent('analysis-mode-changed')); return result; } catch (err) { console.error('[analyzer] Server-side analysis failed', err); (window as any).TemplateDoctorRuntime = Object.assign({}, (window as any).TemplateDoctorRuntime, { lastMode: 'server-failed', lastServerAttemptFailed: true }); document.dispatchEvent(new CustomEvent('analysis-mode-changed')); throw err instanceof Error ? err : new Error(String(err)); } } (window as any).TemplateDoctorRuntime = Object.assign({}, (window as any).TemplateDoctorRuntime, { lastMode: 'client', fallbackUsed: false }); document.dispatchEvent(new CustomEvent('analysis-mode-changed')); const config = this.getConfig(ruleSet); const repoInfo = this.extractRepoInfo(repoUrl); let customConfig = null; if (ruleSet === 'custom') { try { const savedConfig = localStorage.getItem('td_custom_ruleset'); if (savedConfig) { customConfig = JSON.parse(savedConfig); } } catch (e) { console.error('Error loading custom configuration:', e); } } this.debug('analyzer', `Analyzing repository ${repoInfo.fullName} with rule set: ${ruleSet}`); try { const defaultBranch = await this.githubClient.getDefaultBranch(repoInfo.owner, repoInfo.repo); const files = await this.githubClient.listAllFiles(repoInfo.owner, repoInfo.repo, defaultBranch); const issues = []; const compliant = []; if (ruleSet === 'docs') { (TemplateAnalyzerDocs as any).prototype.validateRepoConfiguration(config, repoInfo, defaultBranch, files, issues, compliant); } const normalized = files.map((f) => f.toLowerCase()); for (const file of config.requiredFiles) { if (!normalized.includes(file.toLowerCase())) { issues.push({ id: `missing-${file}`, severity: 'error', message: `Missing required file: ${file}`, error: `File ${file} not found in repository` }); } else { compliant.push({ id: `file-${file}`, category: 'requiredFile', message: `Required file found: ${file}`, details: { fileName: file } }); } } if (config.requiredWorkflowFiles) { for (const workflowFile of config.requiredWorkflowFiles) { const matchingFile = normalized.find((file) => workflowFile.pattern.test(file)); if (!matchingFile) { issues.push({ id: `missing-workflow-${workflowFile.pattern.source}`, severity: 'error', message: workflowFile.message, error: workflowFile.message }); } else { compliant.push({ id: `workflow-${matchingFile}`, category: 'requiredWorkflow', message: `Required workflow file found: ${matchingFile}`, details: { fileName: matchingFile, patternMatched: workflowFile.pattern.source } }); } } } for (const folder of config.requiredFolders) { if (!normalized.some((f) => f.startsWith(folder.toLowerCase() + '/'))) { issues.push({ id: `missing-folder-${folder}`, severity: 'error', message: `Missing required folder: ${folder}/`, error: `Folder ${folder} not found in repository` }); } else { const folderFiles = normalized.filter((f) => f.startsWith(folder.toLowerCase() + '/')); compliant.push({ id: `folder-${folder}`, category: 'requiredFolder', message: `Required folder found: ${folder}/`, details: { folderPath: folder, fileCount: folderFiles.length } }); } } if (config.readmeRequirements && normalized.some((f) => f === 'readme.md')) { try { const readmeContent = await this.githubClient.getFileContent(repoInfo.owner, repoInfo.repo, 'README.md'); this.checkReadmeRequirements(readmeContent, issues, compliant, config); } catch (err) { issues.push({ id: 'readme-read-error', severity: 'warning', message: 'Could not read README.md', error: err instanceof Error ? err.message : String(err) }); } } const bicepFiles = files.filter((f) => f.startsWith('infra/') && f.endsWith('.bicep')); if (bicepFiles.length === 0) { issues.push({ id: 'missing-bicep', severity: 'error', message: 'No Bicep files found in infra/', error: 'No Bicep files found in the infra/ directory' }); } else { compliant.push({ id: 'bicep-files-exist', category: 'bicepFiles', message: `Bicep files found in infra/ directory: ${bicepFiles.length} files`, details: { count: bicepFiles.length, files: bicepFiles } }); for (const file of bicepFiles) { try { const content = await this.githubClient.getFileContent(repoInfo.owner, repoInfo.repo, file); for (const resource of config.bicepChecks.requiredResources) { if (!content.includes(resource)) { issues.push({ id: `bicep-missing-${resource.toLowerCase()}`, severity: 'error', message: `Missing resource "${resource}" in ${file}`, error: `File ${file} does not contain required resource ${resource}` }); } else { compliant.push({ id: `bicep-resource-${resource.toLowerCase()}-${file}`, category: 'bicepResource', message: `Found required resource "${resource}" in ${file}`, details: { resource: resource, file: file } }); } } this.analyzeAuthenticationMethods(content, file, issues, compliant); } catch (err) { console.error(`Failed to read Bicep file: ${file}`); issues.push({ id: `error-reading-${file}`, severity: 'warning', message: `Failed to read ${file}`, error: err instanceof Error ? err.message : String(err) }); } } }
  const azureYamlPath = files.find((f) => f === 'azure.yaml' || f === 'azure.yml'); if (azureYamlPath) { compliant.push({ id: 'azure-yaml-exists', category: 'azureYaml', message: `Found azure.yaml file: ${azureYamlPath}`, details: { fileName: azureYamlPath } }); try { const azureYamlContent = await this.githubClient.getFileContent(repoInfo.owner, repoInfo.repo, azureYamlPath); const azureSnippet = azureYamlContent.split('\n').slice(0,120).join('\n'); if (config.azureYamlRules?.mustDefineServices && !/services\s*:/i.test(azureYamlContent)) { issues.push({ id: 'azure-yaml-missing-services', severity: 'error', message: `No "services:" defined in ${azureYamlPath}`, error: `File ${azureYamlPath} does not define required "services:" section`, filePath: azureYamlPath, snippet: azureSnippet }); } else if (config.azureYamlRules?.mustDefineServices) { compliant.push({ id: 'azure-yaml-services-defined', category: 'azureYaml', message: `"services:" section found in ${azureYamlPath}`, details: { fileName: azureYamlPath } }); } } catch { issues.push({ id: 'azure-yaml-read-error', severity: 'warning', message: `Could not read ${azureYamlPath}`, error: `Failed to read file ${azureYamlPath}` }); } } else { issues.push({ id: 'missing-azure-yaml', severity: 'error', message: 'Missing azure.yaml or azure.yml file', error: 'No azure.yaml or azure.yml file found in repository' }); }
      // Post-process: add snippets for bicep missing resource issues if not already present
      for (const issue of issues) {
        if (issue.id && issue.id.startsWith('bicep-missing-') && !issue.snippet && issue.message && issue.message.includes(' in ')) {
          const possibleFile = issue.message.split(' in ').pop();
            if (possibleFile && /\.bicep$/i.test(possibleFile)) {
              try {
                const content = await this.githubClient.getFileContent(repoInfo.owner, repoInfo.repo, possibleFile);
                issue.filePath = possibleFile;
                issue.snippet = content.split('\n').slice(0,160).join('\n');
              } catch { /* ignore snippet enrichment errors */ }
            }
        }
      }
      const summary = issues.length === 0 ? 'No issues found 🎉' : 'Issues found'; const totalChecks = issues.length + compliant.length; const percentageCompliant = totalChecks > 0 ? Math.round((compliant.length / totalChecks) * 100) : 0; compliant.push({ id: 'compliance-summary', category: 'meta', message: `Compliance: ${percentageCompliant}%`, details: { issueCount: issues.length, compliantCount: compliant.length, totalChecks: totalChecks, percentageCompliant: percentageCompliant } });
      // Enrich issues with templated issue bodies for downstream GitHub issue creation.
      const enrichedIssues = issues.map(i => { try { const v = mapAnalyzerIssueToViolation(i); if (v) { if (i.filePath && !v.filePath) v.filePath = i.filePath; if (i.snippet && !v.snippet) v.snippet = i.snippet; i.issueTemplate = formatViolationAsIssue(v, { compliancePercentage: percentageCompliant }); } } catch(e){ /* swallow enrichment failures */ } return i; });
      const result = { repoUrl, ruleSet, timestamp: new Date().toISOString(), compliance: { issues: enrichedIssues, compliant, summary: `${summary} - Compliance: ${percentageCompliant}%` } };
      if (ruleSet === 'custom' && customConfig) { result.customConfig = { gistUrl: customConfig.gistUrl || null }; }
      return result; } catch (error) { console.error('Error analyzing template:', error); throw new Error(`Failed to analyze repository: ${error.message}`); } }
  async analyzeTemplateServerSide(repoUrl, ruleSet) { this.debug('analyzer', `Using server-side analysis for ${repoUrl} with ruleset: ${ruleSet}`); try { let customConfig = null; if (ruleSet === 'custom') { try { const savedConfig = localStorage.getItem('td_custom_ruleset'); if (savedConfig) { customConfig = JSON.parse(savedConfig); } } catch (e) { console.error('Error loading custom configuration:', e); } } const payload = { repoUrl, ruleSet, ...(customConfig ? { customConfig } : {}) }; const cfg = (window as any).TemplateDoctorConfig || {}; const apiBase = cfg.apiBase || window.location.origin; const endpoint = (window as any).ApiRoutes ? (window as any).ApiRoutes.build('analyze-template') : `${apiBase.replace(/\/$/, '')}/api/v4/analyze-template`; const headers = { 'Content-Type': 'application/json' }; if (cfg.functionKey) { (headers as any)['x-functions-key'] = cfg.functionKey; } if ((window as any).GitHubClient && (window as any).GitHubClient.auth && (window as any).GitHubClient.auth.isAuthenticated()) { const token = (window as any).GitHubClient.auth.getToken(); if (token) { (headers as any)['Authorization'] = `Bearer ${token}`; } } const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload) }); if (!response.ok) { const errorText = await response.text(); throw new Error(`Server-side analysis failed: ${response.status} ${response.statusText} - ${errorText}`); } const result = await response.json(); if (!result.timestamp) { result.timestamp = new Date().toISOString(); } return result; } catch (error) { console.error('Error in server-side analysis:', error); throw new Error(`Server-side analysis failed: ${error.message}`); } }
  evaluateDefaultBranchRule(config, repoInfo, defaultBranch, issues, compliant) { const expected = config?.githubRepositoryConfiguration?.defaultBranch?.mustBe; if (!expected) return; const normalize = (s) => String(s).trim(); if (normalize(defaultBranch) !== normalize(expected)) { issues.push({ id: `default-branch-not-${expected}`, severity: 'error', message: `Default branch must be '${expected}'. Current default branch is '${defaultBranch}'.`, error: `Default branch is '${defaultBranch}', expected '${expected}'` }); } else { compliant.push({ id: `default-branch-is-${expected}`, category: 'branch', message: `Default branch is '${expected}'`, details: { defaultBranch } }); } }
  analyzeAuthenticationMethods(content, file, issues, compliant) { const config = this.getConfig(); const securityChecks = config.bicepChecks?.securityBestPractices; if (!securityChecks) { return; } const hasManagedIdentity = this.checkForManagedIdentity(content); const authMethods = this.detectAuthenticationMethods(content); if (hasManagedIdentity) { compliant.push({ id: `bicep-uses-managed-identity-${file}`, category: 'bicepSecurity', message: `Good practice: ${file} uses Managed Identity for Azure authentication`, details: { file: file, authMethod: 'ManagedIdentity' } }); } if (securityChecks.detectInsecureAuth && authMethods.length > 0) { const authMethodsList = authMethods.join(', '); issues.push({ id: `bicep-alternative-auth-${file}`, severity: 'warning', message: `Security recommendation: Replace ${authMethodsList} with Managed Identity in ${file}`, error: `File ${file} uses ${authMethodsList} for authentication instead of Managed Identity`, recommendation: `Consider replacing ${authMethodsList} with Managed Identity for better security.` }); } if (securityChecks.checkAnonymousAccess && !hasManagedIdentity && authMethods.length === 0) { const resourcesRequiringAuth = this.detectResourcesRequiringAuth(content); if (resourcesRequiringAuth.length > 0) { const resourcesList = resourcesRequiringAuth.join(', '); issues.push({ id: `bicep-missing-auth-${file}`, severity: 'warning', message: `Security recommendation: Add Managed Identity for ${resourcesList} in ${file}`, error: `File ${file} may have resources (${resourcesList}) with anonymous access or missing authentication`, recommendation: `Configure Managed Identity for secure access to these resources.` }); } } }
  checkForManagedIdentity(content) { const patterns = [/identity:\s*\{\s*type:\s*['"]SystemAssigned['"]/i, /identity:\s*\{\s*type:\s*['"]UserAssigned['"]/i, /identity:\s*\{\s*type:\s*['"]SystemAssigned,UserAssigned['"]/i, /['"]identity['"]\s*:\s*\{\s*['"]type['"]\s*:\s*['"]SystemAssigned['"]/i, /['"]identity['"]\s*:\s*\{\s*['"]type['"]\s*:\s*['"]UserAssigned['"]/i, /['"]identity['"]\s*:\s*\{\s*['"]type['"]\s*:\s*['"]SystemAssigned,UserAssigned['"]/i, /managedIdentities:\s*\{\s*systemAssigned:\s*true/i, /managedIdentities:\s*\{\s*userAssignedResourceIds:/i]; return patterns.some((pattern) => pattern.test(content)); }
  detectAuthenticationMethods(content) { const authMethods = []; if (/connectionString/i.test(content) || /['"]ConnectionString['"]/i.test(content)) { authMethods.push('Connection String'); } if (/accessKey/i.test(content) || /['"]accessKey['"]/i.test(content) || /primaryKey/i.test(content) || /['"]primaryKey['"]/i.test(content) || /secondaryKey/i.test(content) || /['"]secondaryKey['"]/i.test(content)) { authMethods.push('Access Key'); } const resourceBlocks = content.match(/resource\s+\w+\s+'[^']*'\s*{[^}]*}/gis) || []; let keyVaultSecretWithoutMI = false; for (const block of resourceBlocks) { if (/keyVault.*\/secrets\//i.test(block) || /['"]secretUri['"]/i.test(block)) { if (!/identity\s*:/i.test(block) && !/identity\s*{/i.test(block)) { keyVaultSecretWithoutMI = true; break; } } } if (keyVaultSecretWithoutMI) { authMethods.push('KeyVault Secret without Managed Identity'); } if (/sasToken/i.test(content) || /['"]sasToken['"]/i.test(content) || /sharedAccessSignature/i.test(content) || /SharedAccessKey/i.test(content)) { authMethods.push('SAS Token'); } if (/storageAccountKey/i.test(content) || /['"]storageAccountKey['"]/i.test(content)) { authMethods.push('Storage Account Key'); } if (/AccountKey=/i.test(content) || /Password=/i.test(content) || /UserName=/i.test(content) || /AccountEndpoint=/i.test(content)) { authMethods.push('Connection String with credentials'); } return authMethods; }
  detectResourcesRequiringAuth(content) { const resources = []; const resourcePatterns = [ { pattern: /Microsoft\.Storage\/storageAccounts/i, name: 'Storage Account' }, { pattern: /Microsoft\.KeyVault\/vaults/i, name: 'Key Vault' }, { pattern: /Microsoft\.DocumentDB\/databaseAccounts/i, name: 'Cosmos DB' }, { pattern: /Microsoft\.Sql\/servers/i, name: 'SQL Server' }, { pattern: /Microsoft\.Web\/sites/i, name: 'App Service' }, { pattern: /Microsoft\.ContainerRegistry\/registries/i, name: 'Container Registry' }, { pattern: /Microsoft\.ServiceBus\/namespaces/i, name: 'Service Bus' }, { pattern: /Microsoft\.EventHub\/namespaces/i, name: 'Event Hub' }, { pattern: /Microsoft\.ApiManagement\/service/i, name: 'API Management' }, { pattern: /Microsoft\.CognitiveServices\/accounts/i, name: 'Cognitive Services' }, { pattern: /Microsoft\.ContainerService\/managedClusters/i, name: 'AKS Cluster' }, { pattern: /Microsoft\.Cache\/Redis/i, name: 'Redis Cache' }, { pattern: /Microsoft\.Search\/searchServices/i, name: 'Search Service' }, { pattern: /Microsoft\.OperationalInsights\/workspaces/i, name: 'Log Analytics' } ]; for (const { pattern, name } of resourcePatterns) { if (pattern.test(content)) { resources.push(name); } } return resources; }
  validateRepoConfiguration(config, repoInfo, defaultBranch, issues, compliant) { try { this.evaluateDefaultBranchRule(config, repoInfo, defaultBranch, issues, compliant); } catch (err) { console.error('Error validating repository configuration:', err); issues.push({ id: 'repo-configuration-validation-failed', severity: 'warning', message: 'Repository configuration validation failed', error: err instanceof Error ? err.message : String(err) }); } }
}
// Immediate, non-blocking initialization so tests and early callers can access TemplateAnalyzer
if (!(window as any).TemplateAnalyzer) {
  (window as any).TemplateAnalyzer = new TemplateAnalyzer();
  console.log('[TemplateAnalyzer] Created early instance (GitHubClient may attach later)');
  document.dispatchEvent(new CustomEvent('template-analyzer-ready'));
}

function attachGitHubClientIfAvailable() {
  const analyzer = (window as any).TemplateAnalyzer;
  const ghc = (window as any).GitHubClient;
  if (analyzer && ghc && analyzer.githubClient !== ghc) {
    analyzer.githubClient = ghc;
    console.log('[TemplateAnalyzer] GitHub client attached');
    return true;
  }
  return false;
}

// Try immediate attach, then short retries for race conditions
if (!attachGitHubClientIfAvailable()) {
  let attempts = 0;
  const maxAttempts = 10; // up to ~5s
  const interval = setInterval(() => {
    attempts++;
    if (attachGitHubClientIfAvailable() || attempts >= maxAttempts) {
      clearInterval(interval);
    }
  }, 500);
}

document.addEventListener('github-auth-changed', () => {
  attachGitHubClientIfAvailable();
});

(window as any).checkAnalyzerReady = function () { return !!(window as any).TemplateAnalyzer; };
export {};