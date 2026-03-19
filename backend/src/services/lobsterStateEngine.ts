import { getLobsterMetrics } from './lobsterMetrics';

/**
 * 龙虾状态计算引擎
 * 
 * 核心算法：
 * - Token → 经验：每 1000 tokens = 1 经验
 * - 经验 → 等级：level = floor(sqrt(experience / 1000))
 *   - 1000 经验 = Lv.1
 *   - 10000 经验 = Lv.3
 *   - 1000000 经验 = Lv.31
 * - 饥饿：100 - idleHours * 10，最低 20
 * - 心情：80 + recentSessions / 10，最高 100
 * - 疲劳：recent24hSessions / 5，最高 80
 * - 忠诚：50 + days * 2，最高 100
 */

export interface ComputedLobsterState {
  experience: number;      // 总经验 = tokens / 1000
  level: number;         // 等级 = floor(sqrt(experience / 1000))
  hunger: number;       // 饱食度
  mood: number;         // 心情
  fatigue: number;       // 疲劳
  loyalty: number;       // 忠诚
  brain: {
    neurons: number;
    memory: number;
    logic: number;
  };
  skills: number;        // 技能数
  totalTokens: number;    // 总 tokens
  totalSessions: number;  // 总会话
}

export async function computeLobsterState(): Promise<ComputedLobsterState> {
  const metrics = await getLobsterMetrics();
  
  const { totalTokens, totalSessions, skillCount, lastActive } = metrics;

  // 经验 = tokens / 1000
  // 800万 tokens → 8000 经验
  const experience = Math.floor(totalTokens / 1000);

  // 等级 = floor(sqrt(experience / 1000))
  // 8000 / 1000 = 8 → sqrt(8) ≈ 2.8 → Lv.2
  // 但更合理的算法：每倍增升一级
  // level = floor(log2(experience / 1000)) + 1
  const level = Math.max(1, Math.floor(Math.log2(experience / 1000)) + 1);

  // 空闲时间计算
  const now = new Date();
  const idleHours = lastActive 
    ? (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60) 
    : 24;

  // 饱食度：随时间下降，最低 20
  const hunger = Math.max(20, Math.floor(100 - idleHours * 5));

  // 心情：基于会话数，基准 80
  const recentSessions = Math.min(totalSessions, 100);
  const mood = Math.min(100, Math.floor(80 + recentSessions / 10));

  // 疲劳：基于最近会话
  const fatigue = Math.min(80, Math.floor(recentSessions / 5));

  // 忠诚：基于使用天数（简化：每 10 tokens = 1 天）
  const days = Math.floor(totalTokens / 10000);
  const loyalty = Math.min(100, Math.floor(50 + days));

  // 脑力：基于等级
  const neurons = Math.min(100, level * 10 + 50);
  const memory = Math.min(100, skillCount * 5 + 50);
  const logic = Math.min(100, Math.floor(experience / 1000));

  return {
    experience,
    level,
    hunger,
    mood,
    fatigue,
    loyalty,
    brain: { neurons, memory, logic },
    skills: skillCount,
    totalTokens,
    totalSessions,
  };
}
