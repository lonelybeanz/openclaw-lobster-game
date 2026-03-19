import { getLobsterStats } from './lobster';
import { analyzeSkills } from './skillsAnalyzer';
import { getMilestones } from './milestones';
import { generateDialogue, getRandomEvent } from './dialogue';
import { createTtlCache } from './cache';
import { loadLobsterState } from './persistence';
import type { Brain, Limbs } from './lobster';
import type { ModelBrainMapping } from './modelMapper';
import type { SkillsStats } from './skillsAnalyzer';
import type { MilestoneStats } from './milestones';
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
  achievements: MilestoneStats;
  dialogue: Dialogue;
  event: { title: string; description: string; effect: string } | null;
}

export async function getCompleteLobsterStats(): Promise<CompleteLobsterStats> {
  const [baseStats, skillsStats, lobsterState] = await Promise.all([
    getLobsterStats(),
    skillsCache.get(() => analyzeSkills()),
    loadLobsterState(),
  ]);

  const milestoneStats = {
    totalInteractions: lobsterState.totalInteractions || 0,
    consecutiveDays: lobsterState.consecutiveDays || 0,
    lastActiveDate: lobsterState.lastActiveDate || new Date().toISOString().slice(0, 10),
    firstMeet: lobsterState.firstMeet,
    midnightCount: lobsterState.midnightCount || 0,
    deepTalkCount: lobsterState.deepTalkCount || 0,
    challengesCompleted: lobsterState.challengesCompleted || 0,
    skills: 0,
  };
  const achievements = await getMilestones(baseStats, milestoneStats);
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
