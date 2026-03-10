import { getLobsterStats, Brain, Limbs } from './lobster';
import { analyzeMemory } from './memoryAnalyzer';
import { getModelBrainMapping } from './modelMapper';
import { analyzeSkills, SkillsStats } from './skillsAnalyzer';
import { getAchievements, AchievementsStats } from './achievements';
import { generateDialogue, getRandomEvent, Dialogue } from './dialogue';

export interface CompleteLobsterStats {
  // 基础信息
  name: string;
  avatar: string;
  personality: string;
  model: string;
  
  // 等级
  level: number;
  experience: number;
  maxExperience: number;
  age: number;
  
  // 基础状态
  hunger: number;
  health: number;
  
  // 大脑
  brain: Brain;
  brainMapping: any;
  
  // 记忆
  memory: {
    shallow: { count: number; quality: number; recent: string[] };
    deep: { count: number; quality: number; files: string[] };
    organization: number;
    completeness: number;
  };
  
  // 四肢
  limbs: Limbs;
  
  // 能力
  intelligence: number;
  memoryScore: number;
  skills: number;
  experiencePool: number;
  
  // 状态
  mood: number;
  fatigue: number;
  loyalty: number;
  
  // 统计
  totalTokens: number;
  totalSessions: number;
  totalMessages: number;
  lastActive: string;
  
  // 技能分析
  skillsAnalysis: SkillsStats;
  
  // 成就
  achievements: AchievementsStats;
  
  // 对话
  dialogue: Dialogue;
  
  // 随机事件
  event: { title: string; description: string; effect: string } | null;
}

export async function getCompleteLobsterStats(): Promise<CompleteLobsterStats> {
  const [baseStats, skillsStats] = await Promise.all([
    getLobsterStats(),
    analyzeSkills()
  ]);
  
  const achievements = await getAchievements(baseStats);
  const dialogue = generateDialogue(baseStats);
  const event = getRandomEvent();
  
  return {
    ...baseStats,
    skillsAnalysis: skillsStats,
    achievements,
    dialogue,
    event
  };
}
