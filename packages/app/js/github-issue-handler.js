// DEPRECATED: Legacy GitHub issue handler replaced by TypeScript implementation in src/scripts/issue-service.ts
// Keeping minimal stubs to avoid reference errors until full purge.
(function(){
  function warn(){ console.warn('[deprecated] github-issue-handler.js is replaced by issue-service.ts'); }
  async function createGitHubIssue(){ warn(); if(window.processIssueCreation && window.GitHubClient){ return window.processIssueCreation(window.GitHubClient);} }
  async function processIssueCreation(github){ warn(); if(window.processIssueCreation){ return window.processIssueCreation(github);} }
  window.createGitHubIssue = window.createGitHubIssue || createGitHubIssue;
  window.processIssueCreation = window.processIssueCreation || processIssueCreation;
})();
