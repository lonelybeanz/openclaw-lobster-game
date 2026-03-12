import { fetch } from 'undici';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

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

export async function getOpenClawNews(): Promise<NewsItem[]> {
  // 先尝试获取 GitHub 资讯
  const githubNews = await getGitHubNews();
  
  // 如果 GitHub 失败，使用本地资讯
  if (githubNews.length === 0) {
    const localNews = await getLocalDocs();
    if (localNews.length > 0) {
      return localNews.slice(0, 50);
    }
    
    // 返回默认
    return [{
      id: 'default',
      title: '欢迎使用 OpenClaw 龙虾养成',
      summary: '查看 OpenClaw 文档了解更多信息',
      source: '系统',
      date: new Date().toISOString().split('T')[0]
    }];
  }
  
  return githubNews.slice(0, 50);
}
