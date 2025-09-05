import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { Octokit } from '@octokit/rest';

// Import analyzer from built dist output of local package
const getRunAnalyzer = async () => {
  try {
    const mod = await import('../../../analyzer-core/dist/run-analyzer.js');
    return (mod as any).runAnalyzer;
  } catch (error) {
    console.error('Error importing analyzer-core dist:', error);
    throw error;
  }
};

interface AnalyzeRequest {
  repoUrl: string;
  ruleSet?: string;
  azureDeveloperCliEnabled?: boolean;
  aiDeprecationCheckEnabled?: boolean;
  archiveOverride?: boolean;
}

interface GitHubFile {
  path: string;
  sha: string;
  content?: string;
  type?: string;
}

export async function analyzeTemplateHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return { status: 204, headers: corsHeaders() };
  }

  try {
    const body = await request.text();
    const requestBody = body ? JSON.parse(body) as AnalyzeRequest : { repoUrl: '' };
    const { repoUrl, ruleSet = 'dod', azureDeveloperCliEnabled, aiDeprecationCheckEnabled, archiveOverride } = requestBody;
    const categoriesParam = (request.query.get('categories') || '').split(',').filter((x: string) => x);

    if (!repoUrl) {
      return { status: 400, headers: corsHeaders(), jsonBody: { error: 'repoUrl is required' } };
    }

    const token = process.env.GITHUB_TOKEN_ANALYZER || process.env.GH_WORKFLOW_TOKEN || null;
    const octokit = new Octokit(token ? { auth: token } : {});

    const { owner, repo } = extractRepoInfo(repoUrl);
    
    // Get default branch
    const repoMeta = await octokit.repos.get({ owner, repo });
    const defaultBranch = repoMeta.data.default_branch;
    
    // Recursive listing
    const files = await listAllFiles(octokit, owner, repo, defaultBranch);
    
    // Populate file contents we actually need for analyzer core (subset)
    const enriched: GitHubFile[] = [];
    for (const f of files.slice(0, 400)) { // safety bound
      if (/\.(md|bicep|ya?ml|json)$/i.test(f.path)) {
        try { 
          f.content = await getFileContent(octokit, owner, repo, f.path, defaultBranch); 
        } catch (_) {}
      }
      enriched.push(f);
    }

    const runAnalyzer = await getRunAnalyzer();
    const result = await runAnalyzer(repoUrl, enriched, { 
      ruleSet, 
      deprecatedModels: (process.env.DEPRECATED_MODELS || '').split(',').filter(Boolean), 
      categories: categoriesParam, 
      azureDeveloperCliEnabled: azureDeveloperCliEnabled !== false, 
      aiDeprecationCheckEnabled: aiDeprecationCheckEnabled !== false
    });
    
    if (archiveOverride === true) {
      result.archiveRequested = true;
    }

    return { status: 200, headers: corsHeaders(), jsonBody: result };
  } catch (error: unknown) {
    const e = error as Error;
    context.error('analyze-template error', e);
    return { status: 500, headers: corsHeaders(), jsonBody: { error: e.message } };
  }
}

function corsHeaders(): Record<string, string> { 
  return { 
    'Access-Control-Allow-Origin': '*', 
    'Access-Control-Allow-Methods': 'POST,OPTIONS', 
    'Access-Control-Allow-Headers': 'Content-Type, Authorization' 
  }; 
}

function extractRepoInfo(url: string): { owner: string; repo: string } { 
  const m = url.match(/github\.com\/([^/]+)\/([^/]+)(\.git)?/i); 
  if (!m) throw new Error('Invalid GitHub URL'); 
  return { owner: m[1], repo: m[2] }; 
}

async function listAllFiles(octokit: Octokit, owner: string, repo: string, ref: string, path: string = ''): Promise<GitHubFile[]> { 
  const res = await octokit.repos.getContent({ owner, repo, path: path || '', ref }); 
  const entries = Array.isArray(res.data) ? res.data : [res.data]; 
  let files: GitHubFile[] = []; 
  
  for (const entry of entries) { 
    if ('type' in entry && entry.type === 'file') { 
      files.push({ path: entry.path, sha: entry.sha }); 
    } else if ('type' in entry && entry.type === 'dir') { 
      const sub = await listAllFiles(octokit, owner, repo, ref, entry.path); 
      files = files.concat(sub); 
    } 
  } 
  
  return files; 
}

async function getFileContent(octokit: Octokit, owner: string, repo: string, path: string, ref: string): Promise<string> { 
  const { data } = await octokit.repos.getContent({ owner, repo, path, ref }); 
  if (!Array.isArray(data) && 'type' in data && data.type === 'file' && 'content' in data) { 
    return Buffer.from(data.content, 'base64').toString(); 
  } 
  throw new Error('Unable to get content for ' + path); 
}

// registration moved to barrel index.ts
