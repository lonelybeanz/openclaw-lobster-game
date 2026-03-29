/**
 * 学习点数系统 - Learning Points System
 * 
 * 核心机制：
 * - 读取记忆 (memory_recall) → +1 学习点
 * - 写入记忆 (memory_store) → +3 学习点  
 * - 探索记忆 (lcm_grep) → +5 学习点
 * - 学习点累积 → 转换为龙虾经验值
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DATA_DIR = join(process.cwd(), 'data');
const LEARNING_STATE_FILE = join(DATA_DIR, 'learning-state.json');

// 学习行为类型
export type LearningActionType = 
  | 'memory_read'      // 读取记忆
  | 'memory_write'     // 写入记忆
  | 'memory_explore'   // 探索记忆 (搜索/grep)
  | 'skill_learn'      // 学习技能
  | 'task_complete';   // 完成任务

// 学习行为配置
const LEARNING_REWARDS: Record<LearningActionType, { points: number; exp: number; reason: string }> = {
  memory_read: {
    points: 1,
    exp: 5,
    reason: '回顾记忆，温故知新',
  },
  memory_write: {
    points: 3,
    exp: 15,
    reason: '记录新知，记忆沉淀',
  },
  memory_explore: {
    points: 5,
    exp: 25,
    reason: '探索记忆深处，发现新大陆',
  },
  skill_learn: {
    points: 10,
    exp: 50,
    reason: '掌握新技能，能力提升',
  },
  task_complete: {
    points: 8,
    exp: 40,
    reason: '完成任务，实践出真知',
  },
};

// 学习记录
export interface LearningRecord {
  id: string;
  timestamp: string;
  action: LearningActionType;
  points: number;
  exp: number;
  reason: string;
  metadata?: {
    memoryFile?: string;
    skillName?: string;
    taskId?: string;
  };
}

// 学习状态
export interface LearningState {
  totalPoints: number;           // 总学习点数
  todayPoints: number;           // 今日学习点数
  totalExp: number;              // 累计获得经验
  todayExp: number;              // 今日获得经验
  streakDays: number;            // 连续学习天数
  lastLearningDate: string;      // 最后学习日期
  records: LearningRecord[];     // 最近学习记录
  stats: {
    memoryReads: number;
    memoryWrites: number;
    memoryExplores: number;
    skillsLearned: number;
    tasksCompleted: number;
  };
}

// 默认状态
const defaultLearningState: LearningState = {
  totalPoints: 0,
  todayPoints: 0,
  totalExp: 0,
  todayExp: 0,
  streakDays: 0,
  lastLearningDate: new Date().toISOString().slice(0, 10),
  records: [],
  stats: {
    memoryReads: 0,
    memoryWrites: 0,
    memoryExplores: 0,
    skillsLearned: 0,
    tasksCompleted: 0,
  },
};

// 加载学习状态
async function loadLearningState(): Promise<LearningState> {
  try {
    if (!existsSync(LEARNING_STATE_FILE)) {
      return { ...defaultLearningState };
    }
    const content = await readFile(LEARNING_STATE_FILE, 'utf-8');
    const state = JSON.parse(content) as LearningState;
    
    // 检查是否需要重置今日统计
    const today = new Date().toISOString().slice(0, 10);
    if (state.lastLearningDate !== today) {
      const lastDate = new Date(state.lastLearningDate);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // 更新连续天数
      if (diffDays === 1 && state.todayPoints > 0) {
        state.streakDays += 1;
      } else if (diffDays > 1) {
        state.streakDays = 0;
      }
      
      // 重置今日统计
      state.todayPoints = 0;
      state.todayExp = 0;
      state.lastLearningDate = today;
    }
    
    return state;
  } catch (error) {
    console.error('[learningPoints] load state failed:', error);
    return { ...defaultLearningState };
  }
}

// 保存学习状态
async function saveLearningState(state: LearningState): Promise<void> {
  try {
    await writeFile(LEARNING_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (error) {
    console.error('[learningPoints] save state failed:', error);
  }
}

// 生成唯一ID
function generateId(): string {
  return `learn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 记录学习行为
 */
export async function recordLearning(
  action: LearningActionType,
  metadata?: LearningRecord['metadata']
): Promise<LearningRecord | null> {
  const state = await loadLearningState();
  const reward = LEARNING_REWARDS[action];
  
  const record: LearningRecord = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    action,
    points: reward.points,
    exp: reward.exp,
    reason: reward.reason,
    metadata,
  };
  
  // 更新状态
  state.totalPoints += reward.points;
  state.todayPoints += reward.points;
  state.totalExp += reward.exp;
  state.todayExp += reward.exp;
  state.records.unshift(record);
  
  // 只保留最近 100 条记录
  if (state.records.length > 100) {
    state.records = state.records.slice(0, 100);
  }
  
  // 更新统计
  switch (action) {
    case 'memory_read':
      state.stats.memoryReads++;
      break;
    case 'memory_write':
      state.stats.memoryWrites++;
      break;
    case 'memory_explore':
      state.stats.memoryExplores++;
      break;
    case 'skill_learn':
      state.stats.skillsLearned++;
      break;
    case 'task_complete':
      state.stats.tasksCompleted++;
      break;
  }
  
  await saveLearningState(state);
  
  console.log(`[learningPoints] ${action}: +${reward.points}点 (${reward.reason})`);
  
  return record;
}

/**
 * 获取学习状态
 */
export async function getLearningState(): Promise<LearningState> {
  return loadLearningState();
}

/**
 * 获取今日学习摘要
 */
export async function getTodayLearningSummary(): Promise<{
  points: number;
  exp: number;
  streak: number;
  actions: number;
}> {
  const state = await loadLearningState();
  return {
    points: state.todayPoints,
    exp: state.todayExp,
    streak: state.streakDays,
    actions: state.records.filter(r => r.timestamp.startsWith(new Date().toISOString().slice(0, 10))).length,
  };
}

/**
 * 检查是否触发学习里程碑
 */
export async function checkLearningMilestones(): Promise<string[]> {
  const state = await loadLearningState();
  const milestones: string[] = [];
  
  // 总学习点数里程碑
  if (state.totalPoints >= 100) milestones.push('🎓 学习新秀');
  if (state.totalPoints >= 500) milestones.push('📚 记忆大师');
  if (state.totalPoints >= 1000) milestones.push('🧠 智慧龙虾');
  
  // 连续学习里程碑
  if (state.streakDays >= 3) milestones.push('🔥 连续3天');
  if (state.streakDays >= 7) milestones.push('⚡ 一周达人');
  if (state.streakDays >= 30) milestones.push('👑 月度学霸');
  
  // 探索里程碑
  if (state.stats.memoryExplores >= 10) milestones.push('🔍 探索者');
  if (state.stats.memoryExplores >= 50) milestones.push('🗺️ 探险家');
  
  return milestones;
}

/**
 * 模拟记忆读取（供前端调用）
 */
export async function simulateMemoryRead(memoryFile: string): Promise<LearningRecord | null> {
  return recordLearning('memory_read', { memoryFile });
}

/**
 * 模拟记忆写入（供前端调用）
 */
export async function simulateMemoryWrite(memoryFile: string): Promise<LearningRecord | null> {
  return recordLearning('memory_write', { memoryFile });
}

/**
 * 模拟记忆探索（供前端调用）
 */
export async function simulateMemoryExplore(query: string): Promise<LearningRecord | null> {
  return recordLearning('memory_explore', { memoryFile: query });
}
