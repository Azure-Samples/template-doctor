const config = {
  requiredFiles: [
    "azure.yaml",
    "README.md"
  ],
  requiredFolders: [
    ".github/workflows",
    ".github/ISSUE_TEMPLATE",
    "src",
    "infra"
  ],
  bicepChecks: {
    requiredResources: [
      "Microsoft.Identity"
    ]
  },
  azureYamlRules: {
    mustDefineServices: true
  },
  openai: {
    deprecatedModels: [
      "gpt-35-turbo",
      "gpt-4",
      "gpt-4-32k",
      "text-embedding-ada-002"
    ]
  }
};

export default config;
