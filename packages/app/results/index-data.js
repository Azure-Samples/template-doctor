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
    "timestamp": "2025-09-02T08:53:27.297Z",
    "dashboardPath": "1756803229305-dashboard.html",
    "dataPath": "1756803229305-data.js",
    "repoUrl": "https://github.com/anfibiacreativa/signalr-ai-streaming",
    "collection": "aigallery",
    "ruleSet": "dod",
    "compliance": {
      "percentage": 25,
      "issues": 33,
      "passed": 12
    },
    "scannedBy": [
      "anfibiacreativa"
    ],
    "relativePath": "anfibiacreativa-signalr-ai-streaming/1756803229305-dashboard.html"
  }
];
  }
  
  const cfg = window.TemplateDoctorConfig || {};
  const requireAuth = typeof cfg.requireAuthForResults === 'boolean' ? cfg.requireAuthForResults : true;
  const isAuthed = !!(window.GitHubAuth && window.GitHubAuth.isAuthenticated && window.GitHubAuth.isAuthenticated());

  if (!requireAuth || isAuthed) {
    console.log('#########[index-data] User is authenticated; using existing template data');

    if (!Array.isArray(window.templatesData)) {
      window.templatesData = [...seed];
    }
      window.templatesData = [...seed];

  } else {
    // If not authenticated, set an empty array
    console.log('[index-data] User is not authenticated, setting empty template data');
    window.templatesData = [];
  }
  console.log('[index-data] Template data loaded, entries:', window.templatesData.length);
})();
