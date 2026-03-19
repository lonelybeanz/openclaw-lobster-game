import { mkdir, readFile, readdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { loadLobsterState, type LobsterState } from './persistence';
import { runOpenClawAgentPrompt } from './openclaw';

export type ReportPeriod = 'weekly' | 'monthly';

export interface HealthRecord {
  date: string;
  score: number;
  source: 'memory-score' | 'estimated';
}

export interface AchievementUnlock {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: string;
}

export interface GrowthReport {
  period: ReportPeriod;
  dateRange: {
    start: string;
    end: string;
  };
  generatedAt: string;
  summary: {
    totalInteractions: number;
    newAchievements: number;
    levelUps: number;
    averageHealth: number;
    averageMood: number;
  };
  comparison: {
    interactionsDelta: number;
    achievementsDelta: number;
    healthTrend: 'up' | 'down' | 'stable';
    moodTrend: 'up' | 'down' | 'stable';
  };
  details: {
    dailyInteractions: Array<{ date: string; count: number }>;
    healthRecords: HealthRecord[];
    unlockedAchievements: AchievementUnlock[];
  };
  insights: string[];
  suggestions: string[];
}

type GrowthRecord = {
  date: string;
  tokens: number;
  sessions: number;
  messages: number;
  level: number;
  experience: number;
};

type MemoryScoreHistoryItem = {
  date: string;
  score: number;
  l1: number;
  l2: number;
  l3: number;
  indexHealth: number;
};

type DailySeriesItem = {
  date: string;
  count: number;
  level: number | null;
};

type ReportComputationContext = {
  state: LobsterState;
  memoryHistory: MemoryScoreHistoryItem[];
  interactionsSeries: DailySeriesItem[];
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BACKEND_ROOT = join(__dirname, '..', '..');
const PROJECT_ROOT = join(BACKEND_ROOT, '..');
const REPORTS_ROOT = join(BACKEND_ROOT, 'runtime', 'reports');

const DATA_DIR_CANDIDATES = [
  process.env.LOBSTER_GAME_DATA_DIR,
  join(PROJECT_ROOT, 'data'),
  '/Users/moltbot/.openclaw/workspace/projects/openclaw-lobster-game/data',
  '/Users/moltbot/.openclaw/workspace-dev/projects/openclaw-lobster-game/data',
].filter((value): value is string => Boolean(value));

const ACHIEVEMENT_DEFINITIONS = [
  { id: 'first_feed', name: '第一次投喂', description: '完成首次投喂互动', icon: '🍤', threshold: 1, type: 'interactions' as const },
  { id: 'first_train', name: '第一次训练', description: '完成首次训练互动', icon: '💪', threshold: 1, type: 'interactions' as const },
  { id: 'first_rest', name: '第一次休息', description: '完成首次休息互动', icon: '😴', threshold: 1, type: 'interactions' as const },
  { id: 'interact_10', name: '互动 10 次', description: '累计互动达到 10 次', icon: '👋', threshold: 10, type: 'interactions' as const },
  { id: 'interact_50', name: '互动 50 次', description: '累计互动达到 50 次', icon: '🤝', threshold: 50, type: 'interactions' as const },
  { id: 'interact_100', name: '互动 100 次', description: '累计互动达到 100 次', icon: '💎', threshold: 100, type: 'interactions' as const },
  { id: 'level_5', name: '达到 Lv.5', description: '等级提升到 5', icon: '⭐', threshold: 5, type: 'level' as const },
  { id: 'level_10', name: '达到 Lv.10', description: '等级提升到 10', icon: '🌟', threshold: 10, type: 'level' as const },
  { id: 'loyalty_100', name: '忠诚度满值', description: '忠诚度达到 100', icon: '❤️', threshold: 100, type: 'loyalty' as const },
];

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function startOfIsoWeek(date: Date) {
  const weekday = (date.getUTCDay() + 6) % 7;
  return addDays(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())), -weekday);
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDate(value?: string | null) {
  if (!value) {
    return null;
  }
  const normalized = value.length > 10 ? value : `${value}T00:00:00.000Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDefaultAnchorDate(period: ReportPeriod) {
  const today = new Date();
  if (period === 'weekly') {
    return addDays(startOfIsoWeek(today), -1);
  }
  return addDays(startOfMonth(today), -1);
}

function getPeriodRange(period: ReportPeriod, anchorInput?: string | Date) {
  const anchor = anchorInput instanceof Date ? anchorInput : parseDate(anchorInput) ?? getDefaultAnchorDate(period);

  if (period === 'weekly') {
    const start = startOfIsoWeek(anchor);
    const end = addDays(start, 6);
    return { start, end };
  }

  const start = startOfMonth(anchor);
  const end = endOfMonth(anchor);
  return { start, end };
}

function getPreviousRange(period: ReportPeriod, start: Date) {
  if (period === 'weekly') {
    const previousStart = addDays(start, -7);
    return { start: previousStart, end: addDays(previousStart, 6) };
  }

  const previousMonthEnd = addDays(start, -1);
  return {
    start: startOfMonth(previousMonthEnd),
    end: endOfMonth(previousMonthEnd),
  };
}

function getPeriodKey(period: ReportPeriod, dateRange: { start: Date; end: Date }) {
  if (period === 'monthly') {
    return dateRange.start.toISOString().slice(0, 7);
  }

  const target = addDays(dateRange.start, 3);
  const year = target.getUTCFullYear();
  const weekOne = startOfIsoWeek(new Date(Date.UTC(year, 0, 4)));
  const diffDays = Math.round((dateRange.start.getTime() - weekOne.getTime()) / 86400000);
  const week = Math.floor(diffDays / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

async function readJsonFromCandidates<T>(fileName: string, fallback: T): Promise<T> {
  for (const dir of DATA_DIR_CANDIDATES) {
    try {
      const content = await readFile(join(dir, fileName), 'utf-8');
      return JSON.parse(content) as T;
    } catch {}
  }
  return fallback;
}

function enumerateDates(start: Date, end: Date) {
  const dates: string[] = [];
  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    dates.push(toDateString(cursor));
  }
  return dates;
}

function buildEstimatedInteractionSeries(state: LobsterState, endDate: string) {
  const firstMeet = parseDate(state.firstMeet) ?? parseDate(state.lastInteraction) ?? new Date();
  const end = parseDate(endDate) ?? new Date();
  const start = new Date(Date.UTC(firstMeet.getUTCFullYear(), firstMeet.getUTCMonth(), firstMeet.getUTCDate()));
  const allDates = enumerateDates(start, end);

  if (allDates.length === 0 || state.totalInteractions <= 0) {
    return [] as DailySeriesItem[];
  }

  const quotient = Math.floor(state.totalInteractions / allDates.length);
  const remainder = state.totalInteractions % allDates.length;

  return allDates.map((date, index) => ({
    date,
    count: quotient + (index < remainder ? 1 : 0),
    level: null,
  }));
}

function buildInteractionSeries(growthHistory: GrowthRecord[], state: LobsterState, endDate: string) {
  if (growthHistory.length === 0) {
    return buildEstimatedInteractionSeries(state, endDate);
  }

  return growthHistory
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((record) => ({
      date: record.date,
      count: Math.max(0, record.messages || record.sessions || 0),
      level: Number.isFinite(record.level) ? record.level : null,
    }));
}

function pickRange<T extends { date: string }>(items: T[], start: string, end: string) {
  return items.filter((item) => item.date >= start && item.date <= end);
}

function estimateMood(healthScore: number, interactionCount: number, peakInteractions: number, fallbackMood: number) {
  const activityScore = peakInteractions > 0 ? Math.round((interactionCount / peakInteractions) * 100) : fallbackMood;
  return clamp(Math.round((healthScore * 0.55) + (activityScore * 0.25) + (fallbackMood * 0.2)));
}

function deriveHealthRecords(
  rangeDates: string[],
  memoryHistory: MemoryScoreHistoryItem[],
  state: LobsterState,
): HealthRecord[] {
  const memoryMap = new Map(memoryHistory.map((item) => [item.date, item]));
  const estimatedBase = clamp(Math.round((state.hunger * 0.3) + (state.mood * 0.35) + ((100 - state.fatigue) * 0.2) + (state.loyalty * 0.15)));

  return rangeDates.map((date) => {
    const snapshot = memoryMap.get(date);
    if (snapshot) {
      return {
        date,
        score: clamp(snapshot.indexHealth || snapshot.score || estimatedBase),
        source: 'memory-score' as const,
      };
    }

    return {
      date,
      score: estimatedBase,
      source: 'estimated' as const,
    };
  });
}

function summarizePeriod(
  periodItems: DailySeriesItem[],
  dateRange: { start: string; end: string },
  state: LobsterState,
  memoryHistory: MemoryScoreHistoryItem[],
) {
  const rangeDates = enumerateDates(parseDate(dateRange.start) ?? new Date(), parseDate(dateRange.end) ?? new Date());
  const periodMap = new Map(periodItems.map((item) => [item.date, item]));
  const dailyInteractions = rangeDates.map((date) => ({
    date,
    count: periodMap.get(date)?.count ?? 0,
  }));
  const healthRecords = deriveHealthRecords(rangeDates, memoryHistory, state);
  const peakInteractions = Math.max(...dailyInteractions.map((item) => item.count), 0);
  const moodSeries = healthRecords.map((item) => estimateMood(item.score, periodMap.get(item.date)?.count ?? 0, peakInteractions, state.mood));

  let levelUps = 0;
  const sortedLevels = periodItems
    .filter((item) => item.level !== null)
    .map((item) => item.level as number);
  for (let index = 1; index < sortedLevels.length; index += 1) {
    const currentLevel = sortedLevels[index];
    const previousLevel = sortedLevels[index - 1];
    if (currentLevel !== undefined && previousLevel !== undefined && currentLevel > previousLevel) {
      levelUps += currentLevel - previousLevel;
    }
  }

  return {
    dailyInteractions,
    healthRecords,
    averageHealth: average(healthRecords.map((item) => item.score)),
    averageMood: average(moodSeries),
    totalInteractions: dailyInteractions.reduce((sum, item) => sum + item.count, 0),
    levelUps,
  };
}

function getAchievementUnlocks(
  series: DailySeriesItem[],
  range: { start: string; end: string },
  state: LobsterState,
) {
  const sorted = series.slice().sort((left, right) => left.date.localeCompare(right.date));
  const rangeStart = range.start;
  const rangeEnd = range.end;

  let cumulativeInteractions = 0;
  const interactionByDate = new Map<string, number>();
  for (const item of sorted) {
    cumulativeInteractions += item.count;
    interactionByDate.set(item.date, cumulativeInteractions);
  }

  const previousInteractions = sorted
    .filter((item) => item.date < rangeStart)
    .reduce((sum, item) => sum + item.count, 0);
  const currentInteractions = sorted
    .filter((item) => item.date <= rangeEnd)
    .reduce((sum, item) => sum + item.count, 0);

  const previousLevel = sorted
    .filter((item) => item.date < rangeStart && item.level !== null)
    .map((item) => item.level as number)
    .pop() ?? 1;
  const currentLevel = sorted
    .filter((item) => item.date <= rangeEnd && item.level !== null)
    .map((item) => item.level as number)
    .pop() ?? state.level;

  const unlocks: AchievementUnlock[] = [];

  for (const definition of ACHIEVEMENT_DEFINITIONS) {
    if (definition.type === 'interactions') {
      if (currentInteractions < definition.threshold || previousInteractions >= definition.threshold) {
        continue;
      }
      const unlockedAt = sorted.find((item) => (interactionByDate.get(item.date) ?? 0) >= definition.threshold && item.date >= rangeStart && item.date <= rangeEnd)?.date ?? rangeEnd;
      unlocks.push({
        id: definition.id,
        name: definition.name,
        description: definition.description,
        icon: definition.icon,
        unlockedAt,
      });
      continue;
    }

    if (definition.type === 'level') {
      if (currentLevel < definition.threshold || previousLevel >= definition.threshold) {
        continue;
      }
      const unlockedAt = sorted.find((item) => (item.level ?? 0) >= definition.threshold && item.date >= rangeStart && item.date <= rangeEnd)?.date ?? rangeEnd;
      unlocks.push({
        id: definition.id,
        name: definition.name,
        description: definition.description,
        icon: definition.icon,
        unlockedAt,
      });
      continue;
    }

    if (definition.type === 'loyalty' && state.loyalty >= definition.threshold) {
      const interactionDate = parseDate(state.lastInteraction);
      const inRange = interactionDate && toDateString(interactionDate) >= rangeStart && toDateString(interactionDate) <= rangeEnd;
      if (inRange) {
        unlocks.push({
          id: definition.id,
          name: definition.name,
          description: definition.description,
          icon: definition.icon,
          unlockedAt: toDateString(interactionDate),
        });
      }
    }
  }

  return unlocks.sort((left, right) => left.unlockedAt.localeCompare(right.unlockedAt));
}

function getTrend(current: number, previous: number): 'up' | 'down' | 'stable' {
  const delta = current - previous;
  if (Math.abs(delta) <= 1) {
    return 'stable';
  }
  return delta > 0 ? 'up' : 'down';
}

function getDeltaPercent(current: number, previous: number) {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100);
}

function formatChineseDate(dateString: string) {
  const date = parseDate(dateString) ?? new Date();
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
}

function formatGeneratedAt(value: string) {
  return formatChineseDate(value.slice(0, 10));
}

function formatDelta(value: number, unit = '%') {
  if (value === 0) {
    return `0${unit}`;
  }
  return `${value > 0 ? '+' : ''}${value}${unit}`;
}

function trendArrow(value: 'up' | 'down' | 'stable') {
  if (value === 'up') return '↑';
  if (value === 'down') return '↓';
  return '→';
}

async function generateNarrative(report: GrowthReport) {
  const baselineInsights: string[] = [];
  const baselineSuggestions: string[] = [];

  if (report.summary.totalInteractions >= 20) {
    baselineInsights.push('本周期互动密度较高，养成节奏稳定，说明用户有持续陪伴行为。');
  } else {
    baselineInsights.push('本周期互动偏少，成长推进更多依赖存量状态，活跃度还有提升空间。');
  }

  if (report.comparison.healthTrend === 'up') {
    baselineInsights.push('健康度呈上升趋势，记忆索引和陪伴状态整体趋于稳定。');
  } else if (report.comparison.healthTrend === 'down') {
    baselineInsights.push('健康度较上周期回落，建议关注记忆质量和互动节奏。');
  } else {
    baselineInsights.push('健康度基本稳定，当前养成状态没有明显波动。');
  }

  if (report.summary.newAchievements > 0) {
    baselineInsights.push(`本周期新增 ${report.summary.newAchievements} 个成长节点，说明关键阈值正在被持续突破。`);
  }

  if (report.summary.averageMood < 70) {
    baselineSuggestions.push('建议增加连续互动频次，优先补足低活跃日，避免情绪值长期停留在中位区间。');
  } else {
    baselineSuggestions.push('维持当前互动节奏即可，重点关注高质量对话和阶段性训练，提升成长稳定性。');
  }

  if (report.comparison.interactionsDelta < 0) {
    baselineSuggestions.push('和上一周期相比互动下降，建议补一个固定触发器，例如每晚自动提醒进行一次互动。');
  }

  if (report.summary.levelUps === 0) {
    baselineSuggestions.push('本周期没有明显升级，建议围绕高收益动作集中投入，拉高经验获取效率。');
  } else {
    baselineSuggestions.push('已有升级突破，可以在下个周期围绕新等级设计更高阶的任务和成就。');
  }

  if (process.env.REPORT_GENERATOR_USE_OPENCLAW !== 'true') {
    return {
      insights: baselineInsights.slice(0, 3),
      suggestions: baselineSuggestions.slice(0, 3),
    };
  }

  try {
    const prompt = `你是成长报告分析助手。请基于以下 JSON 输出 3 条 insights 和 3 条 suggestions，语气专业、简洁，返回 JSON：
${JSON.stringify({
  period: report.period,
  summary: report.summary,
  comparison: report.comparison,
  achievements: report.details.unlockedAchievements.map((item) => item.name),
}, null, 2)}`;
    const response = await runOpenClawAgentPrompt(prompt, 45000);
    const match = response.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('no json payload');
    }
    const parsed = JSON.parse(match[0]) as { insights?: string[]; suggestions?: string[] };
    return {
      insights: Array.isArray(parsed.insights) && parsed.insights.length > 0 ? parsed.insights.slice(0, 3) : baselineInsights.slice(0, 3),
      suggestions: Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0 ? parsed.suggestions.slice(0, 3) : baselineSuggestions.slice(0, 3),
    };
  } catch {
    return {
      insights: baselineInsights.slice(0, 3),
      suggestions: baselineSuggestions.slice(0, 3),
    };
  }
}

async function loadContext(anchorInput?: string | Date): Promise<ReportComputationContext> {
  const [state, growthHistory, memoryHistory] = await Promise.all([
    loadLobsterState(),
    readJsonFromCandidates<GrowthRecord[]>('growth-history.json', []),
    readJsonFromCandidates<MemoryScoreHistoryItem[]>('memory-score-history.json', []),
  ]);

  const anchor = anchorInput instanceof Date ? toDateString(anchorInput) : (anchorInput ?? toDateString(new Date()));
  return {
    state,
    memoryHistory,
    interactionsSeries: buildInteractionSeries(growthHistory, state, anchor),
  };
}

async function writeReportFiles(period: ReportPeriod, key: string, report: GrowthReport) {
  const periodDir = join(REPORTS_ROOT, period);
  await mkdir(periodDir, { recursive: true });

  const markdown = renderMarkdown(report);
  const html = renderHTML(report);
  const json = JSON.stringify(report, null, 2);

  await Promise.all([
    writeFile(join(periodDir, `${key}.md`), markdown),
    writeFile(join(periodDir, `${key}.html`), html),
    writeFile(join(periodDir, `${key}.json`), json),
  ]);

  return {
    markdownPath: join(periodDir, `${key}.md`),
    htmlPath: join(periodDir, `${key}.html`),
    jsonPath: join(periodDir, `${key}.json`),
  };
}

async function generateReport(period: ReportPeriod, anchorInput?: string | Date): Promise<GrowthReport> {
  const context = await loadContext(anchorInput);
  const currentRange = getPeriodRange(period, anchorInput);
  const previousRange = getPreviousRange(period, currentRange.start);

  const currentDateRange = {
    start: toDateString(currentRange.start),
    end: toDateString(currentRange.end),
  };
  const previousDateRange = {
    start: toDateString(previousRange.start),
    end: toDateString(previousRange.end),
  };

  const currentItems = pickRange(context.interactionsSeries, currentDateRange.start, currentDateRange.end);
  const previousItems = pickRange(context.interactionsSeries, previousDateRange.start, previousDateRange.end);

  const currentSummary = summarizePeriod(currentItems, currentDateRange, context.state, context.memoryHistory);
  const previousSummary = summarizePeriod(previousItems, previousDateRange, context.state, context.memoryHistory);
  const unlockedAchievements = getAchievementUnlocks(context.interactionsSeries, currentDateRange, context.state);
  const narrative = await generateNarrative({
    period,
    dateRange: currentDateRange,
    generatedAt: new Date().toISOString(),
    summary: {
      totalInteractions: currentSummary.totalInteractions,
      newAchievements: unlockedAchievements.length,
      levelUps: currentSummary.levelUps,
      averageHealth: currentSummary.averageHealth,
      averageMood: currentSummary.averageMood,
    },
    comparison: {
      interactionsDelta: getDeltaPercent(currentSummary.totalInteractions, previousSummary.totalInteractions),
      achievementsDelta: unlockedAchievements.length - getAchievementUnlocks(context.interactionsSeries, previousDateRange, context.state).length,
      healthTrend: getTrend(currentSummary.averageHealth, previousSummary.averageHealth),
      moodTrend: getTrend(currentSummary.averageMood, previousSummary.averageMood),
    },
    details: {
      dailyInteractions: currentSummary.dailyInteractions,
      healthRecords: currentSummary.healthRecords,
      unlockedAchievements,
    },
    insights: [],
    suggestions: [],
  });

  const report: GrowthReport = {
    period,
    dateRange: currentDateRange,
    generatedAt: new Date().toISOString(),
    summary: {
      totalInteractions: currentSummary.totalInteractions,
      newAchievements: unlockedAchievements.length,
      levelUps: currentSummary.levelUps,
      averageHealth: currentSummary.averageHealth,
      averageMood: currentSummary.averageMood,
    },
    comparison: {
      interactionsDelta: getDeltaPercent(currentSummary.totalInteractions, previousSummary.totalInteractions),
      achievementsDelta: unlockedAchievements.length - getAchievementUnlocks(context.interactionsSeries, previousDateRange, context.state).length,
      healthTrend: getTrend(currentSummary.averageHealth, previousSummary.averageHealth),
      moodTrend: getTrend(currentSummary.averageMood, previousSummary.averageMood),
    },
    details: {
      dailyInteractions: currentSummary.dailyInteractions,
      healthRecords: currentSummary.healthRecords,
      unlockedAchievements,
    },
    insights: narrative.insights,
    suggestions: narrative.suggestions,
  };

  const key = getPeriodKey(period, currentRange);
  await writeReportFiles(period, key, report);
  return report;
}

export async function generateWeeklyReport(date?: string | Date) {
  return generateReport('weekly', date);
}

export async function generateMonthlyReport(date?: string | Date) {
  return generateReport('monthly', date);
}

export async function getReport(period: ReportPeriod, date: string): Promise<GrowthReport | null> {
  const range = getPeriodRange(period, date);
  const key = getPeriodKey(period, range);
  const reportPath = join(REPORTS_ROOT, period, `${key}.json`);

  try {
    const content = await readFile(reportPath, 'utf-8');
    return JSON.parse(content) as GrowthReport;
  } catch {
    return null;
  }
}

export async function listReports(): Promise<Array<{ period: ReportPeriod; date: string; path: string }>> {
  const periods: ReportPeriod[] = ['weekly', 'monthly'];
  const reports: Array<{ period: ReportPeriod; date: string; path: string }> = [];

  for (const period of periods) {
    const directory = join(REPORTS_ROOT, period);
    try {
      const files = await readdir(directory);
      for (const file of files.filter((item) => item.endsWith('.json')).sort()) {
        reports.push({
          period,
          date: file.replace(/\.json$/, ''),
          path: join(directory, file),
        });
      }
    } catch {}
  }

  return reports.sort((left, right) => right.date.localeCompare(left.date));
}

export function renderMarkdown(report: GrowthReport) {
  const title = report.period === 'weekly' ? '🦞 小龙虾成长周报' : '🦞 小龙虾成长月报';
  const previousLabel = report.period === 'weekly' ? '上周' : '上月';
  const interactionDelta = `${formatDelta(report.comparison.interactionsDelta)} ${trendArrow(report.comparison.interactionsDelta >= 1 ? 'up' : report.comparison.interactionsDelta <= -1 ? 'down' : 'stable')}`;
  const achievementDelta = `${report.comparison.achievementsDelta > 0 ? '+' : ''}${report.comparison.achievementsDelta} ${trendArrow(report.comparison.achievementsDelta > 0 ? 'up' : report.comparison.achievementsDelta < 0 ? 'down' : 'stable')}`;

  return `# ${title}

**报告周期**: ${formatChineseDate(report.dateRange.start)} - ${formatChineseDate(report.dateRange.end)}  
**生成时间**: ${formatGeneratedAt(report.generatedAt)}

## 📊 数据概览

| 指标 | 本${report.period === 'weekly' ? '周' : '月'} | ${previousLabel} | 变化 |
|------|------|------|------|
| 总互动 | ${report.summary.totalInteractions}次 | ${Math.max(0, report.summary.totalInteractions - Math.round((report.summary.totalInteractions * report.comparison.interactionsDelta) / 100))}次 | ${interactionDelta} |
| 新成就 | ${report.summary.newAchievements}个 | ${Math.max(0, report.summary.newAchievements - report.comparison.achievementsDelta)}个 | ${achievementDelta} |
| 平均健康 | ${report.summary.averageHealth} | ${report.comparison.healthTrend === 'stable' ? report.summary.averageHealth : '-'} | ${report.comparison.healthTrend} ${trendArrow(report.comparison.healthTrend)} |
| 平均心情 | ${report.summary.averageMood} | ${report.comparison.moodTrend === 'stable' ? report.summary.averageMood : '-'} | ${report.comparison.moodTrend} ${trendArrow(report.comparison.moodTrend)} |

## 🏆 本${report.period === 'weekly' ? '周' : '月'}解锁成就

${report.details.unlockedAchievements.length > 0
    ? report.details.unlockedAchievements.map((item) => `- ${item.icon} **${item.name}** - ${item.description}`).join('\n')
    : '- 本周期没有新的成就解锁，但基础成长仍在持续推进。'}

## 📈 成长趋势

${report.details.dailyInteractions.map((item) => `- ${item.date}: 互动 ${item.count} 次`).join('\n')}

## 🩺 健康记录

${report.details.healthRecords.map((item) => `- ${item.date}: 健康度 ${item.score}${item.source === 'estimated' ? '（估算）' : ''}`).join('\n')}

## 💡 核心洞察

${report.insights.map((item) => `- ${item}`).join('\n')}

## 🎯 建议动作

${report.suggestions.map((item) => `- ${item}`).join('\n')}
`;
}

export function renderHTML(report: GrowthReport) {
  const markdown = renderMarkdown(report)
    .replace(/^# (.+)$/m, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${report.period === 'weekly' ? '小龙虾成长周报' : '小龙虾成长月报'}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #fff8ef;
      --card: #fffdf9;
      --line: #e9d5bd;
      --text: #34251a;
      --muted: #7f6753;
      --accent: #d25d2b;
    }
    body {
      margin: 0;
      padding: 32px 16px;
      background: radial-gradient(circle at top, #ffe7cf, var(--bg) 48%);
      color: var(--text);
      font: 16px/1.7 "Hiragino Sans GB", "PingFang SC", sans-serif;
    }
    main {
      max-width: 920px;
      margin: 0 auto;
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: 32px;
      box-shadow: 0 18px 50px rgba(153, 93, 54, 0.12);
    }
    h1, h2 { color: var(--accent); }
    p { margin: 0 0 16px; }
    ul { margin: 0 0 20px 20px; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0 24px;
    }
    th, td {
      border: 1px solid var(--line);
      padding: 10px 12px;
      text-align: left;
    }
    th { background: #fff0df; }
    .meta { color: var(--muted); }
  </style>
</head>
<body>
  <main>
    <div class="meta">生成时间：${formatGeneratedAt(report.generatedAt)}</div>
    <p>${markdown}</p>
  </main>
</body>
</html>`;
}
