import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { spawn } from 'child_process';

const DATA_DIR = join(__dirname, '..', '..', 'data');
const STATS_FILE = join(DATA_DIR, 'token-stats.json');

// 执行 CLI 命令
function execCommand(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', ['-c', cmd], { 
      cwd: '/Users/moltbot',
      env: { ...process.env, PATH: '/opt/homebrew/bin:/usr/local/bin:' + process.env.PATH }
    });
    let output = '';
    child.stdout.on('data', (data) => output += data);
    child.stderr.on('data', (data) => output += data);
    child.on('close', (code) => resolve(output));
    child.on('error', reject);
  });
}

// 初始化：抓取所有历史 tokens
export async function initTokenStats(): Promise<{ totalTokens: number; sessions: number; lastUpdated: string }> {
  try {
    // 确保 data 目录存在
    await mkdir(DATA_DIR, { recursive: true });
    
    const output = await execCommand('openclaw sessions --all-agents --json 2>/dev/null');
    const data = JSON.parse(output);
    
    const sessions = data.sessions || [];
    const totalTokens = sessions.reduce((sum: number, s: any) => sum + (s.totalTokens || 0), 0);
    
    const stats = {
      totalTokens,
      sessions: sessions.length,
      lastUpdated: new Date().toISOString(),
      history: sessions.map((s: any) => ({
        key: s.key,
        tokens: s.totalTokens || 0,
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
export async function updateTokenStats(): Promise<{ addedTokens: number; totalTokens: number }> {
  try {
    let oldStats = { totalTokens: 0, sessions: 0, lastUpdated: '', history: [] as any[] };
    
    try {
      const content = await readFile(STATS_FILE, 'utf-8');
      oldStats = JSON.parse(content);
    } catch {
      // 文件不存在，初始化
    }
    
    const output = await execCommand('openclaw sessions --all-agents --json 2>/dev/null');
    const data = JSON.parse(output);
    
    const sessions = data.sessions || [];
    const currentTotal = sessions.reduce((sum: number, s: any) => sum + (s.totalTokens || 0), 0);
    
    const addedTokens = currentTotal - oldStats.totalTokens;
    
    const newStats = {
      totalTokens: currentTotal,
      sessions: sessions.length,
      lastUpdated: new Date().toISOString(),
      history: sessions.map((s: any) => ({
        key: s.key,
        tokens: s.totalTokens || 0,
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
    const content = await readFile(STATS_FILE, 'utf-8');
    const stats = JSON.parse(content);
    return {
      totalTokens: stats.totalTokens,
      sessions: stats.sessions,
      lastUpdated: stats.lastUpdated
    };
  } catch {
    // 如果没有初始数据，先初始化
    return initTokenStats();
  }
}
