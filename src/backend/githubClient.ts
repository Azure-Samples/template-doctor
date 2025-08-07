import https from "https";

const GITHUB_API_BASE = "api.github.com";

/**
 * Makes an HTTPS request to the GitHub API.
 */
function makeRequest<T>(path: string, token?: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: GITHUB_API_BASE,
      path: encodeURI(path), // ✅ ensure proper encoding
      method: "GET",
      headers: {
        "User-Agent": "template-doctor", // ✅ required by GitHub API
        "Accept": "application/vnd.github.v3+json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            reject(new Error("Invalid JSON response"));
          }
        } else {
          reject(new Error(`GitHub API error ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
}

/**
 * Lists all files in a repo at a specific ref (defaults to HEAD).
 */
export async function listRepoFiles(repoFullName: string, ref = "HEAD"): Promise<string[]> {
  const token = process.env.GITHUB_TOKEN;
  const path = `/repos/${repoFullName}/git/trees/${ref}?recursive=1`;
  const result = await makeRequest<{ tree: { path: string }[] }>(path, token);
  return result.tree.map((item) => item.path);
}


/**
 * Fetches the content of a specific file in a repo.
 */
export async function fetchFileContent(repoFullName: string, filePath: string, ref = "main"): Promise<string> {

  const files = await listRepoFiles(repoFullName);
  console.log("Available files:", files);
  if (!files.includes(filePath)) {
    throw new Error(`💥File ${filePath} not found in repository ${repoFullName}`);
  }
  const token = process.env.GITHUB_TOKEN;
  const safeFilePath = filePath.split("/").map(encodeURIComponent).join("/");
  console.log(`Fetching content for ${filePath} in repo ${repoFullName} at ref ${ref}`);
  const path = `/repos/${repoFullName}/contents/${safeFilePath}?ref=${ref}`;
  const result = await makeRequest<{ content: string; encoding: string }>(path, token);

  if (result.encoding === "base64") {
    return Buffer.from(result.content, "base64").toString("utf8");
  } else {
    throw new Error(`Unsupported encoding: ${result.encoding}`);
  }
}

export async function getDefaultBranch(repoFullName: string): Promise<string> {
  const token = process.env.GITHUB_TOKEN;
  const path = `/repos/${repoFullName}`;
  const result = await makeRequest<{ default_branch: string }>(path, token);
  return result.default_branch;
}

