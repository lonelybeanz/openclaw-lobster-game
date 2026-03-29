/**
 * 养殖师系统 (Human Caretaker System)
 * 
 * 核心理念：
 * - 人类用户是养殖师，负责照顾小龙虾群
 * - 养殖师有自己的等级、经验、技能
 * - 养殖师的行为影响所有小龙虾的成长
 * 
 * 养殖师行为：
 * - 喂养：降低龙虾饥饿度，恢复体力
 * - 训练：提升龙虾属性，增加成长值
 * - 清理：改善水质，提升心情
 * - 观察：了解龙虾状态，发现问题
 * - 进化：触发龙虾进化升级
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = join(process.cwd(), 'data');
const CARETAKER_STATE_FILE = join(DATA_DIR, 'caretaker-state.json');

// 养殖师等级
export type CaretakerLevel = 
  | 'novice'      // 新手
  | 'apprentice'  // 学徒
  | 'junior'      // 初级
  | 'senior'      // 高级
  | 'master'      // 大师
  | 'legendary';  // 传奇

// 养殖师技能
export interface CaretakerSkills {
  feeding: number;      // 喂养技巧
  training: number;     // 训练技巧
  cleaning: number;     // 清理技巧
  observing: number;    // 观察技巧
  evolving: number;     // 进化技巧
}

// 养殖师行为记录
export interface CaretakerAction {
  id: string;
  timestamp: string;
  type: 'feed' | 'train' | 'rest' | 'clean' | 'observe' | 'evolve';
  targetLobsterId?: string;  // 目标龙虾
  details: string;
  expGained: number;
}

// 养殖师状态
export interface CaretakerState {
  // 基本信息
  name: string;
  level: CaretakerLevel;
  levelNumber: number;      // 等级数字 1-100
  experience: number;
  maxExperience: number;
  
  // 技能
  skills: CaretakerSkills;
  
  // 统计
  stats: {
    totalActions: number;
    feedCount: number;
    trainCount: number;
    restCount: number;
    cleanCount: number;
    observeCount: number;
    evolveCount: number;
    streakDays: number;     // 连续照顾天数
    lastActiveDate: string;
  };
  
  // 记录
  recentActions: CaretakerAction[];
  
  // 资源
  resources: {
    food: number;           // 食物存量
    medicine: number;       // 药品存量
    toys: number;          // 玩具存量
    tokens: number;        // 代币
  };
}

// 等级配置
const LEVEL_CONFIG: Record<CaretakerLevel, {
  name: string;
  emoji: string;
  minLevel: number;
  expMultiplier: number;
  skillBonus: number;
}> = {
  novice: {
    name: '新手养殖师',
    emoji: '🌱',
    minLevel: 1,
    expMultiplier: 1.0,
    skillBonus: 0,
  },
  apprentice: {
    name: '学徒养殖师',
    emoji: '🌿',
    minLevel: 10,
    expMultiplier: 1.2,
    skillBonus: 5,
  },
  junior: {
    name: '初级养殖师',
    emoji: '🌲',
    minLevel: 25,
    expMultiplier: 1.5,
    skillBonus: 10,
  },
  senior: {
    name: '高级养殖师',
    emoji: '🌳',
    minLevel: 45,
    expMultiplier: 2.0,
    skillBonus: 15,
  },
  master: {
    name: '大师养殖师',
    emoji: '👑',
    minLevel: 70,
    expMultiplier: 2.5,
    skillBonus: 20,
  },
  legendary: {
    name: '传奇养殖师',
    emoji: '🦸',
    minLevel: 90,
    expMultiplier: 3.0,
    skillBonus: 25,
  },
};

// 默认状态
const defaultCaretakerState: CaretakerState = {
  name: '养殖师',
  level: 'novice',
  levelNumber: 1,
  experience: 0,
  maxExperience: 100,
  skills: {
    feeding: 10,
    training: 10,
    cleaning: 10,
    observing: 10,
    evolving: 5,
  },
  stats: {
    totalActions: 0,
    feedCount: 0,
    trainCount: 0,
    restCount: 0,
    cleanCount: 0,
    observeCount: 0,
    evolveCount: 0,
    streakDays: 0,
    lastActiveDate: new Date().toISOString().slice(0, 10),
  },
  recentActions: [],
  resources: {
    food: 100,
    medicine: 10,
    toys: 5,
    tokens: 1000,
  },
};

// 加载养殖师状态
async function loadCaretakerState(): Promise<CaretakerState> {
  try {
    if (!existsSync(CARETAKER_STATE_FILE)) {
      return { ...defaultCaretakerState };
    }
    const content = await readFile(CARETAKER_STATE_FILE, 'utf-8');
    const state = JSON.parse(content) as CaretakerState;
    
    // 检查连续天数
    const today = new Date().toISOString().slice(0, 10);
    if (state.stats.lastActiveDate !== today) {
      const lastDate = new Date(state.stats.lastActiveDate);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        state.stats.streakDays += 1;
      } else if (diffDays > 1) {
        state.stats.streakDays = 0;
      }
      
      state.stats.lastActiveDate = today;
    }
    
    return state;
  } catch (error) {
    console.error('[caretaker] load state failed:', error);
    return { ...defaultCaretakerState };
  }
}

// 保存养殖师状态
async function saveCaretakerState(state: CaretakerState): Promise<void> {
  try {
    await writeFile(CARETAKER_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (error) {
    console.error('[caretaker] save state failed:', error);
  }
}

// 计算等级
function calculateLevel(exp: number): { level: CaretakerLevel; number: number; maxExp: number } {
  const levels: CaretakerLevel[] = ['novice', 'apprentice', 'junior', 'senior', 'master', 'legendary'];
  
  for (let i = levels.length - 1; i >= 0; i--) {
    const level = levels[i];
    const config = LEVEL_CONFIG[level];
    if (exp >= config.minLevel * 100) {
      const number = Math.min(100, Math.floor(exp / 100) + 1);
      const nextLevelExp = (number + 1) * 100;
      return { level, number, maxExp: nextLevelExp };
    }
  }
  
  return { level: 'novice', number: 1, maxExp: 100 };
}

// 获取养殖师状态
export async function getCaretakerState(): Promise<CaretakerState> {
  return loadCaretakerState();
}

// 记录养殖师行为
export async function recordCaretakerAction(
  type: CaretakerAction['type'],
  targetLobsterId?: string,
  details?: string
): Promise<{ success: boolean; action: CaretakerAction; levelUp?: boolean }> {
  const state = await loadCaretakerState();
  const config = LEVEL_CONFIG[state.level];
  
  // 计算获得的经验
  let expGained = 0;
  switch (type) {
    case 'feed':
      expGained = Math.floor(10 * config.expMultiplier);
      state.stats.feedCount++;
      break;
    case 'train':
      expGained = Math.floor(15 * config.expMultiplier);
      state.stats.trainCount++;
      break;
    case 'rest':
      expGained = Math.floor(8 * config.expMultiplier);
      state.stats.restCount++;
      break;
    case 'clean':
      expGained = Math.floor(12 * config.expMultiplier);
      state.stats.cleanCount++;
      break;
    case 'observe':
      expGained = Math.floor(5 * config.expMultiplier);
      state.stats.observeCount++;
      break;
    case 'evolve':
      expGained = Math.floor(50 * config.expMultiplier);
      state.stats.evolveCount++;
      break;
  }
  
  state.stats.totalActions++;
  
  // 创建记录
  const action: CaretakerAction = {
    id: `action-${Date.now()}`,
    timestamp: new Date().toISOString(),
    type,
    targetLobsterId,
    details: details || getActionDescription(type, targetLobsterId),
    expGained,
  };
  
  state.recentActions.unshift(action);
  if (state.recentActions.length > 50) {
    state.recentActions = state.recentActions.slice(0, 50);
  }
  
  // 更新经验和等级
  const oldLevel = state.levelNumber;
  state.experience += expGained;
  const { level, number, maxExp } = calculateLevel(state.experience);
  state.level = level;
  state.levelNumber = number;
  state.maxExperience = maxExp;
  
  // 升级时提升技能
  if (number > oldLevel) {
    const skillBonus = LEVEL_CONFIG[level].skillBonus;
    state.skills.feeding += skillBonus;
    state.skills.training += skillBonus;
    state.skills.cleaning += skillBonus;
    state.skills.observing += skillBonus;
    state.skills.evolving += skillBonus;
  }
  
  await saveCaretakerState(state);
  
  console.log(`[caretaker] ${type}: +${expGained} EXP`);
  
  return {
    success: true,
    action,
    levelUp: number > oldLevel,
  };
}

// 获取行为描述
function getActionDescription(type: CaretakerAction['type'], target?: string): string {
  const descriptions: Record<string, string[]> = {
    feed: [
      '精心准备了美味的食物',
      '喂食了营养丰富的餐点',
      '准备了特别的料理',
    ],
    train: [
      '进行了专项训练',
      '传授了新的技能',
      '指导了练习方法',
    ],
    rest: [
      '安排了充足的休息时间',
      '营造了舒适的休息环境',
      '播放了舒缓的音乐',
    ],
    clean: [
      '彻底清理了池塘',
      '更换了新鲜的水质',
      '整理了生活环境',
    ],
    observe: [
      '仔细观察了状态变化',
      '记录了成长数据',
      '分析了行为模式',
    ],
    evolve: [
      '成功触发了进化！',
      '见证了历史性时刻！',
      '协助完成了蜕变！',
    ],
  };
  
  const list = descriptions[type] || ['进行了照顾'];
  const desc = list[Math.floor(Math.random() * list.length)];
  return target ? `${desc} (${target})` : desc;
}

// 消耗资源
export async function consumeResource(
  type: keyof CaretakerState['resources'],
  amount: number
): Promise<boolean> {
  const state = await loadCaretakerState();
  
  if (state.resources[type] < amount) {
    return false;
  }
  
  state.resources[type] -= amount;
  await saveCaretakerState(state);
  return true;
}

// 获取养殖师等级信息
export async function getCaretakerLevelInfo(): Promise<{
  current: CaretakerLevel;
  next: CaretakerLevel | null;
  progress: number;  // 0-100
  benefits: string[];
}> {
  const state = await loadCaretakerState();
  const levels: CaretakerLevel[] = ['novice', 'apprentice', 'junior', 'senior', 'master', 'legendary'];
  const currentIndex = levels.indexOf(state.level);
  const next = currentIndex < levels.length - 1 ? levels[currentIndex + 1] : null;
  
  const progress = Math.floor((state.experience / state.maxExperience) * 100);
  
  const benefits = [
    `经验加成: ${LEVEL_CONFIG[state.level].expMultiplier}x`,
    `技能加成: +${LEVEL_CONFIG[state.level].skillBonus}`,
  ];
  
  return {
    current: state.level,
    next,
    progress,
    benefits,
  };
}

// 获取养殖师统计摘要
export async function getCaretakerSummary(): Promise<{
  name: string;
  level: string;
  emoji: string;
  levelNumber: number;
  experience: number;
  maxExperience: number;
  streakDays: number;
  totalActions: number;
  skills: CaretakerSkills;
  resources: CaretakerState['resources'];
}> {
  const state = await loadCaretakerState();
  
  return {
    name: state.name,
    level: LEVEL_CONFIG[state.level].name,
    emoji: LEVEL_CONFIG[state.level].emoji,
    levelNumber: state.levelNumber,
    experience: state.experience,
    maxExperience: state.maxExperience,
    streakDays: state.stats.streakDays,
    totalActions: state.stats.totalActions,
    skills: state.skills,
    resources: state.resources,
  };
}
