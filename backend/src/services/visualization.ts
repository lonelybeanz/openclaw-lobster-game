import { readFile } from 'fs/promises';
import { join } from 'path';
import { getMemoryScore } from './memoryScore';
import { analyzeSkills } from './skillsAnalyzer';

type TokenStatsHistoryItem = {
  key?: string;
  tokens?: number;
  model?: string;
  updatedAt?: number | string;
};

type TokenIncrementItem = {
  date?: string;
  added?: number;
};

type TokenStatsFile = {
  totalTokens?: number;
  sessions?: number;
  lastUpdated?: string;
  history?: TokenStatsHistoryItem[];
  increments?: TokenIncrementItem[];
};

export type VisualizationPoint = {
  label: string;
  value: number;
};

export interface VisualizationSnapshot {
  updatedAt: string;
  tokens: {
    summary: {
      totalTokens: number;
      totalSessions: number;
      lastUpdated: string | null;
      avgPerSession: number;
    };
    dailyTrend: VisualizationPoint[];
    weeklyTrend: VisualizationPoint[];
    topSessions: Array<{
      key: string;
      tokens: number;
      model: string;
      updatedAt: string | null;
    }>;
  };
  memory: {
    summary: {
      overallScore: number;
      indexedAgents: number;
      totalAgents: number;
      latestGrowth: number;
    };
    growthTrend: Array<{
      label: string;
      score: number;
      growth: number;
      indexHealth: number;
    }>;
  };
  skills: {
    summary: {
      total: number;
      categoryCount: number;
    };
    distribution: Array<{
      name: string;
      value: number;
    }>;
    topSkills: Array<{
      name: string;
      category: string;
      description: string;
    }>;
  };
}

const TOKEN_STATS_FILE_CANDIDATES = [
  join(process.cwd(), 'data', 'token-stats.json'),
  join(process.cwd(), 'backend', 'data', 'token-stats.json'),
  join(process.cwd(), '..', 'data', 'token-stats.json'),
];

function toDate(value?: string | number | null): Date | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function isoDay(value?: string | number | null): string | null {
  const date = toDate(value);
  if (!date) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function shortDate(value?: string | null): string {
  if (!value) {
    return '--';
  }
  const date = toDate(value);
  if (!date) {
    return value.slice(5, 10);
  }
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfWeek(date: Date): Date {
  const next = new Date(date);
  const day = next.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setUTCDate(next.getUTCDate() + diff);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

function weekLabel(weekStartIso: string): string {
  const date = toDate(weekStartIso);
  if (!date) {
    return weekStartIso;
  }
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${month}-${day}周`;
}

async function readTokenStatsFile(): Promise<TokenStatsFile> {
  for (const filePath of TOKEN_STATS_FILE_CANDIDATES) {
    try {
      const content = await readFile(filePath, 'utf-8');
      return JSON.parse(content) as TokenStatsFile;
    } catch {
      continue;
    }
  }
  return {};
}

function buildDailyTrend(increments: TokenIncrementItem[]): VisualizationPoint[] {
  const byDay = new Map<string, number>();
  for (const item of increments) {
    const day = isoDay(item.date);
    if (!day) {
      continue;
    }
    const added = Math.max(0, Math.round(Number(item.added) || 0));
    byDay.set(day, (byDay.get(day) ?? 0) + added);
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const result: VisualizationPoint[] = [];
  for (let offset = 13; offset >= 0; offset -= 1) {
    const current = new Date(today);
    current.setUTCDate(today.getUTCDate() - offset);
    const day = current.toISOString().slice(0, 10);
    result.push({
      label: shortDate(day),
      value: byDay.get(day) ?? 0,
    });
  }
  return result;
}

function buildWeeklyTrend(increments: TokenIncrementItem[]): VisualizationPoint[] {
  const byWeek = new Map<string, number>();
  for (const item of increments) {
    const date = toDate(item.date);
    if (!date) {
      continue;
    }
    const weekStart = startOfWeek(date).toISOString().slice(0, 10);
    const added = Math.max(0, Math.round(Number(item.added) || 0));
    byWeek.set(weekStart, (byWeek.get(weekStart) ?? 0) + added);
  }

  const currentWeek = startOfWeek(new Date());
  const result: VisualizationPoint[] = [];
  for (let offset = 7; offset >= 0; offset -= 1) {
    const weekStart = new Date(currentWeek);
    weekStart.setUTCDate(currentWeek.getUTCDate() - offset * 7);
    const key = weekStart.toISOString().slice(0, 10);
    result.push({
      label: weekLabel(key),
      value: byWeek.get(key) ?? 0,
    });
  }
  return result;
}

export async function getVisualizationSnapshot(): Promise<VisualizationSnapshot> {
  const [tokenFile, memorySnapshot, skillsStats] = await Promise.all([
    readTokenStatsFile(),
    getMemoryScore(),
    analyzeSkills(),
  ]);

  const history = Array.isArray(tokenFile.history) ? tokenFile.history : [];
  const topSessions = history
    .map((item) => ({
      key: typeof item.key === 'string' && item.key ? item.key : 'unknown',
      tokens: Math.max(0, Math.round(Number(item.tokens) || 0)),
      model: typeof item.model === 'string' && item.model ? item.model : '未知模型',
      updatedAt: toDate(item.updatedAt)?.toISOString() ?? null,
    }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 6);

  // 从 history 聚合每日趋势
  const dailyMap = new Map<string, number>();
  for (const item of history) {
    const date = toDate(item.updatedAt)?.toISOString().slice(0, 10);
    if (date) {
      dailyMap.set(date, (dailyMap.get(date) ?? 0) + Math.max(0, Math.round(Number(item.tokens) || 0)));
    }
  }
  const today = new Date();
  const dailyTrend: VisualizationPoint[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dailyTrend.push({ label: key.slice(5), value: dailyMap.get(key) ?? 0 });
  }

  // 从 history 聚合每周趋势
  const weeklyMap = new Map<string, number>();
  for (const item of history) {
    const date = toDate(item.updatedAt);
    if (date) {
      const weekStart = startOfWeek(date).toISOString().slice(0, 10);
      weeklyMap.set(weekStart, (weeklyMap.get(weekStart) ?? 0) + Math.max(0, Math.round(Number(item.tokens) || 0)));
    }
  }
  const weeklyTrend: VisualizationPoint[] = [];
  const currentWeek = startOfWeek(today);
  for (let offset = 7; offset >= 0; offset -= 1) {
    const weekStart = new Date(currentWeek);
    weekStart.setUTCDate(currentWeek.getUTCDate() - offset * 7);
    const key = weekStart.toISOString().slice(0, 10);
    weeklyTrend.push({ label: weekLabel(key), value: weeklyMap.get(key) ?? 0 });
  }

  const memoryHistory = [...memorySnapshot.history]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14)
    .map((item, index, list) => {
      const previous = list[index - 1];
      return {
        label: shortDate(item.date),
        score: item.score,
        growth: previous ? item.score - previous.score : 0,
        indexHealth: item.indexHealth,
      };
    });

  const skillCategoryMap = new Map<string, number>();
  for (const skill of skillsStats.skills) {
    const key = skill.category || '其他';
    skillCategoryMap.set(key, (skillCategoryMap.get(key) ?? 0) + 1);
  }

  return {
    updatedAt: new Date().toISOString(),
    tokens: {
      summary: {
        totalTokens: Math.max(0, Math.round(Number(tokenFile.totalTokens) || 0)),
        totalSessions: Math.max(0, Math.round(Number(tokenFile.sessions) || 0)),
        lastUpdated: typeof tokenFile.lastUpdated === 'string' && tokenFile.lastUpdated ? tokenFile.lastUpdated : null,
        avgPerSession:
          tokenFile.sessions && Number(tokenFile.sessions) > 0
            ? Math.round((Math.max(0, Math.round(Number(tokenFile.totalTokens) || 0)) / Number(tokenFile.sessions)) * 10) / 10
            : 0,
      },
      dailyTrend,
      weeklyTrend,
      topSessions,
    },
    memory: {
      summary: {
        overallScore: memorySnapshot.overall.score,
        indexedAgents: memorySnapshot.indexedAgents,
        totalAgents: memorySnapshot.totalAgents,
        latestGrowth: memoryHistory[memoryHistory.length - 1]?.growth ?? 0,
      },
      growthTrend: memoryHistory,
    },
    skills: {
      summary: {
        total: skillsStats.total,
        categoryCount: skillCategoryMap.size,
      },
      distribution: [...skillCategoryMap.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
      topSkills: skillsStats.skills.slice(0, 8).map((skill) => ({
        name: skill.name,
        category: skill.category,
        description: skill.description,
      })),
    },
  };
}
