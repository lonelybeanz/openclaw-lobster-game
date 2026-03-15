import { fetch } from 'undici';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { spawn } from 'child_process';

const ACPX = '/Users/moltbot/.nvm/versions/node/v22.22.0/bin/acpx';
const ENV = {
  ...process.env,
  PATH: '/Users/moltbot/.nvm/versions/node/v22.22.0/bin:/usr/local/bin:/usr/bin:/bin',
  HOME: '/Users/moltbot',
};

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  date: string;
  url?: string;
  type?: string;
}

const OPENCLAW_DIR = '/Users/moltbot/.openclaw';

// 本地文档资讯
async function getLocalDocs(): Promise<NewsItem[]> {
  const news: NewsItem[] = [];
  
  try {
    const docsDir = join(OPENCLAW_DIR, 'workspace', 'docs');
    const files = await readdir(docsDir);
    const mdFiles = files.filter(f => f.endsWith('.md')).slice(0, 10);
    
    for (const file of mdFiles) {
      try {
        const content = await readFile(join(docsDir, file), 'utf-8');
        const title = content.split('\n').find(l => l.startsWith('# '))?.replace('# ', '').trim() || file;
        news.push({
          id: 'doc-' + file,
          title: title.substring(0, 60),
          summary: content.substring(0, 100) + '...',
          source: '本地文档',
          date: new Date().toISOString().split('T')[0]
        });
      } catch {}
    }
  } catch {}
  
  return news;
}

// GitHub API
async function fetchGitHub<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'OpenClaw-Lobster-Game'
      }
    });
    if (res.ok) {
      return await res.json() as T;
    }
  } catch (e) {
    console.log('GitHub API error:', e);
  }
  return null;
}

const OPENCLAW_REPO = 'openclaw/openclaw';

async function getGitHubNews(): Promise<NewsItem[]> {
  const news: NewsItem[] = [];
  
  // 获取 Issues
  const issues = await fetchGitHub<any[]>(`/repos/${OPENCLAW_REPO}/issues?state=open&per_page=15`);
  if (issues) {
    for (const item of issues) {
      if (!item.pull_request) {
        news.push({
          id: `issue-${item.id}`,
          title: item.title?.slice(0, 60),
          summary: `💬 ${item.comments} 评论`,
          source: 'GitHub Issue',
          date: item.created_at?.split('T')[0] || '',
          url: item.html_url
        });
      }
    }
  }
  
  // 获取 PRs
  const prs = await fetchGitHub<any[]>(`/repos/${OPENCLAW_REPO}/pulls?state=open&per_page=10`);
  if (prs) {
    for (const pr of prs) {
      news.push({
        id: `pr-${pr.id}`,
        title: pr.title?.slice(0, 60),
        summary: `🔀 ${pr.changed_files} 文件`,
        source: 'GitHub PR',
        date: pr.created_at?.split('T')[0] || '',
        url: pr.html_url
      });
    }
  }
  
  // 获取 Commits
  const commits = await fetchGitHub<any[]>(`/repos/${OPENCLAW_REPO}/commits?per_page=15`);
  if (commits) {
    for (const commit of commits) {
      const msg = commit.commit.message?.split('\n')[0]?.slice(0, 60) || commit.sha.slice(0, 7);
      news.push({
        id: `commit-${commit.sha}`,
        title: msg,
        summary: `👤 ${commit.commit.author?.name}`,
        source: 'GitHub Commit',
        date: commit.commit.author?.date?.split('T')[0] || '',
        url: commit.html_url
      });
    }
  }
  
  return news;
}

// 获取 Releases
async function getGitHubReleases(): Promise<NewsItem[]> {
  const releases = await fetchGitHub<any[]>(`/repos/${OPENCLAW_REPO}/releases?per_page=10`);
  if (!releases) return [];
  return releases.map(r => ({
    id: `release-${r.id}`,
    title: r.tag_name + ' - ' + (r.name?.slice(0, 50) || ''),
    summary: r.body?.slice(0, 120) || '新版本发布',
    source: 'GitHub Release',
    date: r.published_at?.split('T')[0] || '',
    url: r.html_url
  }));
}

// 搜索 GitHub Issues/PRs
export async function searchGitHubNews(query: string): Promise<NewsItem[]> {
  const news: NewsItem[] = [];
  const q = encodeURIComponent(`${query} repo:${OPENCLAW_REPO}`);
  
  const issues = await fetchGitHub<any>(`/search/issues?q=${q}&per_page=10&sort=updated`);
  if (issues?.items) {
    for (const item of issues.items) {
      news.push({
        id: `search-${item.id}`,
        title: item.title?.slice(0, 60),
        summary: `${item.pull_request ? '🔀 PR' : '💬 Issue'} · ${item.state}`,
        source: item.html_url.includes('pull') ? 'GitHub PR' : 'GitHub Issue',
        date: item.updated_at?.split('T')[0] || '',
        url: item.html_url
      });
    }
  }
  return news;
}

export async function getOpenClawNews(): Promise<NewsItem[]> {
  const [githubNews, releases, localDocs] = await Promise.all([
    getGitHubNews(),
    getGitHubReleases(),
    getLocalDocs()
  ]);
  
  const all = [...releases, ...githubNews, ...localDocs];
  all.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  
  if (all.length === 0) {
    return [{
      id: 'default',
      title: '欢迎使用 OpenClaw 龙虾养成',
      summary: '查看 OpenClaw 文档了解更多信息',
      source: '系统',
      date: new Date().toISOString().split('T')[0]
    }];
  }
  
  return all.slice(0, 20);
}

// 使用 acpx 进行 OpenClaw 搜索（比 openclaw agent 更快）
function runAcpx(prompt: string, timeoutMs = 60000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(ACPX, ['codex', 'prompt', '--', prompt], { 
      env: ENV, 
      timeout: timeoutMs 
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', d => stdout += d);
    child.stderr?.on('data', d => stderr += d);
    child.on('close', code => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`exit ${code}: ${stderr.slice(0, 200)}`));
    });
    child.on('error', err => reject(err));
    setTimeout(() => { child.kill('SIGTERM'); reject(new Error('timeout')); }, timeoutMs);
  });
}

// 使用 OpenClaw 搜索互联网资讯（失败则回退到 GitHub）
export async function searchWithOpenClaw(query: string): Promise<NewsItem[]> {
  try {
    const prompt = `搜索互联网获取关于以下主题的最新信息（最新版本、新功能、教程、攻略等）：

主题：${query}

请返回最新10条信息，每条格式：
[标题] | 简介 | 来源 | 日期

只返回搜索结果，每条一行，不要其他解释。`;

    // 先确保有 session
    const ensureSession = spawn(ACPX, ['codex', 'sessions', 'ensure'], { 
      env: ENV, 
      timeout: 10000 
    });
    
    await new Promise<void>((resolve, reject) => {
      ensureSession.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error('session create failed'));
      });
      ensureSession.on('error', reject);
      setTimeout(() => { ensureSession.kill(); reject(new Error('timeout')); }, 10000);
    });

    const output = await runAcpx(prompt, 60000);
    
    // 解析结果
    const lines = output.split('\n').filter(l => l.trim() && l.includes('|'));
    if (lines.length === 0) {
      throw new Error('no results');
    }
    
    return lines.slice(0, 10).map((line, i) => {
      const parts = line.split('|').map(p => p.trim());
      return {
        id: `web-${Date.now()}-${i}`,
        title: parts[0]?.slice(0, 60) || '无标题',
        summary: parts[1]?.slice(0, 100) || '',
        source: parts[2] || '互联网',
        date: parts[3] || new Date().toISOString().split('T')[0],
        url: ''
      };
    });
  } catch (e) {
    console.error('[searchWithOpenClaw] 搜索失败，回退到 GitHub:', e);
    // 回退到 GitHub 搜索
    return searchGitHubNews(query);
  }
}
