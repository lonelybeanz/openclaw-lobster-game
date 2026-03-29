/**
 * OCC 游戏化仪表盘类型定义
 * OpenClaw Control Center → Lobster Game Dashboard
 */

// ============================================
// 1. 龙虾健康仪表盘 (Overview)
// ============================================

export type HealthStatus = 'excellent' | 'good' | 'warning' | 'critical';

export interface LobsterHealthMetrics {
  /** 体力值 (HP) - 基于系统 Memory 使用率映射 */
  hp: {
    current: number;
    max: number;
    percentage: number;
  };
  /** 新陈代谢 - 基于 CPU 负载 */
  stamina: {
    current: number;
    max: number;
    percentage: number;
  };
  /** 系统运行时间映射为龙虾寿命 */
  uptimeDays: number;
  /** 综合健康状态 */
  overallStatus: HealthStatus;
  /** 健康灯泡提示 */
  healthTips: string[];
  /** 系统负载历史 */
  loadHistory: Array<{
    timestamp: string;
    cpu: number;
    memory: number;
  }>;
}

// ============================================
// 2. 能量核心 (Usage)
// ============================================

export interface EnergyCoreMetrics {
  /** 今日能量值 - 基于 Token 消耗 */
  dailyEnergy: {
    consumed: number;
    limit: number;
    remaining: number;
    percentage: number;
  };
  /** 成长进度 - 基于上下文压力 */
  growthProgress: {
    current: number;
    max: number;
    percentage: number;
  };
  /** 经验值环形图数据 */
  expRing: {
    level: number;
    currentExp: number;
    maxExp: number;
    percentage: number;
  };
  /** 能量消耗趋势 */
  consumptionTrend: Array<{
    label: string;
    value: number;
  }>;
}

// ============================================
// 3. 养殖师团队 (Staff)
// ============================================

export interface StaffMember {
  id: string;
  name: string;
  avatar: string; // emoji 或图标
  role: 'feeder' | 'trainer' | 'caretaker' | 'explorer';
  /** 活跃度状态 */
  activityStatus: 'active' | 'idle' | 'resting';
  /** 当前行为描述 */
  currentAction: string;
  /** 今日贡献 */
  todayContribution: number;
  /** 气泡提示 */
  bubbleMessage?: string;
  /** 上次活跃时间 */
  lastActive: string;
}

export interface StaffTeamMetrics {
  members: StaffMember[];
  totalActive: number;
  teamMood: number; // 0-100
  /** 团队协作指数 */
  collaborationIndex: number;
}

// ============================================
// 4. 进化树 (Collaboration)
// ============================================

export type EvolutionStage = 'egg' | 'larva' | 'juvenile' | 'adult' | 'evolved';

export interface EvolutionNode {
  id: string;
  stage: EvolutionStage;
  name: string;
  icon: string;
  /** 是否已解锁 */
  unlocked: boolean;
  /** 解锁时间 */
  unlockedAt?: string;
  /** 触发此节点的 Agent */
  triggeredBy: string;
  /** 父节点 ID */
  parentId?: string;
  /** 子节点 IDs */
  childrenIds: string[];
  /** 节点描述 */
  description: string;
  /** 完成时间 */
  completedAt?: string;
  /** 节点奖励 */
  rewards?: {
    exp?: number;
    achievement?: string;
  };
}

export interface EvolutionTreeMetrics {
  currentStage: EvolutionStage;
  nodes: EvolutionNode[];
  totalUnlocked: number;
  nextUnlockProgress: number;
  /** 进化路径 */
  path: string[];
}

// ============================================
// 5. 记忆宫殿 (Memory)
// ============================================

export interface MemoryFragment {
  id: string;
  title: string;
  category: 'player' | 'level' | 'conversation' | 'achievement';
  icon: string;
  /** 碎片质量 */
  quality: 'common' | 'rare' | 'epic' | 'legendary';
  /** 收集时间 */
  collectedAt: string;
  /** 内容摘要 */
  summary: string;
  /** 是否可搜索 */
  searchable: boolean;
  /** 关联标签 */
  tags: string[];
}

export interface MemoryPalaceMetrics {
  fragments: MemoryFragment[];
  totalFragments: number;
  /** 收集进度 */
  collectionProgress: number;
  /** 搜索功能状态 */
  searchEnabled: boolean;
  /** 最近收集 */
  recentFragments: MemoryFragment[];
  /** 分类统计 */
  categoryStats: Record<string, number>;
}

// ============================================
// 6. 养殖手册 (Documents)
// ============================================

export interface HandbookSection {
  id: string;
  title: string;
  icon: string;
  /** 文档路径 */
  docPath: string;
  /** 内容预览 */
  preview: string;
  /** 是否已读 */
  read: boolean;
  /** 阅读进度 */
  readProgress: number;
  /** 最后更新 */
  lastUpdated: string;
  /** 文档类型 */
  category: 'guide' | 'rule' | 'tutorial' | 'reference';
}

export interface HandbookMetrics {
  sections: HandbookSection[];
  totalSections: number;
  readCount: number;
  /** 阅读进度 */
  overallProgress: number;
  /** 推荐阅读 */
  recommended: string[];
}

// ============================================
// 7. 任务板 (Tasks)
// ============================================

export type TaskType = 'daily' | 'weekly' | 'achievement' | 'event';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'claimed';

export interface LobsterTask {
  id: string;
  title: string;
  description: string;
  icon: string;
  type: TaskType;
  status: TaskStatus;
  /** 任务奖励 */
  rewards: {
    exp: number;
    badge?: string;
    item?: string;
  };
  /** 进度 */
  progress: {
    current: number;
    target: number;
  };
  /** 截止时间 */
  deadline?: string;
  /** 完成时间 */
  completedAt?: string;
  /** 任务分类 */
  category: 'feeding' | 'training' | 'maintenance' | 'exploration' | 'social';
}

export interface TaskBoardMetrics {
  tasks: LobsterTask[];
  /** 统计 */
  stats: {
    total: number;
    pending: number;
    completed: number;
    claimed: number;
  };
  /** 今日可完成 */
  dailyAvailable: number;
  /**  streak 天数 */
  streakDays: number;
}

// ============================================
// 8. 设施状态 (Settings)
// ============================================

export interface FacilityStatus {
  /** 水质质量 - 映射 Gateway Health */
  waterQuality: {
    status: 'clear' | 'slightly_turbid' | 'turbid' | 'polluted';
    percentage: number;
    description: string;
  };
  /** 季节更替 - 映射 Update Status */
  season: {
    current: string;
    nextSeason: string;
    daysUntilChange: number;
    updateAvailable: boolean;
  };
  /** 环境温度 - 系统温度 */
  temperature: {
    current: number;
    status: 'comfortable' | 'warm' | 'hot' | 'cold';
  };
  /** 安全状态 */
  security: {
    status: 'secure' | 'warning' | 'danger';
    lastCheck: string;
  };
}

// ============================================
// 统一仪表盘数据
// ============================================

export interface GameDashboardSnapshot {
  /** 数据版本 */
  version: string;
  /** 更新时间 */
  updatedAt: string;
  /** 各模块数据 */
  modules: {
    health: LobsterHealthMetrics;
    energy: EnergyCoreMetrics;
    staff: StaffTeamMetrics;
    evolution: EvolutionTreeMetrics;
    memory: MemoryPalaceMetrics;
    handbook: HandbookMetrics;
    tasks: TaskBoardMetrics;
    facility: FacilityStatus;
  };
  /** 整体游戏状态 */
  overall: {
    gameLevel: number;
    totalPlayTime: number;
    overallProgress: number;
    nextMilestone: string;
  };
}

// ============================================
// 游戏化交互类型
// ============================================

export interface DashboardInteraction {
  type: 'collect_fragment' | 'complete_task' | 'read_handbook' | 'interact_staff';
  targetId: string;
  timestamp: string;
}

export interface DashboardNotification {
  id: string;
  type: 'achievement' | 'level_up' | 'task_complete' | 'fragment_found' | 'event';
  title: string;
  message: string;
  icon: string;
  timestamp: string;
  read: boolean;
  action?: {
    label: string;
    target: string;
  };
}
