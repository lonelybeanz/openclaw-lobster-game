import { getLobsterStats } from './lobster';
import { analyzeSkills } from './skillsAnalyzer';
import { getAchievements } from './achievements';
import { generateDialogue, getRandomEvent } from './dialogue';
import { createTtlCache } from './cache';
import type { Brain, Limbs } from './lobster';
import type { ModelBrainMapping } from './modelMapper';
import type { SkillsStats } from './skillsAnalyzer';
import type { AchievementsStats } from './achievements';
import type { Dialogue } from './dialogue';
import type { MemoryAgentScore, MemoryLayerScore } from './memoryScore';

const CACHE_TTL_MS = 5 * 60 * 1000;
const skillsCache = createTtlCache<SkillsStats>(CACHE_TTL_MS);

export interface CompleteLobsterStats {
  name: string;
  avatar: string;
  personality: string;
  model: string;
  level: number;
  experience: number;
  maxExperience: number;
  age: number;
  hunger: number;
  health: number;
  brain: Brain;
  brainMapping: ModelBrainMapping;
  memory: {
    shallow: { count: number; quality: number; recent: string[] };
    deep: { count: number; quality: number; files: string[] };
    organization: number;
    completeness: number;
    overallScore: number;
    indexedAgents: number;
    totalAgents: number;
    layers: MemoryLayerScore[];
    agents: MemoryAgentScore[];
  };
  limbs: Limbs;
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
  skillsAnalysis: SkillsStats;
  achievements: AchievementsStats;
  dialogue: Dialogue;
  event: { title: string; description: string; effect: string } | null;
}

export async function getCompleteLobsterStats(): Promise<CompleteLobsterStats> {
  const [baseStats, skillsStats] = await Promise.all([
    getLobsterStats(),
    skillsCache.get(() => analyzeSkills()),
  ]);

  const achievements = await getAchievements(baseStats);
  const dialogue = generateDialogue(baseStats);
  const event = getRandomEvent();

  return {
    ...baseStats,
    skillsAnalysis: skillsStats,
    achievements,
    dialogue,
    event,
  };
}
