export type ApiResponse<T> = {
  code: number;
  data: T;
  message?: string;
};

export type MemberLevel = {
  id: number;
  name: string;
  level: number;
  experience: number;
  discountPercent: number;
  icon: string | null;
  backgroundUrl: string | null;
  status: number;
};

export type MemberUser = {
  id: number;
  mobile: string | null;
  nickname: string;
  levelId: number | null;
  experience: number;
  point: number;
  levelName: string | null;
  levelValue: number | null;
};

export type MemberSkill = {
  id: number;
  name: string;
  description: string;
  icon: string | null;
  category: string;
  required_level?: number;
  required_experience?: number;
  active?: boolean | number;
};

export type LobsterMemory = {
  shallow?: {
    count?: number;
    quality?: number;
    recent?: string[];
  };
  deep?: {
    count?: number;
    quality?: number;
    files?: string[];
  };
  organization?: number;
  completeness?: number;
  overallScore?: number;
  indexedAgents?: number;
  totalAgents?: number;
  layers?: MemoryLayerScore[];
  agents?: MemoryAgentScore[];
};

export type MemoryLayerFile = {
  path: string;
  label: string;
  exists: boolean;
  size: number;
  updatedAt: string | null;
  qualityScore: number;
  indexed: boolean;
};

export type MemoryLayerScore = {
  key: 'l1' | 'l2' | 'l3';
  label: string;
  score: number;
  completenessScore: number;
  qualityScore: number;
  indexScore: number;
  indexed: boolean;
  files: MemoryLayerFile[];
  summary: string;
};

export type MemoryAgentScore = {
  agentId: string;
  workspaceDir: string;
  backend: string;
  vectorReady: boolean;
  indexedFiles: number;
  indexedChunks: number;
  memorySourceFiles: number;
  sessionSourceFiles: number;
  dirty: boolean;
  issues: string[];
  score: number;
};

export type MemoryScoreHistoryItem = {
  date: string;
  score: number;
  l1: number;
  l2: number;
  l3: number;
  indexHealth: number;
};

export type MemoryTestCaseResult = {
  id: string;
  agentId: string;
  query: string;
  latencyMs: number;
  hitCount: number;
  passed: boolean;
  matchedExpectation: boolean;
  error?: string;
};

export type MemoryTestReport = {
  runAt: string;
  durationMs: number;
  totalCases: number;
  passedCases: number;
  accuracyRate: number;
  averageLatencyMs: number;
  results: MemoryTestCaseResult[];
};

export type MemoryScoreSnapshot = {
  workspaceRoot: string;
  overallScore: number;
  indexedAgents: number;
  totalAgents: number;
  overall: {
    score: number;
    grade: string;
    completenessScore: number;
    qualityScore: number;
    indexScore: number;
  };
  layers: MemoryLayerScore[];
  agents: MemoryAgentScore[];
  history: MemoryScoreHistoryItem[];
  latestTestReport: MemoryTestReport | null;
  scheduler: {
    enabled: boolean;
    intervalMinutes: number;
    testCaseCount: number;
    lastRunAt: string | null;
  };
};

export type MemoryLlmEvalAgentEvaluation = {
  score: number | null;
  grade: string | null;
  summary: string;
  strengths: string[];
  risks: string[];
  suggestions: string[];
  raw: string;
};

export type MemoryLlmEvalFile = {
  path: string;
  exists: boolean;
  content: string;
  truncated: boolean;
};

export type MemoryLlmEvalAgent = {
  agentId: string;
  name: string | null;
  workspaceRoot: string;
  files: MemoryLlmEvalFile[];
  evaluation: MemoryLlmEvalAgentEvaluation;
};

export type MemoryLlmEvalResponse = {
  evaluatorAgentId: string;
  totalAgents: number;
  agents: MemoryLlmEvalAgent[];
};

export type MemoryLlmEvalSavedRecord = {
  savedAt: string;
  result: MemoryLlmEvalResponse;
};

export type BenchmarkScores = {
  intelligence: number;
  reasoningScore: number;
  contextScore: number;
  speedScore: number;
  latencyScore: number;
  costScore: number;
};

export type ModelBrainMapping = {
  reasoning: number;
  logic: number;
  vision: number;
  perception: number;
  contextWindow: number;
  shortMemory: number;
  coding: number;
  creativity: number;
  emotion: number;
  output: number;
  efficiency: number;
  benchmark: BenchmarkScores;
};

export type LobsterStats = {
  name: string;
  avatar: string;
  personality: string;
  model: string;
  level: number;
  experience: number;
  maxExperience: number;
  age: number;
  hunger: number;
  intelligence: number;
  memoryScore: number;
  skills: number;
  experiencePool: number;
  mood: number;
  fatigue: number;
  loyalty: number;
  totalTokens: number;
  totalSessions: number;
  totalMessages: number;
  lastActive: string;
  totalInteractions?: number;
  brain?: any;
  brainMapping?: ModelBrainMapping;
  limbs?: any;
  memory?: LobsterMemory;
};

export type LobsterNewsItem = {
  id: string;
  title: string;
  summary: string;
  source: string;
  url?: string;
  publishedAt?: string;
  date?: string;
  content?: string;
};

export type RandomEvent = {
  id: string;
  title: string;
  description: string;
  effect?: {
    mood?: number;
    hunger?: number;
    fatigue?: number;
    experience?: number;
    loyalty?: number;
  };
  probability?: number;
};

export type InteractResult = {
  message: string;
  expGained: number;
  randomEvent?: RandomEvent | null;
  [key: string]: unknown;
};

export type Achievement = {
  id: string;
  name: string;
  unlocked: boolean;
  icon?: string;
  description?: string;
  category?: string;
  progress?: number;
  max?: number;
  unlockedAt?: string;
};

export type AchievementItem = Achievement & {
  icon?: string;
  description?: string;
  unlockedAt?: string;
  unlockTime?: string;
  unlocked_at?: string;
  achievedAt?: string;
};

export type AchievementUnlockHistoryItem = {
  id: string;
  name: string;
  icon: string;
  unlockedAt: string;
};

export type LlmMilestoneCard = {
  id: 'growth' | 'brain' | 'skills' | 'exploration' | 'social' | 'flow' | 'guardian' | 'evolution';
  category: string;
  icon: string;
  name: string;
  headline: string;
  description: string;
  nextHint: string;
  level: 'bronze' | 'silver' | 'gold' | 'mythic';
  score: number;
  progress: number;
  maxProgress: number;
  progressText: string;
  unlocked: boolean;
  metricLabel: string;
  metricValue: string;
};

export type LlmMilestonesResponse = {
  generatedAt: string;
  expiresAt: string;
  source: 'fresh' | 'cache' | 'stale-cache' | 'fallback';
  summary: string;
  cards: LlmMilestoneCard[];
};

export type SearchNewsStatus = 'pending' | 'done' | 'error';

export type SearchNewsResponse = {
  success: boolean;
  results?: LobsterNewsItem[];
  jobId?: string;
  query?: string;
  status?: SearchNewsStatus;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
};

export type SkillStats = {
  total: number;
  skills?: string[];
  categories?: string[];
  recentlyAdded?: string[];
};

export type VisualizationPoint = {
  label: string;
  value: number;
};

export type VisualizationSnapshot = {
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
};

// Timeline 相关类型（向后兼容）
export type AchievementTimelineUnlock = {
  id: string;
  title: string;
  description: string;
  unlockedAt: string;
  type: string;
};

export type GrowthHeatmapItem = {
  date: string;
  count: number;
  level?: number;
};

export type HealthPeriod = '7d' | '30d' | '90d';

export type HealthRecord = {
  date: string;
  hunger: number;
  mood: number;
  fatigue: number;
  health: number;
};
