import { fetch } from 'undici';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { runOpenClawAgentPrompt } from './openclaw';

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
          date: new Date().toISOString().slice(0, 10)
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

function normalizeNewsItem(item: Partial<NewsItem>, index: number, prefix: string): NewsItem {
  return {
    id: item.id || `${prefix}-${Date.now()}-${index}`,
    title: (item.title || '无标题').slice(0, 120),
    summary: item.summary || '暂无简介',
    source: item.source || '互联网',
    date: item.date || new Date().toISOString().slice(0, 10),
    url: item.url || '',
    type: item.type,
  };
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
  const keywords = query
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 4);
  const q = encodeURIComponent(`${keywords.join(' ')} repo:${OPENCLAW_REPO}`);
  
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

  if (news.length > 0) {
    return news.slice(0, 10);
  }

  return (await getOpenClawNews()).slice(0, 10);
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
      date: new Date().toISOString().slice(0, 10)
    }];
  }
  
  return all.slice(0, 20);
}

// 使用 OpenClaw 搜索互联网资讯（异步后台执行）
type SearchJob = {
  status: 'pending' | 'done' | 'error';
  query: string;
  startedAt: string;
  finishedAt?: string;
  results?: NewsItem[];
  error?: string;
};

const SEARCH_JOB_TTL_MS = 10 * 60 * 1000;
const searchJobs = new Map<string, SearchJob>();

function cleanupSearchJobs() {
  const now = Date.now();
  for (const [jobId, job] of searchJobs.entries()) {
    if (now - new Date(job.startedAt).getTime() > SEARCH_JOB_TTL_MS) {
      searchJobs.delete(jobId);
    }
  }
}

function parseSearchOutput(output: string): NewsItem[] {
  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && (/^\d+\./.test(line) || line.includes('|') || line.includes(' - ')));

  return lines.slice(0, 10).map((line, index) => {
    const cleaned = line.replace(/^\d+\.\s*/, '');
    const segments = cleaned.includes('|')
      ? cleaned.split('|').map((part) => part.trim())
      : cleaned.split(/\s+-\s+/).map((part) => part.trim());

    const urlPattern = /^https?:\/\//i;
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    let title = segments[0] || '';
    let summary = segments[1] || '';
    let source = segments[2] || '';
    let date = segments[3] || '';
    let url = segments[4] || '';

    if (segments.length >= 4 && urlPattern.test(segments[3] || '')) {
      source = segments[2] || '';
      date = '';
      url = segments[3] || '';
    }

    if (segments.length === 3 && datePattern.test(segments[2] || '')) {
      summary = '';
      source = segments[1] || '';
      date = segments[2] || '';
    }

    if (segments.length === 3 && urlPattern.test(segments[2] || '')) {
      summary = segments[1] || '';
      source = new URL(segments[2]).hostname.replace(/^www\./, '');
      date = '';
      url = segments[2] || '';
    }

    if (!source && urlPattern.test(url)) {
      try {
        source = new URL(url).hostname.replace(/^www\./, '');
      } catch {}
    }

    return normalizeNewsItem(
      {
        title,
        summary,
        source,
        date,
        url,
      },
      index,
      'web'
    );
  });
}

export async function searchWithOpenClawAsync(query: string): Promise<string> {
  const jobId = `search-${Date.now()}`;
  const startedAt = new Date().toISOString();
  cleanupSearchJobs();
  searchJobs.set(jobId, { status: 'pending', query, startedAt });

  (async () => {
    try {
      const results = await searchWithOpenClaw(query);
      searchJobs.set(jobId, {
        status: 'done',
        query,
        startedAt,
        finishedAt: new Date().toISOString(),
        results,
      });
    } catch (e: any) {
      searchJobs.set(jobId, {
        status: 'error',
        query,
        startedAt,
        finishedAt: new Date().toISOString(),
        error: e?.message || '搜索失败',
      });
    }
  })();

  return jobId;
}

export function getSearchResult(jobId: string): SearchJob | { status: 'error', error: string } {
  cleanupSearchJobs();
  return searchJobs.get(jobId) || { status: 'error', error: 'job not found' };
}

export async function searchWithOpenClaw(query: string): Promise<NewsItem[]> {
  try {
    const prompt = `搜索互联网获取关于以下主题的最新信息（最新版本、新功能、教程、攻略等）：

主题：${query}

请返回最新10条信息，并满足以下要求：
1. 必须优先搜索 GitHub 之外的网站，至少覆盖 3 个不同站点来源（如官方文档、技术博客、新闻站、教程站、论坛、视频站等）
2. 每条结果格式固定为：标题 | 简介 | 来源网站 | 日期(YYYY-MM-DD) | URL
3. URL 必须是可直接打开的完整 http/https 链接
4. 不要输出 markdown、编号解释、前后说明
5. 如果确实找不到足够的非 GitHub 结果，再补充 GitHub 结果

只返回搜索结果，每条一行，不要其他解释。`;

    const output = await runOpenClawAgentPrompt(prompt, 75000);
    const results = parseSearchOutput(output);
    if (results.length === 0) {
      throw new Error('no results');
    }
    return results;
  } catch (e) {
    console.error('[searchWithOpenClaw] 搜索失败，回退到 GitHub:', e);
    return searchGitHubNews(query);
  }
}
