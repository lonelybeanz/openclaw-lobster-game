import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const DATA_DIR = '/Users/moltbot/.openclaw/workspace/projects/openclaw-lobster-game/data';
const GROWTH_FILE = join(DATA_DIR, 'growth-history.json');

export interface GrowthRecord {
  date: string;
  tokens: number;
  sessions: number;
  messages: number;
  level: number;
  experience: number;
}

// 记录每日成长数据
export async function recordGrowth(data: {
  tokens: number;
  sessions: number;
  messages: number;
  level: number;
  experience: number;
}): Promise<void> {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    
    let history: GrowthRecord[] = [];
    try {
      const content = await readFile(GROWTH_FILE, 'utf-8');
      history = JSON.parse(content);
    } catch {}
    
    const today = new Date().toISOString().split('T')[0];
    const existingIndex = history.findIndex(r => r.date === today);
    
    const record: GrowthRecord = {
      date: today,
      ...data
    };
    
    if (existingIndex >= 0) {
      history[existingIndex] = record;
    } else {
      history.push(record);
    }
    
    // 只保留最近 30 天
    history = history.slice(-30);
    
    await writeFile(GROWTH_FILE, JSON.stringify(history, null, 2));
  } catch (e) {
    console.error('记录成长数据失败:', e);
  }
}

// 获取成长历史
export async function getGrowthHistory(): Promise<GrowthRecord[]> {
  try {
    const content = await readFile(GROWTH_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

// 获取统计数据
export async function getGrowthStats(): Promise<{
  totalDays: number;
  avgTokensPerDay: number;
  avgSessionsPerDay: number;
  levelTrend: number;
  totalExperience: number;
}> {
  const history = await getGrowthHistory();
  
  if (history.length === 0) {
    return {
      totalDays: 0,
      avgTokensPerDay: 0,
      avgSessionsPerDay: 0,
      levelTrend: 0,
      totalExperience: 0
    };
  }
  
  const totalTokens = history.reduce((sum, r) => sum + r.tokens, 0);
  const totalSessions = history.reduce((sum, r) => sum + r.sessions, 0);
  const totalExperience = history.reduce((sum, r) => sum + r.experience, 0);
  
  // 计算等级趋势
  let levelTrend = 0;
  if (history.length >= 2) {
    levelTrend = history[history.length - 1].level - history[0].level;
  }
  
  return {
    totalDays: history.length,
    avgTokensPerDay: Math.round(totalTokens / history.length),
    avgSessionsPerDay: Math.round(totalSessions / history.length * 10) / 10,
    levelTrend,
    totalExperience
  };
}
