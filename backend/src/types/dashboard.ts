/**
 * OCC 游戏化仪表盘类型定义 (Backend)
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

export type StaffRole = 'feeder' | 'trainer' | 'caretaker' | 'explorer';
export type ActivityStatus = 'active' | 'idle' | 'resting';

export interface StaffMember {
  id: string;
  name: string;
  avatar: string;
  role: StaffRole;
  activityStatus: ActivityStatus;
  currentAction: string;
  todayContribution: number;
  bubbleMessage?: string;
  lastActive: string;
}

export interface StaffTeamMetrics {
  members: StaffMember[];
  totalActive: number;
  teamMood: number;
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
  unlocked: boolean;
  unlockedAt?: string;
  triggeredBy: string;
  parentId?: string;
  childrenIds: string[];
  description: string;
  completedAt?: string;
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
  path: string[];
}

// ============================================
// 5. 记忆宫殿 (Memory)
// ============================================

export type FragmentCategory = 'player' | 'level' | 'conversation' | 'achievement';
export type FragmentQuality = 'common' | 'rare' | 'epic' | 'legendary';

export interface MemoryFragment {
  id: string;
  title: string;
  category: FragmentCategory;
  icon: string;
  quality: FragmentQuality;
  collectedAt: string;
  summary: string;
  searchable: boolean;
  tags: string[];
}

export interface MemoryPalaceMetrics {
  fragments: MemoryFragment[];
  totalFragments: number;
  collectionProgress: number;
  searchEnabled: boolean;
  recentFragments: MemoryFragment[];
  categoryStats: Record<string, number>;
}

// ============================================
// 6. 养殖手册 (Documents)
// ============================================

export type HandbookCategory = 'guide' | 'rule' | 'tutorial' | 'reference';

export interface HandbookSection {
  id: string;
  title: string;
  icon: string;
  docPath: string;
  preview: string;
  read: boolean;
  readProgress: number;
  lastUpdated: string;
  category: HandbookCategory;
}

export interface HandbookMetrics {
  sections: HandbookSection[];
  totalSections: number;
  readCount: number;
  overallProgress: number;
  recommended: string[];
}

// ============================================
// 7. 任务板 (Tasks)
// ============================================

export type TaskType = 'daily' | 'weekly' | 'achievement' | 'event';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'claimed';
export type TaskCategory = 'feeding' | 'training' | 'maintenance' | 'exploration' | 'social';

export interface LobsterTask {
  id: string;
  title: string;
  description: string;
  icon: string;
  type: TaskType;
  status: TaskStatus;
  rewards: {
    exp: number;
    badge?: string;
    item?: string;
  };
  progress: {
    current: number;
    target: number;
  };
  deadline?: string;
  completedAt?: string;
  category: TaskCategory;
}

export interface TaskBoardMetrics {
  tasks: LobsterTask[];
  stats: {
    total: number;
    pending: number;
    completed: number;
    claimed: number;
  };
  dailyAvailable: number;
  streakDays: number;
}

// ============================================
// 8. 设施状态 (Settings)
// ============================================

export type WaterQualityStatus = 'clear' | 'slightly_turbid' | 'turbid' | 'polluted';
export type TemperatureStatus = 'comfortable' | 'warm' | 'hot' | 'cold';
export type SecurityStatus = 'secure' | 'warning' | 'danger';

export interface FacilityStatus {
  waterQuality: {
    status: WaterQualityStatus;
    percentage: number;
    description: string;
  };
  season: {
    current: string;
    nextSeason: string;
    daysUntilChange: number;
    updateAvailable: boolean;
  };
  temperature: {
    current: number;
    status: TemperatureStatus;
  };
  security: {
    status: SecurityStatus;
    lastCheck: string;
  };
}

// ============================================
// 统一仪表盘数据
// ============================================

export interface GameDashboardSnapshot {
  version: string;
  updatedAt: string;
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
