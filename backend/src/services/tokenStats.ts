import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { join } from 'path';

const DATA_DIR = join(__dirname, '..', '..', 'data');
const STATS_FILE = join(DATA_DIR, 'token-stats.json');
const OPENCLAW_DIR = '/Users/moltbot/.openclaw';

interface TokenStatsHistoryItem {
  key: string;
  tokens: number;
  model: string;
  updatedAt: number;
}

interface TokenStatsFile {
  totalTokens: number;
  sessions: number;
  lastUpdated: string;
  history: TokenStatsHistoryItem[];
  increments?: Array<{ date: string; added: number }>;
}

// 直接从文件读取所有 agent 的会话数据
async function readSessionsFromFiles(): Promise<Array<{ key: string; tokens: number; model: string; updatedAt: number }>> {
  try {
    const agentsDir = join(OPENCLAW_DIR, 'agents');
    const agentDirs = await readdir(agentsDir, { withFileTypes: true });
    
    const sessions: Array<{ key: string; tokens: number; model: string; updatedAt: number }> = [];
    
    for (const agentDir of agentDirs) {
      if (!agentDir.isDirectory()) continue;
      
      const sessionsFile = join(agentsDir, agentDir.name, 'sessions', 'sessions.json');
      try {
        const content = await readFile(sessionsFile, 'utf-8');
        const data = JSON.parse(content);
        
        for (const [key, session] of Object.entries(data)) {
          const s = session as any;
          sessions.push({
            key,
            tokens: s.totalTokens || s.tokenUsage?.total || s.tokens?.total || 0,
            model: s.model || 'unknown',
            updatedAt: s.updatedAt || Date.now(),
          });
        }
      } catch {
        // 文件不存在或解析失败，跳过
      }
    }
    
    return sessions;
  } catch {
    return [];
  }
}

async function readStatsFile(): Promise<TokenStatsFile> {
  try {
    const content = await readFile(STATS_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    return {
      totalTokens: Number(parsed.totalTokens) || 0,
      sessions: Number(parsed.sessions) || 0,
      lastUpdated: typeof parsed.lastUpdated === 'string' ? parsed.lastUpdated : '',
      history: Array.isArray(parsed.history) ? parsed.history : [],
      increments: Array.isArray(parsed.increments) ? parsed.increments : [],
    };
  } catch {
    return {
      totalTokens: 0,
      sessions: 0,
      lastUpdated: '',
      history: [],
      increments: [],
    };
  }
}

// 初始化：抓取所有历史 tokens
export async function initTokenStats(): Promise<{ totalTokens: number; sessions: number; lastUpdated: string }> {
  try {
    // 确保 data 目录存在
    await mkdir(DATA_DIR, { recursive: true });
    
    const sessions = await readSessionsFromFiles();
    const totalTokens = sessions.reduce((sum, s) => sum + (s.tokens || 0), 0);
    
    const stats = {
      totalTokens,
      sessions: sessions.length,
      lastUpdated: new Date().toISOString(),
      history: sessions.map((s) => ({
        key: s.key,
        tokens: s.tokens || 0,
        model: s.model,
        updatedAt: s.updatedAt
      }))
    };
    
    await writeFile(STATS_FILE, JSON.stringify(stats, null, 2));
    
    return { totalTokens, sessions: sessions.length, lastUpdated: stats.lastUpdated };
  } catch (e) {
    console.error('Failed to init token stats:', e);
    throw e;
  }
}

// 增量更新：只获取新增的 tokens
export async function updateTokenStats(tokens?: number): Promise<{ addedTokens: number; totalTokens: number }> {
  if (typeof tokens === 'number' && Number.isFinite(tokens)) {
    await mkdir(DATA_DIR, { recursive: true });
    const oldStats = await readStatsFile();
    const addedTokens = Math.max(0, Math.floor(tokens));
    const totalTokens = oldStats.totalTokens + addedTokens;
    const lastUpdated = new Date().toISOString();
    const newStats: TokenStatsFile = {
      ...oldStats,
      totalTokens,
      lastUpdated,
      increments: [...(oldStats.increments || []), { date: lastUpdated, added: addedTokens }],
    };
    await writeFile(STATS_FILE, JSON.stringify(newStats, null, 2));
    return { addedTokens, totalTokens };
  }

  try {
    const oldStats = await readStatsFile();
    
    const sessions = await readSessionsFromFiles();
    const currentTotal = sessions.reduce((sum, s) => sum + (s.tokens || 0), 0);
    
    const addedTokens = currentTotal - oldStats.totalTokens;
    
    const newStats = {
      totalTokens: currentTotal,
      sessions: sessions.length,
      lastUpdated: new Date().toISOString(),
      history: sessions.map((s) => ({
        key: s.key,
        tokens: s.tokens || 0,
        model: s.model,
        updatedAt: s.updatedAt
      })),
      // 增量记录
      increments: [
        ...(oldStats.increments || []),
        { date: new Date().toISOString(), added: addedTokens }
      ]
    };
    
    await writeFile(STATS_FILE, JSON.stringify(newStats, null, 2));
    
    return { addedTokens, totalTokens: currentTotal };
  } catch (e) {
    console.error('Failed to update token stats:', e);
    throw e;
  }
}

// 获取当前统计
export async function getTokenStats(): Promise<{ totalTokens: number; sessions: number; lastUpdated: string }> {
  try {
    const stats = await readStatsFile();
    return {
      totalTokens: stats.totalTokens,
      sessions: stats.sessions,
      lastUpdated: stats.lastUpdated,
    };
  } catch {
    return { totalTokens: 0, sessions: 0, lastUpdated: '' };
  }
}
