import type { MemoryScoreHistoryItem } from './memoryScore';
import type { ModelBrainMapping } from './modelMapper';
import type { VisualizationPoint } from './visualization';

type TokenIncrementItem = {
  date?: string;
  added?: number;
};

type SessionHistoryItem = {
  updatedAt?: number | string;
  tokens?: number;
};

type EvolutionTrendOptions = {
  days?: number;
  totalTokens: number;
  totalSessions: number;
  increments: TokenIncrementItem[];
  history: SessionHistoryItem[];
  memoryHistory: MemoryScoreHistoryItem[];
  memoryFileCount: number;
  shallowMemoryQuality: number;
  modelMapping: ModelBrainMapping;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

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

function shortDate(day: string): string {
  return day.slice(5);
}

function calculateBrain(tokens: number, sessions: number, memoryFiles: number, modelMapping: ModelBrainMapping) {
  const base = Math.min(100, Math.floor(tokens / 10000));
  const benchmark = modelMapping.benchmark;

  return {
    cerebral: Math.min(100, Math.floor(base * 0.45 + modelMapping.reasoning * 0.3 + benchmark.intelligence * 0.25)),
    opticLobes: Math.min(100, Math.floor(base * 0.5 + modelMapping.vision * 0.5)),
    antennaLobe: Math.min(100, Math.floor(base * 0.35 + modelMapping.perception * 0.35 + benchmark.contextScore * 0.3)),
    neurons: Math.min(100, Math.floor(sessions * 3 + modelMapping.creativity * 0.3)),
    shortTerm: Math.min(100, Math.floor(sessions * 5 + modelMapping.shortMemory * 0.3)),
    longTerm: Math.min(100, Math.floor(memoryFiles * 1.7 + modelMapping.contextWindow * 0.2 + benchmark.contextScore * 0.2)),
    episodic: Math.min(100, Math.floor(sessions * 2)),
    procedural: Math.min(100, Math.floor(sessions * 1.5 + modelMapping.coding * 0.3)),
    amygdala: Math.min(100, Math.floor(50 + sessions * 2 + modelMapping.emotion * 0.3)),
    cerebellum: Math.min(100, Math.floor(base * 0.4 + modelMapping.coding * 0.35 + benchmark.speedScore * 0.25)),
    brainstem: Math.min(100, Math.floor(55 + benchmark.latencyScore * 0.35 + benchmark.reasoningScore * 0.1)),
  };
}

function calculateLimbs(tokens: number, modelMapping: ModelBrainMapping) {
  const base = Math.min(100, Math.floor(tokens / 15000));
  const benchmark = modelMapping.benchmark;

  return {
    antennae: Math.min(100, Math.floor(modelMapping.contextWindow * 0.5 + base * 0.5)),
    agility: Math.min(100, Math.floor(base * 0.6 + benchmark.latencyScore * 0.4)),
    endurance: Math.min(100, Math.floor(modelMapping.efficiency * 0.35 + benchmark.costScore * 0.35 + base * 0.3)),
  };
}

function calculateLevel(tokens: number) {
  const level = Math.floor(tokens / 50000) + 1;
  const maxExperience = Math.max(1, level * 50000);
  const experience = tokens % 50000;
  return { level, experience, maxExperience };
}

function calculateMood(totalSessions: number) {
  return Math.min(100, Math.floor(80 + Math.min(totalSessions, 100) / 10));
}

function calculateEvolutionScore(params: {
  totalTokens: number;
  totalSessions: number;
  memoryFileCount: number;
  memoryQuality: number;
  memoryOverallScore: number;
  modelMapping: ModelBrainMapping;
}) {
  const brain = calculateBrain(params.totalTokens, params.totalSessions, params.memoryFileCount, params.modelMapping);
  const limbs = calculateLimbs(params.totalTokens, params.modelMapping);
  const { level, experience, maxExperience } = calculateLevel(params.totalTokens);
  const expRatio = Math.min(100, (experience / maxExperience) * 100);
  const moodScore = calculateMood(params.totalSessions);
  const benchmark = params.modelMapping.benchmark;
  const memoryQuality = clamp(Math.round(params.memoryQuality * 0.35 + params.memoryOverallScore * 0.65));

  const reasoningScore =
    brain.cerebral * 0.28 +
    brain.opticLobes * 0.14 +
    brain.antennaLobe * 0.14 +
    brain.neurons * 0.14 +
    benchmark.reasoningScore * 0.3;
  const intelligenceScore = brain.cerebral * 0.22 + brain.neurons * 0.18 + reasoningScore * 0.25 + benchmark.intelligence * 0.35;
  const perceptionScore =
    brain.opticLobes * 0.25 + brain.antennaLobe * 0.25 + limbs.antennae * 0.15 + brain.brainstem * 0.1 + benchmark.contextScore * 0.25;
  const memoryScore =
    brain.shortTerm * 0.18 +
    brain.longTerm * 0.25 +
    brain.episodic * 0.15 +
    brain.procedural * 0.17 +
    memoryQuality * 0.1 +
    benchmark.contextScore * 0.15;
  const reactionScore =
    brain.cerebellum * 0.2 +
    brain.brainstem * 0.15 +
    limbs.agility * 0.15 +
    brain.amygdala * 0.1 +
    benchmark.speedScore * 0.25 +
    benchmark.latencyScore * 0.15;
  const growthScore =
    expRatio * 0.2 + level * 4 * 0.2 + limbs.endurance * 0.15 + brain.neurons * 0.05 + moodScore * 0.05 + benchmark.costScore * 0.35;

  return Math.round((intelligenceScore * 0.25 + perceptionScore * 0.2 + memoryScore * 0.2 + reactionScore * 0.2 + growthScore * 0.15) * 10) / 10;
}

export function buildEvolutionScoreTrend({
  days = 30,
  totalTokens,
  totalSessions,
  increments,
  history,
  memoryHistory,
  memoryFileCount,
  shallowMemoryQuality,
  modelMapping,
}: EvolutionTrendOptions): VisualizationPoint[] {
  const safeDays = Math.max(1, Math.floor(days));
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setUTCDate(today.getUTCDate() - (safeDays - 1));
  const startKey = start.toISOString().slice(0, 10);

  const incrementMap = new Map<string, number>();
  for (const item of increments) {
    const day = isoDay(item.date);
    if (!day) {
      continue;
    }
    incrementMap.set(day, (incrementMap.get(day) ?? 0) + Math.max(0, Math.round(Number(item.added) || 0)));
  }

  if (incrementMap.size === 0) {
    for (const item of history) {
      const day = isoDay(item.updatedAt);
      if (!day) {
        continue;
      }
      incrementMap.set(day, (incrementMap.get(day) ?? 0) + Math.max(0, Math.round(Number(item.tokens) || 0)));
    }
  }

  let baselineTokens = Math.max(0, Math.round(Number(totalTokens) || 0));
  for (const [day, added] of incrementMap.entries()) {
    if (day >= startKey) {
      baselineTokens -= added;
    }
  }
  baselineTokens = Math.max(0, baselineTokens);

  const sessionMap = new Map<string, number>();
  for (const item of history) {
    const day = isoDay(item.updatedAt);
    if (!day) {
      continue;
    }
    sessionMap.set(day, (sessionMap.get(day) ?? 0) + 1);
  }

  let baselineSessions = Math.max(0, Math.round(Number(totalSessions) || 0));
  for (const [day, count] of sessionMap.entries()) {
    if (day >= startKey) {
      baselineSessions -= count;
    }
  }
  baselineSessions = Math.max(0, baselineSessions);

  const memoryTimeline = [...memoryHistory]
    .filter((item) => typeof item.date === 'string' && item.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  let memoryIndex = 0;
  let lastMemoryScore = clamp(Math.round(memoryTimeline[memoryTimeline.length - 1]?.score ?? shallowMemoryQuality));
  const trend: VisualizationPoint[] = [];
  let runningTokens = baselineTokens;
  let runningSessions = baselineSessions;

  for (let offset = 0; offset < safeDays; offset += 1) {
    const current = new Date(start);
    current.setUTCDate(start.getUTCDate() + offset);
    const day = current.toISOString().slice(0, 10);

    runningTokens += incrementMap.get(day) ?? 0;
    runningSessions += sessionMap.get(day) ?? 0;

    let currentMemory = memoryTimeline[memoryIndex];
    while (currentMemory && currentMemory.date <= day) {
      lastMemoryScore = clamp(Math.round(currentMemory.score));
      memoryIndex += 1;
      currentMemory = memoryTimeline[memoryIndex];
    }

    trend.push({
      label: shortDate(day),
      value: calculateEvolutionScore({
        totalTokens: runningTokens,
        totalSessions: runningSessions,
        memoryFileCount,
        memoryQuality: shallowMemoryQuality,
        memoryOverallScore: lastMemoryScore,
        modelMapping,
      }),
    });
  }

  return trend;
}
