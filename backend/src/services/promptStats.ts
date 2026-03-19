import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const OPENCLAW_DIR = '/Users/moltbot/.openclaw';

export interface OpenClawPromptStats {
  tokens: number;
  memoryFiles: number;
  skills: number;
  hooks: number;
  sessions: number;
  updatedAt: string;
}

// 直接从文件读取所有 agent 的会话数据
async function getTokenAndSessionStats(): Promise<{ tokens: number; sessions: number }> {
  try {
    const agentsDir = join(OPENCLAW_DIR, 'agents');
    const agentDirs = await readdir(agentsDir, { withFileTypes: true });
    
    let tokens = 0;
    let sessions = 0;
    
    for (const agentDir of agentDirs) {
      if (!agentDir.isDirectory()) continue;
      
      const sessionsFile = join(agentsDir, agentDir.name, 'sessions', 'sessions.json');
      try {
        const content = await readFile(sessionsFile, 'utf-8');
        const data = JSON.parse(content);
        
        for (const session of Object.values(data)) {
          const s = session as any;
          tokens += s.tokenUsage?.total || s.tokens?.total || 0;
          sessions++;
        }
      } catch {
        // 文件不存在或解析失败，跳过
      }
    }
    
    return { tokens, sessions };
  } catch {
    return { tokens: 0, sessions: 0 };
  }
}

async function countItemsInDir(dir: string, recursive = false): Promise<number> {
  try {
    const items = await readdir(dir, { recursive });
    return items.filter((item) => {
      if (typeof item !== 'string') return false;
      const name = item.split('/').pop() || item;
      return !name.startsWith('.') && name !== 'README.md';
    }).length;
  } catch {
    return 0;
  }
}

export async function getPromptStats(): Promise<OpenClawPromptStats> {
  const [tokenStats, memoryFiles, skills, hooks] = await Promise.all([
    getTokenAndSessionStats(),
    countItemsInDir(join(OPENCLAW_DIR, 'workspace', 'memory'), true),
    countItemsInDir(join(OPENCLAW_DIR, 'skills')),
    countItemsInDir(join(OPENCLAW_DIR, 'hooks')),
  ]);

  return {
    tokens: tokenStats.tokens,
    memoryFiles,
    skills,
    hooks,
    sessions: tokenStats.sessions,
    updatedAt: new Date().toISOString(),
  };
}
