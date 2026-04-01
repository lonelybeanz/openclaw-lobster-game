/**
 * Agent Lobster State Service
 * 
 * 为每只小龙虾维护独立的状态文件，实现：
 * 1. 状态持久化 - HP/energy/mood 等状态不会因刷新而重置
 * 2. 时间衰减计算 - 即使服务器关闭，龙虾也会随时间变化
 * 3. 动态数据映射 - 实时关联 OpenClaw 使用数据
 */

import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const DATA_DIR = '/Users/moltbot/.openclaw/workspace/projects/openclaw-lobster-game/data';
const AGENTS_STATE_DIR = join(DATA_DIR, 'agents');
const OPENCLAW_DIR = process.env.OPENCLAW_DIR || '/Users/moltbot/.openclaw';

// 龙虾角色类型
export type LobsterRole = 'main' | 'dev' | 'pm' | 'ops' | 'research' | 'design' | 'test' | 'other';

// 龙虾性格类型
export type LobsterPersonality = 'diligent' | 'lazy' | 'curious' | 'cautious' | 'adventurous' | 'social';

// 进化阶段
export type EvolutionStage = 'larva' | 'juvenile' | 'adult' | 'master' | 'legendary';

export interface AgentLobsterState {
  // 基础信息
  agentId: string;
  name: string;
  role: LobsterRole;
  personality: LobsterPersonality;
  emoji: string;
  color: string;
  
  // 状态（随时间动态变化）
  status: {
    hp: number;        // 体力 0-100
    hunger: number;    // 饥饿度 0-100 (越高越饿)
    mood: number;      // 心情 0-100
    energy: number;    // 能量 0-100
    fatigue: number;   // 疲劳度 0-100
    growth: number;    // 成长值
    level: number;     // 等级
  };
  
  // 属性（基于使用数据）
  stats: {
    intelligence: number;
    coding: number;
    planning: number;
    stability: number;
    creativity: number;
    learning: number;
    neurons: number;   // 神经元数量（基于记忆文件）
  };
  
  // 进化信息
  evolution: {
    stage: EvolutionStage;
    progress: number;  // 进化进度 0-100
  };
  
  // 时间戳（用于计算离线变化）
  timestamps: {
    created: string;      // 创建时间
    lastUpdate: string;   // 上次状态更新时间
    lastFed: string;      // 上次喂养时间
    lastTrained: string;  // 上次训练时间
    lastRested: string;   // 上次休息时间
    lastActive: string;   // 上次OpenClaw活动时间
  };
  
  // OpenClaw 数据缓存（用于检测变化）
  openclaw: {
    totalTokens: number;
    totalSessions: number;
    memoryFiles: number;
    lastSessionId?: string;
  };
  
  // 累计统计
  totals: {
    interactions: number;     // 总互动次数
    tokensConsumed: number;   // 累计token消耗
    sessionsCompleted: number; // 完成session数
  };
  
  // 当前行为
  currentAction?: {
    action: string;
    since: string;
  };
}

// 角色默认配置
const ROLE_CONFIG: Record<LobsterRole, { emoji: string; color: string; namePrefix: string }> = {
  main: { emoji: '🦞', color: '#FF6B6B', namePrefix: '主虾' },
  dev: { emoji: '👨‍💻', color: '#4ECDC4', namePrefix: '开发虾' },
  pm: { emoji: '📊', color: '#FFE66D', namePrefix: '产品虾' },
  ops: { emoji: '🔧', color: '#95E1D3', namePrefix: '运维虾' },
  research: { emoji: '🔬', color: '#C7CEEA', namePrefix: '研究虾' },
  design: { emoji: '🎨', color: '#F8A5C2', namePrefix: '设计虾' },
  test: { emoji: '🧪', color: '#B8B8D1', namePrefix: '测试虾' },
  other: { emoji: '🦐', color: '#FFD93D', namePrefix: '小弟虾' },
};

// 性格配置
const PERSONALITY_CONFIG: Record<LobsterPersonality, {
  hungerRate: number;    // 饥饿增长速度
  moodDecay: number;     // 心情衰减速度
  energyRecovery: number; // 能量恢复速度
  fatigueRate: number;   // 疲劳增长速度
}> = {
  diligent: { hungerRate: 1.2, moodDecay: 0.8, energyRecovery: 0.9, fatigueRate: 1.1 },
  lazy: { hungerRate: 0.8, moodDecay: 1.0, energyRecovery: 1.2, fatigueRate: 0.7 },
  curious: { hungerRate: 1.0, moodDecay: 0.9, energyRecovery: 1.0, fatigueRate: 1.0 },
  cautious: { hungerRate: 0.9, moodDecay: 0.7, energyRecovery: 1.0, fatigueRate: 0.9 },
  adventurous: { hungerRate: 1.1, moodDecay: 1.1, energyRecovery: 0.8, fatigueRate: 1.2 },
  social: { hungerRate: 1.0, moodDecay: 0.6, energyRecovery: 1.0, fatigueRate: 1.0 },
};

// 确保目录存在
async function ensureDir(): Promise<void> {
  await mkdir(AGENTS_STATE_DIR, { recursive: true });
}

// 获取状态文件路径
function getStateFilePath(agentId: string): string {
  return join(AGENTS_STATE_DIR, `${agentId}-state.json`);
}

// 根据Agent ID推断角色
function inferRole(agentId: string): LobsterRole {
  const id = agentId.toLowerCase();
  if (id.includes('dev') || id.includes('code') || id.includes('eng')) return 'dev';
  if (id.includes('pm') || id.includes('product') || id.includes('plan')) return 'pm';
  if (id.includes('ops') || id.includes('sre') || id.includes('infra')) return 'ops';
  if (id.includes('research') || id.includes('rd') || id.includes('lab')) return 'research';
  if (id.includes('design') || id.includes('ui') || id.includes('ux')) return 'design';
  if (id.includes('test') || id.includes('qa')) return 'test';
  if (id.includes('main') || id.includes('default')) return 'main';
  return 'other';
}

// 根据角色生成性格
function generatePersonality(role: LobsterRole): LobsterPersonality {
  const rand = Math.random();
  if (role === 'main') return 'diligent';
  if (role === 'dev') return rand > 0.7 ? 'adventurous' : 'diligent';
  if (role === 'research') return 'curious';
  if (role === 'ops') return 'cautious';
  if (role === 'pm') return 'social';
  if (rand < 0.15) return 'lazy';
  if (rand < 0.4) return 'diligent';
  if (rand < 0.6) return 'curious';
  if (rand < 0.8) return 'cautious';
  return 'adventurous';
}

// 读取 OpenClaw 数据
async function readOpenClawData(agentId: string): Promise<{
  sessions: number;
  tokens: number;
  memoryFiles: number;
  lastActive: string;
  lastSessionId?: string;
}> {
  let sessions = 0;
  let tokens = 0;
  let memoryFiles = 0;
  let lastActive = new Date().toISOString();
  let lastSessionId: string | undefined;

  try {
    // 读取 sessions.json (新格式)
    const sessionsPath = join(OPENCLAW_DIR, 'agents', agentId, 'sessions', 'sessions.json');
    if (existsSync(sessionsPath)) {
      const content = await readFile(sessionsPath, 'utf-8');
      const sessionData = JSON.parse(content);
      if (Array.isArray(sessionData)) {
        sessions = sessionData.length;
        tokens = sessionData.reduce((sum: number, s: any) => sum + (s.totalTokens || 0), 0);
        
        if (sessions > 0) {
          const lastSession = sessionData[sessions - 1];
          lastActive = lastSession.createdAt || lastActive;
          lastSessionId = lastSession.id;
        }
      }
    }

    // 读取 .jsonl 文件 (旧格式/实际格式)
    // 每个 .jsonl 文件代表一个 session
    const sessionsDir = join(OPENCLAW_DIR, 'agents', agentId, 'sessions');
    if (existsSync(sessionsDir)) {
      const files = await readdir(sessionsDir);
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl') && !f.includes('.deleted') && !f.includes('.reset'));
      
      sessions += jsonlFiles.length;
      
      for (const file of jsonlFiles) {
        try {
          const filePath = join(sessionsDir, file);
          const stats = await import('fs/promises').then(m => m.stat(filePath));
          // 估算 tokens: 假设平均每 4 字符 = 1 token
          tokens += Math.floor(stats.size / 4);
          
          // 读取第一行获取时间戳
          const content = await readFile(filePath, 'utf-8');
          const firstLine = content.split('\n')[0];
          if (firstLine) {
            try {
              const record = JSON.parse(firstLine);
              const recordTime = record.timestamp || record.createdAt;
              if (recordTime && new Date(recordTime) > new Date(lastActive)) {
                lastActive = recordTime;
                lastSessionId = record.id || record.sessionId || file.replace('.jsonl', '');
              }
            } catch {
              // 忽略解析错误
            }
          }
        } catch {
          // 忽略读取错误的文件
        }
      }
    }

    // 统计 memory 文件数
    const memoryPath = join(OPENCLAW_DIR, 'agents', agentId, 'memory');
    if (existsSync(memoryPath)) {
      const files = await readdir(memoryPath);
      memoryFiles = files.filter(f => f.endsWith('.json') || f.endsWith('.md')).length;
    }
  } catch (error) {
    // 忽略错误，使用默认值
  }

  return { sessions, tokens, memoryFiles, lastActive, lastSessionId };
}

// 计算进化阶段
function calculateEvolution(growth: number): { stage: EvolutionStage; progress: number } {
  if (growth < 100) return { stage: 'larva', progress: (growth / 100) * 100 };
  if (growth < 500) return { stage: 'juvenile', progress: ((growth - 100) / 400) * 100 };
  if (growth < 2000) return { stage: 'adult', progress: ((growth - 500) / 1500) * 100 };
  if (growth < 5000) return { stage: 'master', progress: ((growth - 2000) / 3000) * 100 };
  return { stage: 'legendary', progress: Math.min(100, ((growth - 5000) / 5000) * 100) };
}

// 计算等级
function calculateLevel(growth: number): number {
  return Math.floor(growth / 100) + 1;
}

// 计算属性
function calculateStats(role: LobsterRole, tokens: number, sessions: number, memoryFiles: number): AgentLobsterState['stats'] {
  const base = Math.min(50, Math.floor(tokens / 10000) + sessions);
  
  return {
    intelligence: Math.min(100, base + 20 + memoryFiles * 2),
    coding: Math.min(100, base + (role === 'dev' ? 30 : 0)),
    planning: Math.min(100, base + (role === 'pm' ? 30 : 0)),
    stability: Math.min(100, base + (role === 'ops' ? 30 : 0)),
    creativity: Math.min(100, base + (role === 'research' || role === 'design' ? 25 : 0)),
    learning: Math.min(100, base + 15),
    neurons: memoryFiles + Math.floor(sessions / 10),
  };
}

// 应用时间衰减（核心函数：计算离线期间的状态变化）
function applyTimeDecay(state: AgentLobsterState, now: Date): void {
  const lastUpdate = new Date(state.timestamps.lastUpdate);
  const elapsedHours = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
  
  if (elapsedHours <= 0) return;
  
  const personality = PERSONALITY_CONFIG[state.personality];
  
  // 饥饿度增长（每小时 +3-5，受性格影响）
  const hungerIncrease = elapsedHours * 4 * personality.hungerRate;
  state.status.hunger = Math.min(100, state.status.hunger + hungerIncrease);
  
  // 能量恢复（每小时 +5，睡觉期间更快）
  const hoursSinceRest = (now.getTime() - new Date(state.timestamps.lastRested).getTime()) / (1000 * 60 * 60);
  const isSleeping = hoursSinceRest > 8; // 超过8小时没休息，视为在"睡觉"
  const energyRecovery = elapsedHours * (isSleeping ? 15 : 5) * personality.energyRecovery;
  state.status.energy = Math.min(100, state.status.energy + energyRecovery);
  
  // 疲劳度自然降低（每小时 -2）
  const fatigueDecay = elapsedHours * 2;
  state.status.fatigue = Math.max(0, state.status.fatigue - fatigueDecay);
  
  // 心情衰减（受最近活跃度影响）
  const hoursSinceActive = (now.getTime() - new Date(state.timestamps.lastActive).getTime()) / (1000 * 60 * 60);
  let moodDecay = elapsedHours * 2 * personality.moodDecay;
  if (hoursSinceActive < 1) {
    // 最近很活跃，心情好
    moodDecay = -elapsedHours * 5; // 心情增加
  } else if (hoursSinceActive > 24) {
    // 超过24小时没用，心情下降更快
    moodDecay += (hoursSinceActive - 24) * 0.5;
  }
  state.status.mood = Math.max(0, Math.min(100, state.status.mood - moodDecay));
  
  // HP 受饥饿和疲劳影响
  if (state.status.hunger > 80 || state.status.fatigue > 90) {
    state.status.hp = Math.max(10, state.status.hp - elapsedHours * 2);
  } else if (state.status.hunger < 30 && state.status.fatigue < 30) {
    state.status.hp = Math.min(100, state.status.hp + elapsedHours * 1);
  }
}

// 应用 OpenClaw 活动影响
function applyActivityImpact(
  state: AgentLobsterState,
  newTokens: number,
  newSessions: number,
  now: Date
): void {
  if (newSessions <= 0 && newTokens <= 0) return;
  
  // 新活动增加经验
  const expGain = newTokens / 1000 + newSessions * 10;
  state.status.growth += expGain;
  state.status.level = calculateLevel(state.status.growth);
  
  // 更新进化阶段
  const evolution = calculateEvolution(state.status.growth);
  state.evolution = evolution;
  
  // 活动消耗能量，增加疲劳
  state.status.energy = Math.max(0, state.status.energy - newSessions * 5);
  state.status.fatigue = Math.min(100, state.status.fatigue + newSessions * 8);
  
  // 最近活动让心情变好
  state.status.mood = Math.min(100, state.status.mood + newSessions * 3 + 5);
  
  // 更新累计数据
  state.totals.tokensConsumed += newTokens;
  state.totals.sessionsCompleted += newSessions;
  
  // 更新属性
  state.stats = calculateStats(state.role, state.openclaw.totalTokens + newTokens, state.openclaw.totalSessions + newSessions, state.stats.neurons);
  
  // 更新时间戳
  state.timestamps.lastActive = now.toISOString();
  
  // 生成当前行为
  const actions = getActionTypes(state.personality, state.role);
  state.currentAction = {
    action: actions[Math.floor(Math.random() * actions.length)],
    since: now.toISOString(),
  };
}

// 获取行为类型
function getActionTypes(personality: LobsterPersonality, role: LobsterRole): string[] {
  const baseActions: Record<LobsterPersonality, string[]> = {
    diligent: ['编写代码', 'Review PR', '学习新技术', '优化性能'],
    lazy: ['休息中', '浏览文档', '思考人生', '喝咖啡'],
    curious: ['探索新库', '阅读源码', '尝试新工具', '研究算法'],
    cautious: ['写测试', '检查配置', '备份数据', '监控告警'],
    adventurous: ['重构代码', '尝试新框架', '挑战难题', '实验性功能'],
    social: ['团队会议', 'Code Review', '写文档', '技术分享'],
  };
  
  const roleActions: Record<LobsterRole, string[]> = {
    main: ['统筹规划', '协调资源', '制定策略'],
    dev: ['写代码', 'Debug', 'Review PR', '写单测'],
    pm: ['写PRD', '需求评审', '排期规划', '数据分析'],
    ops: ['监控告警', '部署发布', '扩容优化', '故障处理'],
    research: ['读论文', '做实验', '写报告', '模型训练'],
    design: ['画原型', '设计评审', '用户研究', '视觉优化'],
    test: ['写用例', '执行测试', 'Bug跟踪', '自动化'],
    other: ['处理杂务', '协助同事', '学习成长'],
  };
  
  return [...baseActions[personality], ...roleActions[role]];
}

// 创建默认状态
function createDefaultState(agentId: string): AgentLobsterState {
  const role = inferRole(agentId);
  const roleConfig = ROLE_CONFIG[role];
  const personality = generatePersonality(role);
  const now = new Date().toISOString();
  
  return {
    agentId,
    name: `${roleConfig.namePrefix}-${agentId.slice(0, 8)}`,
    role,
    personality,
    emoji: roleConfig.emoji,
    color: roleConfig.color,
    status: {
      hp: 80,
      hunger: 30,
      mood: 70,
      energy: 60,
      fatigue: 20,
      growth: 0,
      level: 1,
    },
    stats: {
      intelligence: 20,
      coding: role === 'dev' ? 30 : 10,
      planning: role === 'pm' ? 30 : 10,
      stability: role === 'ops' ? 30 : 10,
      creativity: role === 'research' || role === 'design' ? 25 : 10,
      learning: 15,
      neurons: 0,
    },
    evolution: {
      stage: 'larva',
      progress: 0,
    },
    timestamps: {
      created: now,
      lastUpdate: now,
      lastFed: now,
      lastTrained: now,
      lastRested: now,
      lastActive: now,
    },
    openclaw: {
      totalTokens: 0,
      totalSessions: 0,
      memoryFiles: 0,
    },
    totals: {
      interactions: 0,
      tokensConsumed: 0,
      sessionsCompleted: 0,
    },
  };
}

// 加载 Agent 状态（核心入口函数）
export async function loadAgentState(agentId: string): Promise<AgentLobsterState> {
  await ensureDir();
  
  const statePath = getStateFilePath(agentId);
  let state: AgentLobsterState;
  
  // 尝试加载现有状态
  try {
    const content = await readFile(statePath, 'utf-8');
    state = JSON.parse(content);
    
    // 数据迁移：确保新字段存在
    if (!state.timestamps) {
      const now = new Date().toISOString();
      state.timestamps = {
        created: now,
        lastUpdate: now,
        lastFed: now,
        lastTrained: now,
        lastRested: now,
        lastActive: now,
      };
    }
    if (!state.totals) {
      state.totals = {
        interactions: 0,
        tokensConsumed: 0,
        sessionsCompleted: 0,
      };
    }
    if (!state.currentAction) {
      state.currentAction = {
        action: '准备就绪',
        since: new Date().toISOString(),
      };
    }
  } catch {
    // 状态文件不存在，创建默认状态
    state = createDefaultState(agentId);
  }
  
  const now = new Date();
  
  // 1. 应用时间衰减（离线期间的变化）
  applyTimeDecay(state, now);
  
  // 2. 读取最新 OpenClaw 数据
  const currentData = await readOpenClawData(agentId);
  
  // 3. 检测变化并应用影响
  const newTokens = Math.max(0, currentData.tokens - state.openclaw.totalTokens);
  const newSessions = Math.max(0, currentData.sessions - state.openclaw.totalSessions);
  
  applyActivityImpact(state, newTokens, newSessions, now);
  
  // 4. 更新缓存的 OpenClaw 数据
  state.openclaw = {
    totalTokens: currentData.tokens,
    totalSessions: currentData.sessions,
    memoryFiles: currentData.memoryFiles,
    lastSessionId: currentData.lastSessionId,
  };
  state.stats.neurons = currentData.memoryFiles + Math.floor(currentData.sessions / 10);
  
  // 5. 更新时间戳
  state.timestamps.lastUpdate = now.toISOString();
  
  // 6. 保存更新后的状态
  await saveAgentState(state);
  
  return state;
}

// 保存 Agent 状态
export async function saveAgentState(state: AgentLobsterState): Promise<void> {
  await ensureDir();
  const statePath = getStateFilePath(state.agentId);
  await writeFile(statePath, JSON.stringify(state, null, 2));
}

// 加载所有 Agent 状态
export async function loadAllAgentStates(): Promise<AgentLobsterState[]> {
  await ensureDir();
  
  try {
    // 获取所有 Agent 目录
    const agentsPath = join(OPENCLAW_DIR, 'agents');
    if (!existsSync(agentsPath)) {
      return [];
    }
    
    const { stdout } = await execAsync(`ls -1 ${agentsPath} 2>/dev/null`);
    const agentDirs = stdout.trim().split('\n').filter(Boolean);
    
    const states: AgentLobsterState[] = [];
    for (const agentId of agentDirs) {
      try {
        const state = await loadAgentState(agentId);
        states.push(state);
      } catch (e) {
        console.error(`[agentLobsterState] 加载 ${agentId} 失败:`, e);
      }
    }
    
    // 按等级排序
    states.sort((a, b) => b.status.level - a.status.level);
    
    return states;
  } catch (error) {
    console.error('[agentLobsterState] 加载所有状态失败:', error);
    return [];
  }
}

// 与龙虾互动
export async function interactWithAgent(
  agentId: string,
  action: 'feed' | 'train' | 'rest'
): Promise<{ state: AgentLobsterState; message: string; expGained: number }> {
  const state = await loadAgentState(agentId);
  const now = new Date();
  let message = '';
  let expGained = 0;
  
  switch (action) {
    case 'feed':
      if (state.status.hunger < 10) {
        return { state, message: '🦞 还不饿呢！', expGained: 0 };
      }
      state.status.hunger = Math.max(0, state.status.hunger - 30);
      state.status.mood = Math.min(100, state.status.mood + 10);
      state.status.hp = Math.min(100, state.status.hp + 5);
      state.timestamps.lastFed = now.toISOString();
      message = `🍤 ${state.name} 饱餐一顿！饥饿度 -30，心情 +10`;
      expGained = 10;
      break;
      
    case 'train':
      if (state.status.fatigue >= 80) {
        return { state, message: '😴 太累了，需要先休息！', expGained: 0 };
      }
      if (state.status.energy < 20) {
        return { state, message: '⚡ 能量不足，无法训练！', expGained: 0 };
      }
      state.status.growth += 50;
      state.status.level = calculateLevel(state.status.growth);
      state.status.fatigue = Math.min(100, state.status.fatigue + 20);
      state.status.energy = Math.max(0, state.status.energy - 15);
      state.status.mood = Math.min(100, state.status.mood + 5);
      state.timestamps.lastTrained = now.toISOString();
      
      // 提升属性
      state.stats.learning = Math.min(100, state.stats.learning + 2);
      if (state.role === 'dev') state.stats.coding = Math.min(100, state.stats.coding + 2);
      if (state.role === 'pm') state.stats.planning = Math.min(100, state.stats.planning + 2);
      
      message = `💪 ${state.name} 训练完成！成长 +50，疲劳 +20`;
      expGained = 30;
      
      // 检查进化
      const evolution = calculateEvolution(state.status.growth);
      if (evolution.stage !== state.evolution.stage) {
        state.evolution = evolution;
        message += `\n🎉 ${state.name} 进化到了 ${evolution.stage} 阶段！`;
      }
      break;
      
    case 'rest':
      state.status.fatigue = Math.max(0, state.status.fatigue - 40);
      state.status.energy = Math.min(100, state.status.energy + 30);
      state.status.mood = Math.min(100, state.status.mood + 5);
      state.timestamps.lastRested = now.toISOString();
      message = `😴 ${state.name} 休息完毕！疲劳 -40，能量 +30`;
      expGained = 5;
      break;
  }
  
  // 更新进化进度
  state.evolution = calculateEvolution(state.status.growth);
  
  // 更新互动统计
  state.totals.interactions++;
  state.timestamps.lastUpdate = now.toISOString();
  
  // 保存状态
  await saveAgentState(state);
  
  return { state, message, expGained };
}

// 获取状态摘要（用于Dashboard）
export async function getAgentsSummary(): Promise<{
  total: number;
  avgLevel: number;
  totalTokens: number;
  activeToday: number;
  needsAttention: string[]; // 需要关注的agentId列表
}> {
  const states = await loadAllAgentStates();
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  let totalTokens = 0;
  let activeToday = 0;
  const needsAttention: string[] = [];
  
  for (const state of states) {
    totalTokens += state.openclaw.totalTokens;
    
    // 检查今日活跃
    if (state.timestamps.lastActive.startsWith(today)) {
      activeToday++;
    }
    
    // 检查是否需要关注（饥饿、疲劳、心情低落）
    if (state.status.hunger > 70 || state.status.fatigue > 80 || state.status.mood < 30) {
      needsAttention.push(state.agentId);
    }
  }
  
  return {
    total: states.length,
    avgLevel: states.length > 0 ? states.reduce((sum, s) => sum + s.status.level, 0) / states.length : 0,
    totalTokens,
    activeToday,
    needsAttention,
  };
}
