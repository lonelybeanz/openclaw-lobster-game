import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { spawn } from 'child_process';

const OPENCLAW_DIR = '/Users/moltbot/.openclaw';

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  date: string;
  url?: string;
}

// 从 OpenClaw docs 获取资讯
export async function getOpenClawNews(): Promise<NewsItem[]> {
  const news: NewsItem[] = [];
  
  try {
    // 1. 从 docs 目录获取更新
    const docsDir = join(OPENCLAW_DIR, 'workspace', 'docs');
    try {
      const files = await readdir(docsDir);
      const mdFiles = files.filter(f => f.endsWith('.md')).slice(0, 5);
      
      for (const file of mdFiles) {
        const content = await readFile(join(docsDir, file), 'utf-8');
        const lines = content.split('\n').filter(l => l.startsWith('#'));
        if (lines.length > 0) {
          news.push({
            id: file,
            title: lines[0].replace(/^#+\s*/, '').substring(0, 50),
            summary: content.substring(0, 100) + '...',
            source: 'docs',
            date: new Date().toISOString().split('T')[0]
          });
        }
      }
    } catch {}
    
    // 2. 从 skills 读取更新
    const skillsDir = join(OPENCLAW_DIR, 'skills');
    try {
      const skillFiles = await readdir(skillsDir);
      const recentSkills = skillFiles.filter(f => f.endsWith('.md')).slice(0, 3);
      
      for (const file of recentSkills) {
        const content = await readFile(join(skillsDir, file), 'utf-8');
        const title = content.split('\n').find(l => l.startsWith('# '))?.replace('# ', '') || file;
        news.push({
          id: 'skill-' + file,
          title: '新技能: ' + title.substring(0, 40),
          summary: content.substring(0, 80) + '...',
          source: 'skills',
          date: new Date().toISOString().split('T')[0]
        });
      }
    } catch {}
    
    // 3. 尝试调用 openclaw CLI 获取版本
    try {
      const { execCommand } = await import('./tokenStats');
      const version = await execCommand('openclaw --version');
      news.push({
        id: 'version',
        title: 'OpenClaw 版本信息',
        summary: version.trim(),
        source: 'cli',
        date: new Date().toISOString().split('T')[0]
      });
    } catch {}
    
  } catch (e) {
    console.error('Failed to get news:', e);
  }
  
  // 如果没有资讯，返回默认
  if (news.length === 0) {
    news.push({
      id: 'default-1',
      title: '欢迎使用 OpenClaw 龙虾养成',
      summary: '点击获取最新资讯，了解 OpenClaw 的最新功能和使用技巧。',
      source: 'system',
      date: new Date().toISOString().split('T')[0]
    });
  }
  
  return news;
}

// 通过 OpenClaw 搜索获取资讯
export async function searchOpenClawNews(query: string): Promise<NewsItem[]> {
  // 这里可以调用 OpenClaw 进行搜索
  // 目前返回本地资讯
  return getOpenClawNews();
}
