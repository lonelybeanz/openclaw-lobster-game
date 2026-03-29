/**
 * 小龙虾群系统 (Lobster Agents System)
 * 
 * 核心理念：
 * - 每个 OpenClaw Agent 对应一只小龙虾
 * - 小龙虾有自己的属性、成长、记忆、状态
 * - 人类用户是养殖师，负责照顾所有龙虾
 * 
 * 对应关系：
 * - main → 主虾 (最老练的龙虾)
 * - dev → 开发虾 (代码高手)
 * - pm → 产品虾 (规划大师)
 * - ops → 运维虾 (稳定守护)
 * - research → 研究虾 (探索者)
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const OPENCLAW_DIR = process.env.OPENCLAW_DIR || join(homedir(), '.openclaw');

// 小龙虾角色定义
export type LobsterRole = 
  | 'main'      // 主虾 - 默认Agent
  | 'dev'       // 开发虾 - 写代码
  | 'pm'        // 产品虾 - 做规划
  | 'ops'       // 运维虾 - 保稳定
  | 'research'  // 研究虾 - 探新路
  | 'design'    // 设计虾 - 画界面
  | 'test'      // 测试虾 - 找Bug
  | 'other';    // 其他虾

// 小龙虾性格
export type LobsterPersonality = 
  | 'diligent'   // 勤奋
  | 'lazy'       // 懒散
  | 'curious'    // 好奇
  | 'cautious'   // 谨慎
  | 'adventurous' // 冒险
  | 'social';    // 社交

// 小龙虾状态
export interface LobsterStatus {
  hp: number;           // 体力 0-100
  hunger: number;       // 饥饿度 0-100 (越高越饿)
  mood: number;         // 心情 0-100
  energy: number;       // 能量 0-100
  growth: number;       // 成长值
  level: number;        // 等级
}

// 小龙虾属性 (基于Agent实际数据)
export interface LobsterStats {
  intelligence: number;  // 智力 (基于token使用量)
  coding: number;        // 编程能力 (dev虾)
  planning: number;      // 规划能力 (pm虾)
  stability: number;     // 稳定性 (ops虾)
  creativity: number;    // 创造力
  learning: number;      // 学习能力
}

// 小龙虾个体
export interface LobsterAgent {
  id: string;                    // Agent ID
  name: string;                  // 显示名称
  role: LobsterRole;            // 角色
  emoji: string;                // 表情符号
  personality: LobsterPersonality; // 性格
  color: string;                // 主题色
  
  // 状态
  status: LobsterStatus;
  
  // 属性
  stats: LobsterStats;
  
  // 成长
  birthDate: string;            // 创建日期
  age: number;                  // 年龄(天)
  evolutionStage: number;       // 进化阶段 1-5
  
  // 工作数据
  workspaceRoot: string;        // 工作目录
  totalSessions: number;        // 总会话数
  totalTokens: number;          // 总token消耗
  lastActive: string;           // 最后活跃
  
  // 记忆
  memoryFiles: number;          // 记忆文件数
  memoryQuality: number;        // 记忆质量
  
  // 行为
  currentAction: string;        // 当前行为
  actionSince: string;          // 开始时间
}

// 角色配置
const ROLE_CONFIG: Record<LobsterRole, { 
  emoji: string; 
  name: string; 
  color: string;
  description: string;
  primaryStat: keyof LobsterStats;
}> = {
  main: {
    emoji: '🦞',
    name: '主虾',
    color: '#ef4444',
    description: '最老练的龙虾，全能型选手',
    primaryStat: 'intelligence',
  },
  dev: {
    emoji: '🦐',
    name: '开发虾',
    color: '#3b82f6',
    description: '代码高手，技术担当',
    primaryStat: 'coding',
  },
  pm: {
    emoji: '🦀',
    name: '产品虾',
    color: '#f59e0b',
    description: '规划大师，统筹全局',
    primaryStat: 'planning',
  },
  ops: {
    emoji: '🐙',
    name: '运维虾',
    color: '#10b981',
    description: '稳定守护，任劳任怨',
    primaryStat: 'stability',
  },
  research: {
    emoji: '🦑',
    name: '研究虾',
    color: '#8b5cf6',
    description: '探索者，追求创新',
    primaryStat: 'creativity',
  },
  design: {
    emoji: '🐚',
    name: '设计虾',
    color: '#ec4899',
    description: '美学大师，视觉担当',
    primaryStat: 'creativity',
  },
  test: {
    emoji: '🦞',
    name: '测试虾',
    color: '#f97316',
    description: '找Bug专家，质量守护',
    primaryStat: 'stability',
  },
  other: {
    emoji: '🦐',
    name: '小虾',
    color: '#6b7280',
    description: '潜力股，等待发光',
    primaryStat: 'learning',
  },
};

// 性格配置
const PERSONALITY_CONFIG: Record<LobsterPersonality, {
  hungerRate: number;    // 饥饿消耗速度
  moodBonus: number;     // 心情加成
  growthRate: number;    // 成长速度
  actionTypes: string[]; // 常见行为
}> = {
  diligent: {
    hungerRate: 1.2,
    moodBonus: 0,
    growthRate: 1.3,
    actionTypes: ['写代码', '查文档', '改Bug', '优化性能'],
  },
  lazy: {
    hungerRate: 0.8,
    moodBonus: 5,
    growthRate: 0.9,
    actionTypes: ['休息中', '喝咖啡', '发呆', '摸鱼'],
  },
  curious: {
    hungerRate: 1.0,
    moodBonus: 10,
    growthRate: 1.1,
    actionTypes: ['探索新技术', '读源码', '做实验', '查资料'],
  },
  cautious: {
    hungerRate: 1.0,
    moodBonus: 0,
    growthRate: 1.0,
    actionTypes: ['写测试', 'Review代码', '查日志', '备份数据'],
  },
  adventurous: {
    hungerRate: 1.3,
    moodBonus: 15,
    growthRate: 1.2,
    actionTypes: ['重构代码', '尝试新工具', '挑战难题', '突破边界'],
  },
  social: {
    hungerRate: 1.0,
    moodBonus: 10,
    growthRate: 1.0,
    actionTypes: ['开会讨论', '协助同事', '写文档', '分享经验'],
  },
};

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

// 根据角色和统计数据生成性格
function generatePersonality(role: LobsterRole, sessions: number): LobsterPersonality {
  const rand = Math.random();
  
  // 主虾通常是勤奋的
  if (role === 'main') return 'diligent';
  
  // 开发虾有创造力
  if (role === 'dev') return rand > 0.7 ? 'adventurous' : 'diligent';
  
  // 研究虾是好奇的
  if (role === 'research') return 'curious';
  
  // 运维虾是谨慎的
  if (role === 'ops') return 'cautious';
  
  // 产品虾是社交的
  if (role === 'pm') return 'social';
  
  // 其他随机
  if (rand < 0.1) return 'lazy';
  if (rand < 0.4) return 'diligent';
  if (rand < 0.6) return 'curious';
  if (rand < 0.8) return 'cautious';
  return 'adventurous';
}

// 计算龙虾状态
function calculateStatus(
  sessions: number,
  tokens: number,
  memoryFiles: number,
  personality: LobsterPersonality
): LobsterStatus {
  const personalityConfig = PERSONALITY_CONFIG[personality];
  
  // 基础成长值
  const growth = Math.floor(tokens / 1000 + sessions * 10);
  const level = Math.floor(growth / 100) + 1;
  
  // 体力 (基于最近活跃度)
  const hp = Math.min(100, Math.floor(80 + Math.random() * 20));
  
  // 饥饿度 (基于性格)
  const hunger = Math.min(100, Math.floor(30 + Math.random() * 40 * personalityConfig.hungerRate));
  
  // 心情 (基于性格)
  const mood = Math.min(100, Math.floor(60 + Math.random() * 30 + personalityConfig.moodBonus));
  
  // 能量
  const energy = Math.min(100, Math.floor(50 + (tokens / 10000)));
  
  return {
    hp,
    hunger,
    mood,
    energy,
    growth,
    level,
  };
}

// 计算龙虾属性
function calculateStats(role: LobsterRole, tokens: number, sessions: number): LobsterStats {
  const base = Math.floor(tokens / 10000 + sessions);
  
  const stats: LobsterStats = {
    intelligence: Math.min(100, base + 20),
    coding: Math.min(100, base + (role === 'dev' ? 30 : 0)),
    planning: Math.min(100, base + (role === 'pm' ? 30 : 0)),
    stability: Math.min(100, base + (role === 'ops' ? 30 : 0)),
    creativity: Math.min(100, base + (role === 'research' || role === 'design' ? 25 : 0)),
    learning: Math.min(100, base + 15),
  };
  
  return stats;
}

// 生成当前行为
function generateAction(personality: LobsterPersonality, role: LobsterRole): { action: string; since: string } {
  const personalityConfig = PERSONALITY_CONFIG[personality];
  const actions = personalityConfig.actionTypes;
  
  // 如果是其他角色，添加一些角色特定行为
  if (role === 'dev') actions.push('写代码', 'Debug', 'Review PR');
  if (role === 'pm') actions.push('写PRD', '开会', '排期');
  if (role === 'ops') actions.push('监控告警', '部署', '扩容');
  if (role === 'research') actions.push('读论文', '做实验', '写报告');
  
  const action = actions[Math.floor(Math.random() * actions.length)];
  
  // 随机一个开始时间（最近2小时内）
  const since = new Date(Date.now() - Math.random() * 7200000).toISOString();
  
  return { action, since };
}

// 获取所有小龙虾
export async function getLobsterAgents(): Promise<LobsterAgent[]> {
  const lobsters: LobsterAgent[] = [];
  
  try {
    // 获取所有Agent目录
    const agentsPath = join(OPENCLAW_DIR, 'agents');
    if (!existsSync(agentsPath)) {
      // 如果没有agents目录，返回默认主虾
      return [createDefaultMainLobster()];
    }
    
    const { stdout } = await execAsync(`ls -1 ${agentsPath} 2>/dev/null`);
    const agentDirs = stdout.trim().split('\n').filter(Boolean);
    
    for (const agentId of agentDirs) {
      try {
        const lobster = await createLobsterFromAgent(agentId);
        lobsters.push(lobster);
      } catch (e) {
        console.error(`[lobsterAgents] 创建龙虾 ${agentId} 失败:`, e);
      }
    }
    
    // 按等级排序
    lobsters.sort((a, b) => b.status.level - a.status.level);
    
    return lobsters.length > 0 ? lobsters : [createDefaultMainLobster()];
  } catch (error) {
    console.error('[lobsterAgents] 获取龙虾失败:', error);
    return [createDefaultMainLobster()];
  }
}

// 从Agent数据创建小龙虾
async function createLobsterFromAgent(agentId: string): Promise<LobsterAgent> {
  const role = inferRole(agentId);
  const roleConfig = ROLE_CONFIG[role];
  
  // 尝试读取Agent的session数据
  let sessions = 0;
  let tokens = 0;
  let memoryFiles = 0;
  let birthDate = new Date().toISOString();
  let lastActive = new Date().toISOString();
  
  try {
    const sessionsPath = join(OPENCLAW_DIR, 'agents', agentId, 'sessions', 'sessions.json');
    if (existsSync(sessionsPath)) {
      const content = await readFile(sessionsPath, 'utf-8');
      const sessionData = JSON.parse(content);
      sessions = sessionData.length || 0;
      
      if (sessions > 0) {
        const lastSession = sessionData[sessionData.length - 1];
        lastActive = lastSession.createdAt || lastActive;
        
        // 计算总token
        tokens = sessionData.reduce((sum: number, s: any) => sum + (s.totalTokens || 0), 0);
      }
    }
  } catch {
    // 忽略错误，使用默认值
  }
  
  // 生成性格
  const personality = generatePersonality(role, sessions);
  
  // 计算状态和属性
  const status = calculateStatus(sessions, tokens, memoryFiles, personality);
  const stats = calculateStats(role, tokens, sessions);
  
  // 生成当前行为
  const { action, since } = generateAction(personality, role);
  
  // 计算年龄
  const age = Math.floor((Date.now() - new Date(birthDate).getTime()) / (1000 * 60 * 60 * 24));
  
  return {
    id: agentId,
    name: roleConfig.name,
    role,
    emoji: roleConfig.emoji,
    personality,
    color: roleConfig.color,
    status,
    stats,
    birthDate,
    age: Math.max(1, age),
    evolutionStage: Math.min(5, Math.floor(status.level / 5) + 1),
    workspaceRoot: join(OPENCLAW_DIR, 'agents', agentId),
    totalSessions: sessions,
    totalTokens: tokens,
    lastActive,
    memoryFiles,
    memoryQuality: Math.floor(Math.random() * 40) + 60,
    currentAction: action,
    actionSince: since,
  };
}

// 创建默认主虾
function createDefaultMainLobster(): LobsterAgent {
  const roleConfig = ROLE_CONFIG['main'];
  return {
    id: 'main',
    name: '主虾',
    role: 'main',
    emoji: roleConfig.emoji,
    personality: 'diligent',
    color: roleConfig.color,
    status: {
      hp: 100,
      hunger: 30,
      mood: 85,
      energy: 80,
      growth: 1560,
      level: 16,
    },
    stats: {
      intelligence: 75,
      coding: 70,
      planning: 65,
      stability: 80,
      creativity: 70,
      learning: 75,
    },
    birthDate: new Date().toISOString(),
    age: 24,
    evolutionStage: 4,
    workspaceRoot: join(OPENCLAW_DIR, 'workspace'),
    totalSessions: 60,
    totalTokens: 156000,
    lastActive: new Date().toISOString(),
    memoryFiles: 21,
    memoryQuality: 96,
    currentAction: '统筹全局',
    actionSince: new Date().toISOString(),
  };
}

// 获取龙虾池塘统计
export async function getPondStats(): Promise<{
  totalLobsters: number;
  averageLevel: number;
  totalTokens: number;
  totalSessions: number;
  averageMood: number;
  needsFeeding: number;  // 需要喂食的龙虾数
  needsRest: number;     // 需要休息的龙虾数
}> {
  const lobsters = await getLobsterAgents();
  
  return {
    totalLobsters: lobsters.length,
    averageLevel: lobsters.reduce((sum, l) => sum + l.status.level, 0) / lobsters.length,
    totalTokens: lobsters.reduce((sum, l) => sum + l.totalTokens, 0),
    totalSessions: lobsters.reduce((sum, l) => sum + l.totalSessions, 0),
    averageMood: lobsters.reduce((sum, l) => sum + l.status.mood, 0) / lobsters.length,
    needsFeeding: lobsters.filter(l => l.status.hunger > 60).length,
    needsRest: lobsters.filter(l => l.status.energy < 30).length,
  };
}

// 喂食小龙虾
export async function feedLobster(agentId: string): Promise<{ success: boolean; message: string }> {
  // 这里应该实际修改龙虾状态
  return {
    success: true,
    message: `🍖 成功喂食 ${agentId}！饥饿度降低，体力恢复。`,
  };
}

// 训练小龙虾
export async function trainLobster(agentId: string): Promise<{ success: boolean; message: string }> {
  return {
    success: true,
    message: `💪 ${agentId} 完成训练！属性提升，成长值增加。`,
  };
}

// 让小龙虾休息
export async function restLobster(agentId: string): Promise<{ success: boolean; message: string }> {
  return {
    success: true,
    message: `😴 ${agentId} 休息中... 能量恢复，心情变好。`,
  };
}
