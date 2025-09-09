import { Octokit } from '@octokit/rest';
import { withRetry } from './github.js';

export interface RepoFileMeta { path: string; sha: string; type?: string; content?: string; }

export async function listRepositoryFiles(octokit: Octokit, owner: string, repo: string, ref: string, path = ''): Promise<RepoFileMeta[]> {
  const res: any = await withRetry(() => octokit.repos.getContent({ owner, repo, path: path || '', ref }), { attempts: 3 });
  const entries = Array.isArray(res.data) ? res.data : [res.data];
  let files: RepoFileMeta[] = [];
  for (const entry of entries) {
    if (entry.type === 'file') {
      files.push({ path: entry.path, sha: entry.sha, type: 'file' });
    } else if (entry.type === 'dir') {
      const sub = await listRepositoryFiles(octokit, owner, repo, ref, entry.path);
      files = files.concat(sub);
    }
  }
  return files;
}

export async function getRepositoryFileContent(octokit: Octokit, owner: string, repo: string, path: string, ref: string): Promise<string> {
  const { data }: any = await withRetry(() => octokit.repos.getContent({ owner, repo, path, ref }), { attempts: 2 });
  if (!Array.isArray(data) && data.type === 'file' && data.content) {
    return Buffer.from(data.content, 'base64').toString();
  }
  throw new Error('Unable to get content for ' + path);
}
