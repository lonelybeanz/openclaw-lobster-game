export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
  progress?: number;
  max?: number;
}

export interface AchievementsStats {
  total: number;
  unlocked: number;
  achievements: Achievement[];
}

// 成就定义
const ACHIEVEMENTS = [
  // 等级成就
  { id: 'level_1', name: '初生小龙虾', desc: '等级达到 1', icon: '🥚', condition: (s: any) => s.level >= 1 },
  { id: 'level_5', name: '小虾米', desc: '等级达到 5', icon: '🦐', condition: (s: any) => s.level >= 5 },
  { id: 'level_10', name: '龙吸水', desc: '等级达到 10', icon: '🐉', condition: (s: any) => s.level >= 10 },
  
  // 使用成就
  { id: 'tokens_100k', name: '挥霍如雨', desc: '消耗 100K tokens', icon: '💰', condition: (s: any) => s.totalTokens >= 100000 },
  { id: 'tokens_500k', name: '富甲一方', desc: '消耗 500K tokens', icon: '💎', condition: (s: any) => s.totalTokens >= 500000 },
  { id: 'sessions_10', name: '社交达人', desc: '完成 10 次会话', icon: '💬', condition: (s: any) => s.totalSessions >= 10 },
  { id: 'sessions_50', name: '话痨小龙虾', desc: '完成 50 次会话', icon: '🗣️', condition: (s: any) => s.totalSessions >= 50 },
  
  // 记忆成就
  { id: 'memory_10', name: '过目不忘', desc: '记忆文件超过 10 个', icon: '🧠', condition: (s: any) => (s.memory?.shallow?.count || 0) >= 10 },
  { id: 'memory_50', name: '记忆大师', desc: '记忆文件超过 50 个', icon: '📚', condition: (s: any) => (s.memory?.shallow?.count || 0) >= 50 },
  { id: 'memory_org', name: '井井有条', desc: '记忆组织度达到 80', icon: '📋', condition: (s: any) => (s.memory?.organization || 0) >= 80 },
  
  // 技能成就
  { id: 'skills_3', name: '三板斧', desc: '拥有 3 个技能', icon: '⚔️', condition: (s: any) => s.skills >= 3 },
  { id: 'skills_10', name: '十项全能', desc: '拥有 10 个技能', icon: '🏆', condition: (s: any) => s.skills >= 10 },
  
  // 脑力成就
  { id: 'brain_100', name: '最强大脑', desc: '神经元达到 100', icon: '🧠', condition: (s: any) => (s.brain?.neurons || 0) >= 100 },
  { id: 'long_memory', name: '记忆超群', desc: '长期记忆达到 80', icon: '💾', condition: (s: any) => (s.brain?.longTerm || 0) >= 80 },
  
  // 年龄成就
  { id: 'age_7', name: '一周目', desc: '存活 7 天', icon: '📅', condition: (s: any) => s.age >= 7 },
  { id: 'age_30', name: '一月游', desc: '存活 30 天', icon: '🗓️', condition: (s: any) => s.age >= 30 },
];

export async function getAchievements(stats: any): Promise<AchievementsStats> {
  const achievements: Achievement[] = [];
  let unlocked = 0;
  
  for (const ach of ACHIEVEMENTS) {
    const isUnlocked = ach.condition(stats);
    if (isUnlocked) unlocked++;
    
    achievements.push({
      id: ach.id,
      name: ach.name,
      description: ach.desc,
      icon: ach.icon,
      unlocked: isUnlocked,
      unlockedAt: isUnlocked ? new Date().toISOString() : undefined
    });
  }
  
  return {
    total: ACHIEVEMENTS.length,
    unlocked,
    achievements
  };
}
