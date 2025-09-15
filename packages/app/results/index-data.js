// Control visibility of results via runtime config
(function() {
  console.log('###############[index-data] Loading template data, authentication check:',
              window.GitHubAuth ? 'GitHubAuth exists' : 'GitHubAuth missing',
              window.GitHubAuth?.isAuthenticated ? 'Auth method exists' : 'Auth method missing',
              window.GitHubAuth?.isAuthenticated ? 'Auth state: ' + window.GitHubAuth.isAuthenticated() : 'Cannot check auth state');
  let seed = [
      {
        "timestamp": "2025-09-01T12:54:12.843Z",
        "dashboardPath": "1756731277912-dashboard.html",
        "dataPath": "1756731277912-data.js",
        "repoUrl": "https://github.com/anfibiacreativa/rag-postgres-openai-python",
        "collection": "aigallery",
        "ruleSet": "dod",
        "compliance": {
          "percentage": 19,
          "issues": 43,
          "passed": 11
        },
        "scannedBy": [
          "anfibiacreativa"
        ],
        "relativePath": "anfibiacreativa-rag-postgres-openai-python/1756731277912-dashboard.html"
      },
      {
        "timestamp": "2025-07-25T10:14:02.435Z",
        "dashboardPath": "1753438442443-dashboard.html",
        "dataPath": "1753438442443-data.js",
        "repoUrl": "https://github.com/Azure-Samples/get-started-with-ai-agents",
        "originUpstream": "Azure-Samples/get-started-with-ai-agents",
        "ruleSet": "partner",
        "compliance": {
          "percentage": 56,
          "issues": 19,
          "passed": 24
        },
        "scannedBy": ["anfibiacreativa"],
        "relativePath": "get-started-with-ai-agents/1753438442443-dashboard.html"
      },
      {
        "timestamp": "2025-07-25T08:38:45.913Z",
        "dashboardPath": "1753432725919-dashboard.html",
        "dataPath": "1753432725919-data.js",
        "repoUrl": "https://github.com/Azure-Samples/openai-langchainjs",
        "originUpstream": "Azure-Samples/openai-langchainjs",
        "ruleSet": "partner",
        "compliance": {
          "percentage": 60,
          "issues": 6,
          "passed": 9
        },
        "scannedBy": ["anfibiacreativa"],
        "relativePath": "openai-langchainjs/1753432725919-dashboard.html"
      },
      {
        "timestamp": "2025-07-24T19:00:06.379Z",
        "dashboardPath": "1753383606390-dashboard.html",
        "dataPath": "1753383606390-data.js",
        "repoUrl": "https://github.com/Azure-Samples/todo-csharp-sql-swa-func",
        "originUpstream": "Azure-Samples/todo-csharp-sql-swa-func",
        "ruleSet": "dod",
        "compliance": {
          "percentage": 51,
          "issues": 40,
          "passed": 41
        },
        "scannedBy": ["anfibiacreativa"],
        "relativePath": "todo-csharp-sql-swa-func/1753383606390-dashboard.html"
      },
      {
        "timestamp": "2025-07-24T16:34:48.932Z",
        "dashboardPath": "1753374888936-dashboard.html",
        "dataPath": "1753374888936-data.js",
        "repoUrl": "https://github.com/Azure-Samples/todo-nodejs-mongo-coreconf",
        "originUpstream": "Azure-Samples/todo-nodejs-mongo-coreconf",
        "ruleSet": "dod",
        "compliance": {
          "percentage": 52,
          "issues": 12,
          "passed": 13
        },
        "scannedBy": ["anfibiacreativa"],
        "relativePath": "todo-nodejs-mongo-coreconf/1753374888936-dashboard.html"
      },
      {
        "timestamp": "2025-07-25T06:06:06.910Z",
        "dashboardPath": "1753423566922-dashboard.html",
        "dataPath": "1753423566922-data.js",
        "repoUrl": "https://github.com/Azure-Samples/todo-nodejs-mongo-swa",
        "originUpstream": "Azure-Samples/todo-nodejs-mongo-swa",
        "ruleSet": "dod",
        "compliance": {
          "percentage": 52,
          "issues": 16,
          "passed": 17
        },
        "scannedBy": ["anfibiacreativa"],
        "relativePath": "todo-nodejs-mongo-swa/1753423566922-dashboard.html"
      }
    ];
  // Only populate the data if the user is authenticated
  if (!window.templatesData) {
    // Initialize templatesData if it doesn't exist yet
    window.templatesData = [
  {
    "timestamp": "2025-09-15T15:46:35.648Z",
    "dashboardPath": "1757951209586-dashboard.html",
    "dataPath": "1757951209586-data.js",
    "repoUrl": "https://github.com/anfibiacreativa/cosmosdb-nosql-copilot",
    "collection": "aigallery",
    "ruleSet": "dod",
    "compliance": {
      "percentage": 16,
      "issues": 54,
      "passed": 11
    },
    "scannedBy": [
      "anfibiacreativa"
    ],
    "relativePath": "anfibiacreativa-cosmosdb-nosql-copilot/1757951209586-dashboard.html"
  }
];
  }
  
  const cfg = window.TemplateDoctorConfig || {};
  const requireAuth = typeof cfg.requireAuthForResults === 'boolean' ? cfg.requireAuthForResults : true;
  const isAuthed = !!(window.GitHubAuth && window.GitHubAuth.isAuthenticated && window.GitHubAuth.isAuthenticated());

  // Non‑destructive hydration: always keep seed data available so previously scanned templates never "disappear".
  // If auth gating is required, the UI layer can decide to hide rather than erase data.
  if (!Array.isArray(window.templatesData) || window.templatesData.length === 0) {
    window.templatesData = [...seed];
  }

  if (requireAuth && !isAuthed) {
    console.log('[index-data] Auth required but user not authenticated – leaving templatesData populated (UI may hide it).');
    window.__TEMPLATE_RESULTS_DEFERRED = true;
  } else {
    window.__TEMPLATE_RESULTS_DEFERRED = false;
  }
  console.log('[index-data] Template data loaded (non-destructive). Entries:', window.templatesData.length, 'authRequired:', requireAuth, 'isAuthed:', isAuthed);
})();
