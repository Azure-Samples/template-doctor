export interface GitHubFile {
  path: string;
  sha: string;
  content?: string;
  type?: string;
}

export interface AnalyzerOptions {
  ruleSet?: string;
  deprecatedModels?: string[];
  categories?: string[];
  azureDeveloperCliEnabled?: boolean;
  aiDeprecationCheckEnabled?: boolean;
}

export interface AnalyzerResult {
  issues: any[];
  compliant: any[];
  archiveRequested?: boolean;
  // Add other properties as needed
}

export type RunAnalyzer = (
  repoUrl: string,
  files: GitHubFile[],
  options: AnalyzerOptions
) => Promise<AnalyzerResult>;
