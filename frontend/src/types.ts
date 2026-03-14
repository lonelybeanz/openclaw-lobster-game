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
  };
  organization?: number;
  completeness?: number;
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
};
