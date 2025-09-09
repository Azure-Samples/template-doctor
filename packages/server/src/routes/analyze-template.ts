import { Router } from 'express';
import { Octokit } from '@octokit/rest';
import { normalizeError } from '../services/errors.js';
import { listRepositoryFiles, getRepositoryFileContent } from '../services/repo-files.js';
import { extractRateLimitHeaders } from '../services/github.js';

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

// Ensure RepoFileMeta includes 'content' property
// If imported from services/repo-files.js, update its definition there as well

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

  const files = await listRepositoryFiles(octokit, owner, repo, defaultBranch);

    // Populate subset of file contents
    const enriched: GitHubFileMeta[] = [];
    for (const f of files.slice(0, 400)) { // safety bound identical to original
      if (/\.(md|bicep|ya?ml|json)$/i.test(f.path)) {
        try {
          f.content = await getRepositoryFileContent(octokit, owner, repo, f.path, defaultBranch);
        } catch (err) {
          // Ignore individual file retrieval errors (network, 404, etc.)
          // Provide optional debug logging without spamming normal output
          if (process.env.DEBUG_ANALYZE === '1') {
            console.warn(`[analyze-template] failed to fetch file content for ${f.path}:`, (err as any)?.message || err);
          }
        }
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

    return res.status(200).json({ ...result, ...extractRateLimitHeaders((repoMeta as any).headers) });
  } catch (err: any) {
    const norm = normalizeError(err, { error: 'Analyzer failure', code: 'analyzer_failed', status: 500 });
    return res.status(norm.status || 500).json(norm);
  }
});

function extractRepoInfo(url: string): { owner: string; repo: string } {
  const m = url.match(/github\.com\/([^/]+)\/([^/]+)(\.git)?/i);
  if (!m) throw new Error('Invalid GitHub URL');
  return { owner: m[1], repo: m[2] };
}

// (old local listing helpers removed; logic centralized in services/repo-files.ts)
