import { listRepoFiles, fetchFileContent, getDefaultBranch } from "./githubClient.js";
import config from "./config/dod-rules.js";
import path from "path";

type Issue = { id: string; severity: "error" | "warning"; message: string, error?: string };

export async function analyzeTemplate(repoUrl: string): Promise<{
  repoUrl: string;
  timestamp: string;
  compliance: {
    issues: Issue[];
    summary: string;
  };
}> {
  const repoFullName = extractRepoFullName(repoUrl);
  const defaultBranch = await getDefaultBranch(repoFullName);
  const files = await listRepoFiles(repoFullName, defaultBranch);
  const issues: Issue[] = [];

  const normalized = files.map((f) => f.toLowerCase());

  for (const file of config.requiredFiles) {
    if (!normalized.includes(file.toLowerCase())) {
      issues.push({
        id: `missing-${file}`,
        severity: "error",
        message: `Missing required file: ${file}`,
        error: `File ${file} not found in repository`,
      });
    }
  }

  for (const folder of config.requiredFolders) {
    if (!normalized.some((f) => f.startsWith(folder.toLowerCase() + "/"))) {
      issues.push({
        id: `missing-folder-${folder}`,
        severity: "error",
        message: `Missing required folder: ${folder}/`,
        error: `Folder ${folder} not found in repository`
      });
    }
  }

  const deprecatedModels = config.openai?.deprecatedModels ?? [];

  const bicepFiles = files.filter((f) => f.startsWith("infra/") && f.endsWith(".bicep"));
  if (bicepFiles.length === 0) {
    issues.push({
      id: "missing-bicep",
      severity: "error",
      message: "No Bicep files found in infra/",
      error: "No Bicep files found in the infra/ directory"
    });
  } else {
    for (const file of bicepFiles) {
      try {
        const content = await fetchFileContent(repoFullName, file, defaultBranch);

        for (const resource of config.bicepChecks.requiredResources) {
          if (!content.includes(resource)) {
            issues.push({
              id: `bicep-missing-${resource.toLowerCase()}`,
              severity: "error",
              message: `Missing resource "${resource}" in ${file}`,
              error: `File ${file} does not contain required resource ${resource}`
            });
          }
        }

        for (const model of deprecatedModels) {
          const modelRegex = new RegExp(`["']?${model}["']?`, "i");
          if (modelRegex.test(content)) {
            issues.push({
              id: `bicep-deprecated-model-${model}`,
              severity: "error",
              message: `Deprecated OpenAI model "${model}" used in ${file}`,
              error: `File ${file} contains deprecated model ${model}`
            });
          }
        }
      } catch(err) {
        console.error(`Failed to read Bicep file: ${file}`);
        console.error(`Error: ${err instanceof Error ? err.message : err}  `);
        issues.push({
          id: `error-reading-${file}`,
          severity: "warning",
          message: `Failed to read ${file}`,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }
  }

  const azureYamlPath = files.find(f => f === "azure.yaml" || f === "azure.yml");
  if (azureYamlPath) {
    try {
      const azureYamlContent = await fetchFileContent(repoFullName, azureYamlPath, defaultBranch);
      if (config.azureYamlRules?.mustDefineServices && !/services\s*:/i.test(azureYamlContent)) {
        issues.push({
          id: "azure-yaml-missing-services",
          severity: "error",
          message: `No "services:" defined in ${azureYamlPath}`,
          error: `File ${azureYamlPath} does not define required "services:" section`
        });
      }
    } catch {
      issues.push({
        id: "azure-yaml-read-error",
        severity: "warning",
        message: `Could not read ${azureYamlPath}`,
        error: `Failed to read file ${azureYamlPath}`
      });
    }
  } else {
    issues.push({
      id: "missing-azure-yaml",
      severity: "error",
      message: "Missing azure.yaml or azure.yml file",
      error: "No azure.yaml or azure.yml file found in repository"
    });
  }

  const summary = issues.length === 0 ? "No issues found 🎉" : "Issues found";

  const result = {
    repoUrl,
    timestamp: new Date().toISOString(),
    compliance: {
      issues,
      summary
    }
  };

  return result;
}

function extractRepoFullName(url: string): string {
  const match = url.match(/github\.com\/([^/]+\/[^/]+)(\.git)?/);
  if (!match) throw new Error("Invalid GitHub URL");
  return match[1];
}
