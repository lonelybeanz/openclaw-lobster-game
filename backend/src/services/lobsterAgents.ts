/**
 * Lobster Agents Service
 * 
 * 管理小龙虾群的核心服务
 * 现在使用 agentLobsterState.ts 进行状态持久化
 */

import { join } from 'path';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  AgentLobsterState,
  loadAgentState,
  loadAllAgentStates,
  interactWithAgent,
  getAgentsSummary,
  LobsterRole,
  LobsterPersonality,
  EvolutionStage,
} from './agentLobsterState';

const execAsync = promisify(exec);
const OPENCLAW_DIR = process.env.OPENCLAW_DIR || '/Users/moltbot/.openclaw';

// 重新导出类型，保持向后兼容
export type { AgentLobsterState as LobsterAgent, LobsterRole, LobsterPersonality, EvolutionStage };

// 前端兼容的数据格式
export interface FrontendLobsterAgent {
  id: string;
  name: string;
  role: LobsterRole;
  emoji: string;
  personality: LobsterPersonality;
  color: string;
  status: {
    hp: number;
    hunger: number;
    mood: number;
    energy: number;
    growth: number;
    level: number;
  };
  stats: {
    intelligence: number;
    coding: number;
    planning: number;
    stability: number;
    creativity: number;
    learning: number;
  };
  fatigue: number;
  evolution: {
    stage: EvolutionStage;
    progress: number;
  };
  birthDate: string;
  age: number;
  evolutionStage: number;
  workspaceRoot: string;
  totalSessions: number;
  totalTokens: number;
  lastActive: string;
  memoryFiles: number;
  memoryQuality: number;
  currentAction: string;
  actionSince: string;
}

// 转换新状态为前端格式
function toFrontendFormat(state: AgentLobsterState): FrontendLobsterAgent {
  const stageNumber: Record<EvolutionStage, number> = {
    larva: 1,
    juvenile: 2,
    adult: 3,
    master: 4,
    legendary: 5,
  };
  
  const daysSince = (date: string) => 
    Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
  
  return {
    id: state.agentId,
    name: state.name,
    role: state.role,
    emoji: state.emoji,
    personality: state.personality,
    color: state.color,
    status: {
      hp: Math.round(state.status.hp),
      hunger: Math.round(state.status.hunger),
      mood: Math.round(state.status.mood),
      energy: Math.round(state.status.energy),
      growth: Math.round(state.status.growth),
      level: state.status.level,
    },
    stats: {
      intelligence: state.stats.intelligence,
      coding: state.stats.coding,
      planning: state.stats.planning,
      stability: state.stats.stability,
      creativity: state.stats.creativity,
      learning: state.stats.learning,
    },
    fatigue: Math.round(state.status.fatigue),
    evolution: state.evolution,
    birthDate: state.timestamps.created,
    age: daysSince(state.timestamps.created),
    evolutionStage: stageNumber[state.evolution.stage],
    workspaceRoot: `/Users/moltbot/.openclaw/agents/${state.agentId}`,
    totalSessions: state.openclaw.totalSessions,
    totalTokens: state.openclaw.totalTokens,
    lastActive: state.timestamps.lastActive,
    memoryFiles: state.openclaw.memoryFiles,
    memoryQuality: Math.round(state.status.mood * 0.8 + state.stats.intelligence * 0.2),
    currentAction: state.currentAction?.action || '休息中',
    actionSince: state.currentAction?.since || state.timestamps.lastActive,
  };
}

// 角色配置（供外部使用）
export const ROLE_CONFIG: Record<LobsterRole, { name: string; emoji: string; color: string; description: string }> = {
  main: {
    name: '主虾',
    emoji: '🦞',
    color: '#FF6B6B',
    description: '统筹全局的核心龙虾',
  },
  dev: {
    name: '开发虾',
    emoji: '👨‍💻',
    color: '#4ECDC4',
    description: '专注代码实现',
  },
  pm: {
    name: '产品虾',
    emoji: '📊',
    color: '#FFE66D',
    description: '负责需求规划',
  },
  ops: {
    name: '运维虾',
    emoji: '🔧',
    color: '#95E1D3',
    description: '保障系统稳定',
  },
  research: {
    name: '研究虾',
    emoji: '🔬',
    color: '#C7CEEA',
    description: '探索前沿技术',
  },
  design: {
    name: '设计虾',
    emoji: '🎨',
    color: '#F8A5C2',
    description: '负责用户体验',
  },
  test: {
    name: '测试虾',
    emoji: '🧪',
    color: '#B8B8D1',
    description: '保证质量',
  },
  other: {
    name: '小弟虾',
    emoji: '🦐',
    color: '#FFD93D',
    description: '辅助支持',
  },
};

// 性格配置
export const PERSONALITY_CONFIG: Record<LobsterPersonality, {
  name: string;
  description: string;
  hungerRate: number;
  moodBonus: number;
  growthRate: number;
  actionTypes: string[];
}> = {
  diligent: {
    name: '勤奋',
    description: '工作努力，但容易疲劳',
    hungerRate: 1.2,
    moodBonus: 5,
    growthRate: 1.3,
    actionTypes: ['编写代码', 'Review PR', '学习新技术', '优化性能'],
  },
  lazy: {
    name: '慵懒',
    description: '喜欢休息，但恢复力强',
    hungerRate: 0.8,
    moodBonus: 0,
    growthRate: 0.8,
    actionTypes: ['休息中', '浏览文档', '思考人生', '喝咖啡'],
  },
  curious: {
    name: '好奇',
    description: '喜欢探索新知识',
    hungerRate: 1.0,
    moodBonus: 10,
    growthRate: 1.1,
    actionTypes: ['探索新库', '阅读源码', '尝试新工具', '研究算法'],
  },
  cautious: {
    name: '谨慎',
    description: '稳扎稳打，风险厌恶',
    hungerRate: 0.9,
    moodBonus: 5,
    growthRate: 1.0,
    actionTypes: ['写测试', '检查配置', '备份数据', '监控告警'],
  },
  adventurous: {
    name: '冒险',
    description: '勇于尝试，但容易出错',
    hungerRate: 1.1,
    moodBonus: 15,
    growthRate: 1.2,
    actionTypes: ['重构代码', '尝试新框架', '挑战难题', '实验性功能'],
  },
  social: {
    name: '社交',
    description: '善于协作沟通',
    hungerRate: 1.0,
    moodBonus: 10,
    growthRate: 1.0,
    actionTypes: ['团队会议', 'Code Review', '写文档', '技术分享'],
  },
};

// 进化阶段配置
export const EVOLUTION_STAGES: Record<EvolutionStage, {
  name: string;
  emoji: string;
  description: string;
  minGrowth: number;
}> = {
  larva: {
    name: '幼虾',
    emoji: '🦐',
    description: '刚孵化的小龙虾，需要细心照料',
    minGrowth: 0,
  },
  juvenile: {
    name: '成长期',
    emoji: '🦞',
    description: '正在快速成长的龙虾',
    minGrowth: 100,
  },
  adult: {
    name: '成虾',
    emoji: '🦀',
    description: '已经成熟，可以独当一面',
    minGrowth: 500,
  },
  master: {
    name: '大师',
    emoji: '🐙',
    description: '经验丰富的龙虾大师',
    minGrowth: 2000,
  },
  legendary: {
    name: '传说',
    emoji: '🐉',
    description: '传说中的存在',
    minGrowth: 5000,
  },
};

/**
 * 获取所有小龙虾（主入口）
 * 现在使用持久化状态，每次调用都会：
 * 1. 应用时间衰减（计算离线期间的变化）
 * 2. 检测新的 OpenClaw 活动
 * 3. 更新并保存状态
 */
export async function getLobsterAgents(): Promise<FrontendLobsterAgent[]> {
  try {
    const agents = await loadAllAgentStates();
    
    // 如果没有agent，尝试从OpenClaw目录扫描
    if (agents.length === 0) {
      const scannedAgents = await scanOpenClawAgents();
      if (scannedAgents.length === 0) {
        // 返回默认主虾
        return [toFrontendFormat(await loadAgentState('default'))];
      }
      return scannedAgents.map(toFrontendFormat);
    }
    
    return agents.map(toFrontendFormat);
  } catch (error) {
    console.error('[lobsterAgents] 获取龙虾失败:', error);
    return [toFrontendFormat(await loadAgentState('default'))];
  }
}

/**
 * 扫描 OpenClaw agents 目录
 */
async function scanOpenClawAgents(): Promise<AgentLobsterState[]> {
  try {
    const agentsPath = join(OPENCLAW_DIR, 'agents');
    if (!existsSync(agentsPath)) {
      return [];
    }
    
    const { stdout } = await execAsync(`ls -1 ${agentsPath} 2>/dev/null`);
    const agentDirs = stdout.trim().split('\n').filter(Boolean);
    
    const agents: AgentLobsterState[] = [];
    for (const agentId of agentDirs) {
      try {
        const state = await loadAgentState(agentId);
        agents.push(state);
      } catch (e) {
        console.error(`[lobsterAgents] 扫描 ${agentId} 失败:`, e);
      }
    }
    
    return agents.sort((a, b) => b.status.level - a.status.level);
  } catch (error) {
    console.error('[lobsterAgents] 扫描失败:', error);
    return [];
  }
}

/**
 * 获取单只龙虾
 */
export async function getLobsterAgent(agentId: string): Promise<FrontendLobsterAgent | null> {
  try {
    const state = await loadAgentState(agentId);
    return toFrontendFormat(state);
  } catch (error) {
    console.error(`[lobsterAgents] 获取 ${agentId} 失败:`, error);
    return null;
  }
}

/**
 * 与龙虾互动
 */
export async function interactWithLobster(
  agentId: string,
  action: 'feed' | 'train' | 'rest'
): Promise<{ success: boolean; state?: FrontendLobsterAgent; message: string; expGained: number }> {
  try {
    const result = await interactWithAgent(agentId, action);
    return {
      success: true,
      state: toFrontendFormat(result.state),
      message: result.message,
      expGained: result.expGained,
    };
  } catch (error) {
    console.error(`[lobsterAgents] 互动失败:`, error);
    return {
      success: false,
      message: '互动失败，请重试',
      expGained: 0,
    };
  }
}

/**
 * 获取龙虾群统计
 */
export async function getLobsterStats(): Promise<{
  total: number;
  avgLevel: number;
  totalTokens: number;
  totalSessions: number;
  activeToday: number;
  needsAttention: number;
  evolutionDistribution: Record<EvolutionStage, number>;
  roleDistribution: Record<LobsterRole, number>;
}> {
  const agents = await getLobsterAgents();
  const summary = await getAgentsSummary();
  
  const evolutionDistribution: Record<EvolutionStage, number> = {
    larva: 0,
    juvenile: 0,
    adult: 0,
    master: 0,
    legendary: 0,
  };
  
  const roleDistribution: Record<LobsterRole, number> = {
    main: 0,
    dev: 0,
    pm: 0,
    ops: 0,
    research: 0,
    design: 0,
    test: 0,
    other: 0,
  };
  
  let totalTokens = 0;
  let totalSessions = 0;
  
  for (const agent of agents) {
    evolutionDistribution[agent.evolution.stage]++;
    roleDistribution[agent.role]++;
    totalTokens += agent.totalTokens;
    totalSessions += agent.totalSessions;
  }
  
  return {
    total: agents.length,
    avgLevel: summary.avgLevel,
    totalTokens,
    totalSessions,
    activeToday: summary.activeToday,
    needsAttention: summary.needsAttention.length,
    evolutionDistribution,
    roleDistribution,
  };
}

/**
 * 获取活跃龙虾（最近24小时有活动）
 */
export async function getActiveLobsters(hours: number = 24): Promise<FrontendLobsterAgent[]> {
  const agents = await loadAllAgentStates();
  const now = Date.now();
  const threshold = hours * 60 * 60 * 1000;
  
  return agents
    .filter(agent => {
      const lastActive = new Date(agent.timestamps.lastActive).getTime();
      return (now - lastActive) < threshold;
    })
    .map(toFrontendFormat);
}

/**
 * 获取需要关注的龙虾（饥饿/疲劳/心情低落）
 */
export async function getNeedyLobsters(): Promise<FrontendLobsterAgent[]> {
  const agents = await loadAllAgentStates();
  
  return agents
    .filter(agent => {
      return agent.status.hunger > 70 ||
             agent.status.fatigue > 80 ||
             agent.status.mood < 30 ||
             agent.status.hp < 30;
    })
    .map(toFrontendFormat);
}

/**
 * 获取进化排行榜
 */
export async function getEvolutionLeaderboard(limit: number = 10): Promise<FrontendLobsterAgent[]> {
  const agents = await loadAllAgentStates();
  
  return agents
    .sort((a, b) => {
      // 先按进化阶段排序
      const stageOrder = ['legendary', 'master', 'adult', 'juvenile', 'larva'];
      const stageDiff = stageOrder.indexOf(a.evolution.stage) - stageOrder.indexOf(b.evolution.stage);
      if (stageDiff !== 0) return stageDiff;
      
      // 同阶段按成长值排序
      return b.status.growth - a.status.growth;
    })
    .slice(0, limit)
    .map(toFrontendFormat);
}

/**
 * 格式化年龄显示
 */
export function formatAge(createdDate: string): string {
  const days = Math.floor((Date.now() - new Date(createdDate).getTime()) / (1000 * 60 * 60 * 24));
  if (days < 1) return '今天刚出生';
  if (days === 1) return '1 天';
  if (days < 30) return `${days} 天`;
  if (days < 365) return `${Math.floor(days / 30)} 个月`;
  return `${Math.floor(days / 365)} 年`;
}

/**
 * 格式化最后活跃时间
 */
export function formatLastActive(lastActiveDate: string): string {
  const diff = Date.now() - new Date(lastActiveDate).getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days === 1) return '昨天';
  return `${days} 天前`;
}

/**
 * 获取状态颜色
 */
export function getStatusColor(value: number): string {
  if (value >= 80) return '#4CAF50'; // 绿色
  if (value >= 50) return '#FFC107'; // 黄色
  if (value >= 30) return '#FF9800'; // 橙色
  return '#F44336'; // 红色
}

/**
 * 获取状态描述
 */
export function getStatusDescription(value: number): string {
  if (value >= 80) return '优秀';
  if (value >= 50) return '良好';
  if (value >= 30) return '一般';
  return '危险';
}

// ============================================
// 兼容层 - 为 app.ts 提供旧版 API
// ============================================

/** 兼容：获取池塘统计 */
export async function getPondStats(): Promise<{
  totalLobsters: number;
  totalTokens: number;
  totalSessions: number;
  avgLevel: number;
  activeToday: number;
  needsAttention: number;
}> {
  const stats = await getLobsterStats();
  return {
    totalLobsters: stats.total,
    totalTokens: stats.totalTokens,
    totalSessions: stats.totalSessions,
    avgLevel: stats.avgLevel,
    activeToday: stats.activeToday,
    needsAttention: stats.needsAttention,
  };
}

/** 兼容：喂食 */
export async function feedLobster(agentId: string): Promise<{
  success: boolean;
  lobster?: FrontendLobsterAgent;
  message: string;
  expGained: number;
}> {
  return interactWithLobster(agentId, 'feed');
}

/** 兼容：训练 */
export async function trainLobster(agentId: string): Promise<{
  success: boolean;
  lobster?: FrontendLobsterAgent;
  message: string;
  expGained: number;
}> {
  return interactWithLobster(agentId, 'train');
}

/** 兼容：休息 */
export async function restLobster(agentId: string): Promise<{
  success: boolean;
  lobster?: FrontendLobsterAgent;
  message: string;
  expGained: number;
}> {
  return interactWithLobster(agentId, 'rest');
}
