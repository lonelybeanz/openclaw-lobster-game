/**
 * OCC 游戏化仪表盘数据服务
 * 将 OpenClaw Control Center 的卡片数据转换为游戏化指标
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type {
  LobsterHealthMetrics,
  EnergyCoreMetrics,
  StaffTeamMetrics,
  EvolutionTreeMetrics,
  MemoryPalaceMetrics,
  HandbookMetrics,
  TaskBoardMetrics,
  FacilityStatus,
  GameDashboardSnapshot,
  StaffMember,
  EvolutionNode,
  MemoryFragment,
  LobsterTask,
  HandbookSection,
  HealthStatus,
  EvolutionStage,
} from '../types/dashboard.js';
import { getTokenStats } from './tokenStats';
import { getMemoryScore } from './memoryScore';
import { loadLobsterState } from './persistence';
import { computeLobsterState } from './lobsterStateEngine';

const execAsync = promisify(exec);

// OpenClaw 配置目录
const OPENCLAW_DIR = process.env.OPENCLAW_DIR || join(homedir(), '.openclaw');

// ============================================
// 1. 龙虾健康仪表盘 (Overview → Health)
// ============================================

interface SystemMetrics {
  cpu: number;
  memory: number;
  uptime: number;
}

async function getSystemMetrics(): Promise<SystemMetrics> {
  try {
    // 获取系统负载
    const { stdout: loadavg } = await execAsync('uptime');
    const loadMatch = loadavg.match(/load averages?:\s*([\d.]+)/i);
    const cpu = loadMatch ? parseFloat(loadMatch[1]) : 0;

    // 获取内存使用
    const { stdout: meminfo } = await execAsync('ps -o rss= -p $$');
    const memoryMB = parseInt(meminfo.trim(), 10) / 1024;
    const memoryPercent = Math.min(100, (memoryMB / 1024) * 100); // 假设 1GB 为基准

    // 获取运行时间 (从 OpenClaw 启动时间计算)
    let uptime = 0;
    try {
      const { stdout: openclawStatus } = await execAsync('openclaw status 2>/dev/null || echo "{}"');
      const status = JSON.parse(openclawStatus);
      uptime = status.uptime || 0;
    } catch {
      // 使用项目创建时间作为备选
      const openclawJsonPath = join(OPENCLAW_DIR, 'openclaw.json');
      if (existsSync(openclawJsonPath)) {
        const content = await readFile(openclawJsonPath, 'utf-8');
        const config = JSON.parse(content);
        const createdAt = config.createdAt ? new Date(config.createdAt) : null;
        if (createdAt) {
          uptime = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        }
      }
    }

    return {
      cpu: Math.min(100, cpu * 10), // 转换为百分比
      memory: memoryPercent,
      uptime,
    };
  } catch (error) {
    console.error('[gameDashboard] getSystemMetrics failed:', error);
    return { cpu: 0, memory: 0, uptime: 0 };
  }
}

function calculateHealthStatus(cpu: number, memory: number): HealthStatus {
  const avg = (cpu + memory) / 2;
  if (avg < 30) return 'excellent';
  if (avg < 60) return 'good';
  if (avg < 80) return 'warning';
  return 'critical';
}

function generateHealthTips(status: HealthStatus, cpu: number, memory: number): string[] {
  const tips: string[] = [];
  
  if (status === 'excellent') {
    tips.push('🌟 系统状态极佳，龙虾活力满满！');
  } else if (status === 'good') {
    tips.push('✨ 系统运行良好，保持这个节奏~');
  } else if (status === 'warning') {
    tips.push('⚠️ 系统负载较高，建议让龙虾休息一下');
  } else {
    tips.push('🚨 系统负载过高！请立即让龙虾休息');
    tips.push('💡 建议：关闭一些不必要的进程');
  }

  if (cpu > 70) tips.push('🔥 CPU 使用率较高');
  if (memory > 70) tips.push('💾 内存占用较大');
  
  return tips;
}

export async function getHealthMetrics(): Promise<LobsterHealthMetrics> {
  const [system, lobsterState] = await Promise.all([
    getSystemMetrics(),
    loadLobsterState(),
  ]);

  const status = calculateHealthStatus(system.cpu, system.memory);
  
  return {
    hp: {
      current: Math.floor(100 - system.memory),
      max: 100,
      percentage: Math.floor(100 - system.memory),
    },
    stamina: {
      current: Math.floor(100 - system.cpu),
      max: 100,
      percentage: Math.floor(100 - system.cpu),
    },
    uptimeDays: system.uptime,
    overallStatus: status,
    healthTips: generateHealthTips(status, system.cpu, system.memory),
    loadHistory: [
      { timestamp: new Date().toISOString(), cpu: system.cpu, memory: system.memory },
    ],
  };
}

// ============================================
// 2. 能量核心 (Usage → Energy)
// ============================================

export async function getEnergyMetrics(): Promise<EnergyCoreMetrics> {
  const [tokenStats, lobsterState] = await Promise.all([
    getTokenStats(),
    computeLobsterState(),
  ]);

  const dailyLimit = 100000; // 每日 Token 上限
  const todayConsumed = tokenStats.daily?.[0]?.tokens || 0;
  const remaining = Math.max(0, dailyLimit - todayConsumed);
  
  // 计算成长进度（基于上下文压力）
  const maxExp = lobsterState.maxExperience || 50000;
  const expPercentage = (lobsterState.experience / Math.max(1, maxExp)) * 100;
  
  return {
    dailyEnergy: {
      consumed: todayConsumed,
      limit: dailyLimit,
      remaining,
      percentage: Math.min(100, (todayConsumed / dailyLimit) * 100),
    },
    growthProgress: {
      current: Math.floor(expPercentage),
      max: 100,
      percentage: Math.floor(expPercentage),
    },
    expRing: {
      level: lobsterState.level,
      currentExp: lobsterState.experience,
      maxExp: maxExp,
      percentage: Math.floor(expPercentage),
    },
    consumptionTrend: (tokenStats.weekly || []).slice(0, 7).map((d: any) => ({
      label: d.label || d.date,
      value: d.tokens || 0,
    })),
  };
}

// ============================================
// 3. 养殖师团队 (Staff)
// ============================================

const STAFF_ROLES = ['feeder', 'trainer', 'caretaker', 'explorer'] as const;
const STAFF_AVATARS = ['🦐', '🦀', '🐚', '🌊', '🫧', '🐙', '🦑', '🐡'];
const STAFF_ACTIONS = [
  '正在喂食',
  '检查水质',
  '训练技能',
  '清理环境',
  '观察成长',
  '记录数据',
  '休息中',
  '准备工作中',
];

async function getActiveAgents(): Promise<StaffMember[]> {
  try {
    // 从 sessions 目录获取活跃 Agent
    const sessionsPath = join(OPENCLAW_DIR, 'agents');
    if (!existsSync(sessionsPath)) {
      return generateDefaultStaff();
    }

    const { stdout } = await execAsync(`find ${sessionsPath} -name "sessions.json" -mtime -1 2>/dev/null | head -5`);
    const sessionFiles = stdout.trim().split('\n').filter(Boolean);
    
    const members: StaffMember[] = [];
    
    for (let i = 0; i < sessionFiles.length; i++) {
      const file = sessionFiles[i];
      const agentId = file.split('/').slice(-2, -1)[0] || `agent-${i}`;
      
      try {
        const content = await readFile(file, 'utf-8');
        const sessions = JSON.parse(content);
        const lastSession = sessions[sessions.length - 1];
        
        const uniqueId = `${agentId}-${i}`;
        members.push({
          id: uniqueId,
          name: agentId.charAt(0).toUpperCase() + agentId.slice(1),
          avatar: STAFF_AVATARS[i % STAFF_AVATARS.length],
          role: STAFF_ROLES[i % STAFF_ROLES.length],
          activityStatus: lastSession ? 'active' : 'idle',
          currentAction: STAFF_ACTIONS[i % STAFF_ACTIONS.length],
          todayContribution: sessions.length,
          bubbleMessage: lastSession ? `最近使用了 ${lastSession.model || '未知模型'}` : undefined,
          lastActive: lastSession?.createdAt || new Date().toISOString(),
        });
      } catch {
        // 跳过解析失败的文件
      }
    }

    return members.length > 0 ? members : generateDefaultStaff();
  } catch (error) {
    console.error('[gameDashboard] getActiveAgents failed:', error);
    return generateDefaultStaff();
  }
}

function generateDefaultStaff(): StaffMember[] {
  return [
    {
      id: 'dev',
      name: '开发虾',
      avatar: '🦐',
      role: 'trainer',
      activityStatus: 'active',
      currentAction: '正在训练代码技能',
      todayContribution: 42,
      bubbleMessage: '今天又写了好多代码！',
      lastActive: new Date().toISOString(),
    },
    {
      id: 'main',
      name: '主虾',
      avatar: '🦀',
      role: 'caretaker',
      activityStatus: 'active',
      currentAction: '观察龙虾状态',
      todayContribution: 28,
      lastActive: new Date().toISOString(),
    },
  ];
}

export async function getStaffMetrics(): Promise<StaffTeamMetrics> {
  const members = await getActiveAgents();
  const activeCount = members.filter(m => m.activityStatus === 'active').length;
  
  return {
    members,
    totalActive: activeCount,
    teamMood: Math.floor(50 + activeCount * 10 + Math.random() * 20),
    collaborationIndex: Math.floor(60 + activeCount * 8),
  };
}

// ============================================
// 4. 进化树 (Collaboration)
// ============================================

const EVOLUTION_STAGES: EvolutionStage[] = ['egg', 'larva', 'juvenile', 'adult', 'evolved'];

const EVOLUTION_NODES: Omit<EvolutionNode, 'unlocked' | 'unlockedAt'>[] = [
  { id: 'root', stage: 'egg', name: '龙虾蛋', icon: '🥚', triggeredBy: 'system', childrenIds: ['first-talk'], description: '一切的开始' },
  { id: 'first-talk', stage: 'larva', name: '初次对话', icon: '💬', triggeredBy: 'user', parentId: 'root', childrenIds: ['first-feed'], description: '第一次与龙虾交流' },
  { id: 'first-feed', stage: 'larva', name: '初次喂食', icon: '🍖', triggeredBy: 'user', parentId: 'first-talk', childrenIds: ['level-5'], description: '第一次喂食龙虾' },
  { id: 'level-5', stage: 'juvenile', name: '幼虾觉醒', icon: '🦐', triggeredBy: 'system', parentId: 'first-feed', childrenIds: ['memory-10'], description: '达到 5 级' },
  { id: 'memory-10', stage: 'juvenile', name: '记忆收集者', icon: '🧠', triggeredBy: 'system', parentId: 'level-5', childrenIds: ['skill-master'], description: '收集 10 个记忆碎片' },
  { id: 'skill-master', stage: 'adult', name: '技能大师', icon: '💪', triggeredBy: 'system', parentId: 'memory-10', childrenIds: ['evolution'], description: '掌握 5 个技能' },
  { id: 'evolution', stage: 'evolved', name: '究极进化', icon: '🐉', triggeredBy: 'system', parentId: 'skill-master', childrenIds: [], description: '完成最终进化' },
];

export async function getEvolutionMetrics(): Promise<EvolutionTreeMetrics> {
  const [state, lobsterState] = await Promise.all([
    loadLobsterState(),
    computeLobsterState(),
  ]);

  // 根据龙虾状态计算解锁节点
  const unlockedNodes = new Set<string>(['root']);
  
  if (state.deepTalkCount > 0) unlockedNodes.add('first-talk');
  if (state.totalInteractions > 0) unlockedNodes.add('first-feed');
  if (lobsterState.level >= 5) unlockedNodes.add('level-5');
  
  // 获取记忆数量
  const memoryScore = await getMemoryScore();
  const memoryCount = memoryScore?.layers?.reduce((sum, l) => sum + l.files.length, 0) || 0;
  if (memoryCount >= 10) unlockedNodes.add('memory-10');
  
  // 技能数量
  if (lobsterState.skills >= 5) unlockedNodes.add('skill-master');
  if (lobsterState.level >= 20) unlockedNodes.add('evolution');

  const nodes: EvolutionNode[] = EVOLUTION_NODES.map(node => ({
    ...node,
    unlocked: unlockedNodes.has(node.id),
    unlockedAt: unlockedNodes.has(node.id) ? state.firstMeet || new Date().toISOString() : undefined,
    completedAt: unlockedNodes.has(node.id) ? state.firstMeet || new Date().toISOString() : undefined,
    rewards: { exp: 100 },
  }));

  const currentStage = lobsterState.level >= 20 ? 'evolved' :
                       lobsterState.level >= 10 ? 'adult' :
                       lobsterState.level >= 5 ? 'juvenile' :
                       state.totalInteractions > 0 ? 'larva' : 'egg';

  return {
    currentStage,
    nodes,
    totalUnlocked: unlockedNodes.size,
    nextUnlockProgress: Math.min(100, (lobsterState.level % 5) * 20),
    path: Array.from(unlockedNodes),
  };
}

// ============================================
// 5. 记忆宫殿 (Memory)
// ============================================

const FRAGMENT_CATEGORIES = ['player', 'level', 'conversation', 'achievement'] as const;
const FRAGMENT_ICONS = ['📸', '📊', '💭', '🏆', '📝', '🎯', '💡', '🎨'];
const FRAGMENT_QUALITIES = ['common', 'rare', 'epic', 'legendary'] as const;

async function generateMemoryFragments(): Promise<MemoryFragment[]> {
  const memoryScore = await getMemoryScore();
  const fragments: MemoryFragment[] = [];

  // 从记忆层生成碎片
  for (const layer of memoryScore?.layers || []) {
    for (const file of layer.files.slice(0, 3)) {
      fragments.push({
        id: `fragment-${file.path}`,
        title: file.label || file.path.split('/').pop() || '记忆碎片',
        category: FRAGMENT_CATEGORIES[Math.floor(Math.random() * FRAGMENT_CATEGORIES.length)],
        icon: FRAGMENT_ICONS[fragments.length % FRAGMENT_ICONS.length],
        quality: FRAGMENT_QUALITIES[Math.floor(Math.random() * FRAGMENT_QUALITIES.length)],
        collectedAt: file.updatedAt || new Date().toISOString(),
        summary: file.exists ? '记忆文件已索引，可正常检索' : '记忆文件待创建',
        searchable: file.indexed,
        tags: [layer.key, file.exists ? 'exists' : 'missing'],
      });
    }
  }

  return fragments.slice(0, 12);
}

export async function getMemoryMetrics(): Promise<MemoryPalaceMetrics> {
  const fragments = await generateMemoryFragments();
  const memoryScore = await getMemoryScore();
  
  const categoryStats: Record<string, number> = {};
  for (const f of fragments) {
    categoryStats[f.category] = (categoryStats[f.category] || 0) + 1;
  }

  return {
    fragments,
    totalFragments: fragments.length,
    collectionProgress: Math.floor((fragments.length / 20) * 100),
    searchEnabled: memoryScore?.overall?.indexScore > 50,
    recentFragments: fragments.slice(0, 4),
    categoryStats,
  };
}

// ============================================
// 6. 养殖手册 (Documents)
// ============================================

const HANDBOOK_SECTIONS: Omit<HandbookSection, 'read' | 'readProgress'>[] = [
  { id: 'feeding', title: '喂食指南', icon: '🍖', docPath: 'docs/feeding.md', preview: '如何正确喂食龙虾，保持饱食度', category: 'guide', lastUpdated: '2026-03-20' },
  { id: 'evolution', title: '进化规则', icon: '🧬', docPath: 'docs/evolution.md', preview: '龙虾进化的完整路径和条件', category: 'rule', lastUpdated: '2026-03-18' },
  { id: 'training', title: '训练教程', icon: '💪', docPath: 'docs/training.md', preview: '提升龙虾各项属性的训练方法', category: 'tutorial', lastUpdated: '2026-03-15' },
  { id: 'memory', title: '记忆管理', icon: '🧠', docPath: 'docs/memory.md', preview: '管理龙虾的记忆系统', category: 'reference', lastUpdated: '2026-03-10' },
  { id: 'skills', title: '技能图鉴', icon: '📚', docPath: 'docs/skills.md', preview: '所有可学习技能的详细说明', category: 'reference', lastUpdated: '2026-03-12' },
  { id: 'faq', title: '常见问题', icon: '❓', docPath: 'docs/faq.md', preview: '玩家最常问的问题及解答', category: 'guide', lastUpdated: '2026-03-22' },
];

export async function getHandbookMetrics(): Promise<HandbookMetrics> {
  // 从本地状态读取阅读进度
  const state = await loadLobsterState();
  const readSections = state.readHandbookSections || [];

  const sections: HandbookSection[] = HANDBOOK_SECTIONS.map(section => {
    const isRead = readSections.includes(section.id);
    return {
      ...section,
      read: isRead,
      readProgress: isRead ? 100 : Math.floor(Math.random() * 30),
    };
  });

  const readCount = sections.filter(s => s.read).length;

  return {
    sections,
    totalSections: sections.length,
    readCount,
    overallProgress: Math.floor((readCount / sections.length) * 100),
    recommended: sections.filter(s => !s.read).slice(0, 2).map(s => s.id),
  };
}

// ============================================
// 7. 任务板 (Tasks)
// ============================================

const DEFAULT_TASKS: Omit<LobsterTask, 'status' | 'completedAt'>[] = [
  { id: 'daily-feed', title: '每日喂食', description: '喂食龙虾 3 次', icon: '🍖', type: 'daily', rewards: { exp: 50 }, progress: { current: 1, target: 3 }, category: 'feeding', deadline: '23:59' },
  { id: 'daily-train', title: '技能训练', description: '训练龙虾 2 次', icon: '💪', type: 'daily', rewards: { exp: 40 }, progress: { current: 0, target: 2 }, category: 'training', deadline: '23:59' },
  { id: 'weekly-interact', title: '深度交流', description: '本周进行 5 次深度对话', icon: '💬', type: 'weekly', rewards: { exp: 200, badge: '交际花' }, progress: { current: 2, target: 5 }, category: 'social' },
  { id: 'achieve-level10', title: '初露锋芒', description: '龙虾达到 10 级', icon: '⭐', type: 'achievement', rewards: { exp: 500, badge: '成长先锋' }, progress: { current: 5, target: 10 }, category: 'exploration' },
  { id: 'maintain-memory', title: '记忆整理', description: '检查并优化记忆系统', icon: '🧹', type: 'daily', rewards: { exp: 30 }, progress: { current: 0, target: 1 }, category: 'maintenance', deadline: '23:59' },
];

export async function getTaskMetrics(): Promise<TaskBoardMetrics> {
  const state = await loadLobsterState();
  const completedTasks = state.completedTasks || [];

  const tasks: LobsterTask[] = DEFAULT_TASKS.map(task => {
    const isCompleted = completedTasks.includes(task.id);
    return {
      ...task,
      status: isCompleted ? 'completed' : task.progress.current >= task.progress.target ? 'pending' : 'in_progress',
      completedAt: isCompleted ? state.lastActiveDate : undefined,
    };
  });

  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;

  return {
    tasks,
    stats: {
      total: tasks.length,
      pending: pendingCount,
      completed: completedCount,
      claimed: completedCount,
    },
    dailyAvailable: tasks.filter(t => t.type === 'daily' && t.status !== 'completed').length,
    streakDays: state.consecutiveDays || 0,
  };
}

// ============================================
// 8. 设施状态 (Settings)
// ============================================

export async function getFacilityMetrics(): Promise<FacilityStatus> {
  // 获取系统状态
  const systemMetrics = await getSystemMetrics();
  
  // 水质映射内存使用
  const waterQualityStatus = systemMetrics.memory < 30 ? 'clear' :
                             systemMetrics.memory < 60 ? 'slightly_turbid' :
                             systemMetrics.memory < 80 ? 'turbid' : 'polluted';

  const waterDescriptions: Record<string, string> = {
    clear: '水质清澈，适合龙虾生长',
    slightly_turbid: '水质微浑，建议观察',
    turbid: '水质浑浊，需要清理',
    polluted: '水质污染，立即处理！',
  };

  // 检查更新
  let updateAvailable = false;
  try {
    const { stdout } = await execAsync('openclaw version --check 2>/dev/null || echo "{}"');
    const versionInfo = JSON.parse(stdout);
    updateAvailable = versionInfo.hasUpdate || false;
  } catch {
    // 忽略检查失败
  }

  return {
    waterQuality: {
      status: waterQualityStatus,
      percentage: Math.floor(100 - systemMetrics.memory),
      description: waterDescriptions[waterQualityStatus],
    },
    season: {
      current: '春季',
      nextSeason: '夏季',
      daysUntilChange: 15,
      updateAvailable,
    },
    temperature: {
      current: Math.floor(20 + systemMetrics.cpu / 5),
      status: systemMetrics.cpu < 50 ? 'comfortable' : systemMetrics.cpu < 70 ? 'warm' : 'hot',
    },
    security: {
      status: 'secure',
      lastCheck: new Date().toISOString(),
    },
  };
}

// ============================================
// 统一数据聚合
// ============================================

export async function getGameDashboardSnapshot(): Promise<GameDashboardSnapshot> {
  const [
    health,
    energy,
    staff,
    evolution,
    memory,
    handbook,
    tasks,
    facility,
    lobsterState,
  ] = await Promise.all([
    getHealthMetrics(),
    getEnergyMetrics(),
    getStaffMetrics(),
    getEvolutionMetrics(),
    getMemoryMetrics(),
    getHandbookMetrics(),
    getTaskMetrics(),
    getFacilityMetrics(),
    computeLobsterState(),
  ]);

  // 计算整体进度
  const moduleProgresses = [
    health.hp.percentage,
    energy.growthProgress.percentage,
    (evolution.totalUnlocked / evolution.nodes.length) * 100,
    memory.collectionProgress,
    handbook.overallProgress,
    (tasks.stats.completed / tasks.stats.total) * 100,
  ];
  const overallProgress = Math.floor(moduleProgresses.reduce((a, b) => a + b, 0) / moduleProgresses.length);

  return {
    version: '1.0.0',
    updatedAt: new Date().toISOString(),
    modules: {
      health,
      energy,
      staff,
      evolution,
      memory,
      handbook,
      tasks,
      facility,
    },
    overall: {
      gameLevel: lobsterState.level,
      totalPlayTime: health.uptimeDays,
      overallProgress,
      nextMilestone: evolution.nodes.find(n => !n.unlocked)?.name || '已全部解锁',
    },
  };
}

// 清除缓存（当状态改变时调用）
export function clearDashboardCache(): void {
  // 缓存清除逻辑（如有需要）
}
