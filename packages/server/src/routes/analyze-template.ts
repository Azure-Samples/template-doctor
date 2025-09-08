import { Router } from 'express';
import { Octokit } from '@octokit/rest';

// Lazy import of analyzer-core dist to mirror original function behaviour
async function getRunAnalyzer(): Promise<(repoUrl: string, files: any[], opts: any) => Promise<any>> {
  try {
    const mod: any = await import('../../../analyzer-core/dist/run-analyzer.js');
    return mod.runAnalyzer;
  } catch (err) {
    console.error('[analyze-template] failed dynamic import analyzer-core', err);
    throw err;
  }
}

interface AnalyzeRequestBody {
  repoUrl: string;
  ruleSet?: string;
  azureDeveloperCliEnabled?: boolean;
  aiDeprecationCheckEnabled?: boolean;
  archiveOverride?: boolean;
}

interface GitHubFileMeta { path: string; sha: string; content?: string; type?: string; }

export const analyzeTemplateRouter = Router();

analyzeTemplateRouter.options('/', (_req, res) => res.sendStatus(204));

analyzeTemplateRouter.post('/', async (req, res) => {
  const body: AnalyzeRequestBody = req.body || {} as any;
  const { repoUrl, ruleSet = 'dod', azureDeveloperCliEnabled, aiDeprecationCheckEnabled, archiveOverride } = body;
  const categoriesParam: string[] = typeof req.query.categories === 'string'
    ? (req.query.categories as string).split(',').filter(Boolean)
    : [];

  if (!repoUrl) return res.status(400).json({ error: 'repoUrl is required' });

  // Analyzer uses broader token precedence (match original): GITHUB_TOKEN_ANALYZER first then GH_WORKFLOW_TOKEN
  const token = process.env.GITHUB_TOKEN_ANALYZER || process.env.GH_WORKFLOW_TOKEN || undefined;
  const octokit = new Octokit(token ? { auth: token } : {});

  try {
    const { owner, repo } = extractRepoInfo(repoUrl);
    // default branch
    const repoMeta = await octokit.repos.get({ owner, repo });
    const defaultBranch = (repoMeta as any).data.default_branch;

    const files = await listAllFiles(octokit, owner, repo, defaultBranch);

    // Populate subset of file contents
    const enriched: GitHubFileMeta[] = [];
    for (const f of files.slice(0, 400)) { // safety bound identical to original
      if (/\.(md|bicep|ya?ml|json)$/i.test(f.path)) {
        try { f.content = await getFileContent(octokit, owner, repo, f.path, defaultBranch); } catch { /* ignore individual file errors */ }
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
      (result as any).archiveRequested = true;
    }

    return res.status(200).json(result);
  } catch (err: any) {
    console.error('[analyze-template] error', err);
    return res.status(500).json({ error: err?.message || 'Analyzer failure' });
  }
});

function extractRepoInfo(url: string): { owner: string; repo: string } {
  const m = url.match(/github\.com\/([^/]+)\/([^/]+)(\.git)?/i);
  if (!m) throw new Error('Invalid GitHub URL');
  return { owner: m[1], repo: m[2] };
}

async function listAllFiles(octokit: Octokit, owner: string, repo: string, ref: string, path = ''): Promise<GitHubFileMeta[]> {
  const res: any = await octokit.repos.getContent({ owner, repo, path: path || '', ref });
  const entries = Array.isArray(res.data) ? res.data : [res.data];
  let files: GitHubFileMeta[] = [];
  for (const entry of entries) {
    if (entry.type === 'file') {
      files.push({ path: entry.path, sha: entry.sha });
    } else if (entry.type === 'dir') {
      const sub = await listAllFiles(octokit, owner, repo, ref, entry.path);
      files = files.concat(sub);
    }
  }
  return files;
}

async function getFileContent(octokit: Octokit, owner: string, repo: string, path: string, ref: string): Promise<string> {
  const { data }: any = await octokit.repos.getContent({ owner, repo, path, ref });
  if (!Array.isArray(data) && data.type === 'file' && data.content) {
    return Buffer.from(data.content, 'base64').toString();
  }
  throw new Error('Unable to get content for ' + path);
}
