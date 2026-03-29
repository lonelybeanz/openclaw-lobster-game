import type {
  AchievementUnlockHistoryItem,
  InteractResult,
  LobsterNewsItem,
  MemoryLlmEvalResponse,
  MemoryLlmEvalSavedRecord,
  MemoryScoreSnapshot,
  LlmMilestonesResponse,
  SearchNewsResponse,
  VisualizationSnapshot,
  HealthTrendSnapshot,
} from './types';
import type { GameDashboardSnapshot } from './types/dashboard';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/admin-api';

type RequestOptions = RequestInit & {
  timeoutMs?: number;
};

export class RequestTimeoutError extends Error {
  constructor(message = '请求超时') {
    super(message);
    this.name = 'RequestTimeoutError';
  }
}

async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = init?.timeoutMs;
  const timeoutId =
    typeof timeoutMs === 'number' && timeoutMs > 0
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : null;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: init?.signal ?? controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new RequestTimeoutError(typeof timeoutMs === 'number' ? `请求超时（>${Math.round(timeoutMs / 1000)}s）` : '请求超时');
    }
    throw error;
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }

  if (!res.ok) {
    throw new Error(`请求失败: ${res.status}`);
  }

  const json = await res.json();
  if (json.code !== 0) {
    throw new Error(json.message ?? '业务请求失败');
  }

  return json.data;
}

async function postJson<T>(path: string, body: unknown, options?: Omit<RequestOptions, 'body' | 'method'>): Promise<T> {
  return request<T>(path, {
    ...options,
    method: 'POST',
    headers: {
      ...(options?.headers ?? {}),
    },
    body: JSON.stringify(body),
  });
}

export async function getLobsterStats(): Promise<any> {
  return request('/lobster/stats');
}

export async function getLobsterNews(): Promise<LobsterNewsItem[]> {
  return request('/lobster/news');
}

export async function interact(action: 'feed' | 'train' | 'rest'): Promise<InteractResult> {
  return postJson('/lobster/interact', { action });
}

export async function getAchievements(): Promise<any[]> {
  return request('/lobster/achievements');
}

export async function getAchievementUnlockHistory(): Promise<AchievementUnlockHistoryItem[]> {
  return request('/lobster/achievement-unlock-history');
}

export async function getSkills(): Promise<any> {
  return request('/lobster/skills');
}

export async function getTokenStats(): Promise<any> {
  return request('/lobster/tokens');
}

export async function getMilestones(): Promise<any> {
  return request('/lobster/milestones');
}

export async function getLlmMilestones(): Promise<LlmMilestonesResponse> {
  return request('/lobster/llm-milestones');
}

export async function getCareMessage(): Promise<{ message: string | null }> {
  return request('/lobster/care');
}

export async function deepTalk(message: string): Promise<any> {
  return postJson('/lobster/deeptalk', { message });
}

export async function searchNews(query: string, asyncMode = false, timeoutMs?: number): Promise<SearchNewsResponse> {
  return postJson('/lobster/search-news', { query, async: asyncMode }, { timeoutMs });
}

export async function getSearchResult(jobId: string, timeoutMs?: number): Promise<SearchNewsResponse> {
  return request(`/lobster/search-result/${jobId}`, { timeoutMs });
}

export async function getMemoryScore(force = false): Promise<MemoryScoreSnapshot> {
  const suffix = force ? '?force=1' : '';
  return request(`/lobster/memory-score${suffix}`);
}

export async function getMemoryLlmEval(): Promise<MemoryLlmEvalResponse> {
  return request('/lobster/memory-llm-eval');
}

export async function saveMemoryLlmEval(result: MemoryLlmEvalResponse): Promise<MemoryLlmEvalSavedRecord> {
  return postJson('/lobster/memory-llm-eval/save', { result });
}

// 可视化快照
export async function getVisualizationSnapshot(): Promise<VisualizationSnapshot> {
  return request('/lobster/visualization');
}

export async function getHealthTrend(period: '7d' | '30d' | '90d' = '30d'): Promise<HealthTrendSnapshot> {
  return request(`/lobster/health/trend?period=${period}`);
}

// ============================================
// OCC 游戏化仪表盘 API
// ============================================

/** 获取完整游戏仪表盘数据 */
export async function getGameDashboard(): Promise<GameDashboardSnapshot> {
  return request('/lobster/dashboard');
}

/** 获取健康仪表盘 */
export async function getDashboardHealth(): Promise<GameDashboardSnapshot['modules']['health']> {
  return request('/lobster/dashboard/health');
}

/** 获取能量核心数据 */
export async function getDashboardEnergy(): Promise<GameDashboardSnapshot['modules']['energy']> {
  return request('/lobster/dashboard/energy');
}

/** 获取养殖师团队 */
export async function getDashboardStaff(): Promise<GameDashboardSnapshot['modules']['staff']> {
  return request('/lobster/dashboard/staff');
}

/** 获取进化树 */
export async function getDashboardEvolution(): Promise<GameDashboardSnapshot['modules']['evolution']> {
  return request('/lobster/dashboard/evolution');
}

/** 获取记忆宫殿 */
export async function getDashboardMemory(): Promise<GameDashboardSnapshot['modules']['memory']> {
  return request('/lobster/dashboard/memory');
}

/** 获取养殖手册 */
export async function getDashboardHandbook(): Promise<GameDashboardSnapshot['modules']['handbook']> {
  return request('/lobster/dashboard/handbook');
}

/** 获取任务板 */
export async function getDashboardTasks(): Promise<GameDashboardSnapshot['modules']['tasks']> {
  return request('/lobster/dashboard/tasks');
}

/** 获取设施状态 */
export async function getDashboardFacility(): Promise<GameDashboardSnapshot['modules']['facility']> {
  return request('/lobster/dashboard/facility');
}

// ============================================
// 学习点数系统 API
// ============================================

export interface LearningRecord {
  id: string;
  timestamp: string;
  action: 'memory_read' | 'memory_write' | 'memory_explore' | 'skill_learn' | 'task_complete';
  points: number;
  exp: number;
  reason: string;
  metadata?: {
    memoryFile?: string;
    skillName?: string;
    taskId?: string;
  };
}

export interface LearningState {
  totalPoints: number;
  todayPoints: number;
  totalExp: number;
  todayExp: number;
  streakDays: number;
  lastLearningDate: string;
  records: LearningRecord[];
  stats: {
    memoryReads: number;
    memoryWrites: number;
    memoryExplores: number;
    skillsLearned: number;
    tasksCompleted: number;
  };
}

/** 获取学习状态 */
export async function getLearningState(): Promise<LearningState> {
  return request('/lobster/learning');
}

/** 获取今日学习摘要 */
export async function getTodayLearningSummary(): Promise<{
  points: number;
  exp: number;
  streak: number;
  actions: number;
}> {
  return request('/lobster/learning/today');
}

/** 获取学习里程碑 */
export async function getLearningMilestones(): Promise<string[]> {
  return request('/lobster/learning/milestones');
}

/** 记录学习行为 */
export async function recordLearning(
  action: LearningRecord['action'],
  metadata?: LearningRecord['metadata']
): Promise<LearningRecord> {
  return postJson('/lobster/learning/record', { action, metadata });
}

/** 模拟记忆读取 */
export async function simulateMemoryRead(memoryFile: string): Promise<LearningRecord> {
  return postJson('/lobster/learning/memory-read', { memoryFile });
}

/** 模拟记忆探索 */
export async function simulateMemoryExplore(query: string): Promise<LearningRecord> {
  return postJson('/lobster/learning/memory-explore', { query });
}

// ============================================
// 小龙虾群系统 API
// ============================================

export interface LobsterAgent {
  id: string;
  name: string;
  role: 'main' | 'dev' | 'pm' | 'ops' | 'research' | 'design' | 'test' | 'other';
  emoji: string;
  personality: string;
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

export interface PondStats {
  totalLobsters: number;
  averageLevel: number;
  totalTokens: number;
  totalSessions: number;
  averageMood: number;
  needsFeeding: number;
  needsRest: number;
}

/** 获取所有小龙虾 */
export async function getLobsterPond(): Promise<LobsterAgent[]> {
  return request('/lobster/pond');
}

/** 获取池塘统计 */
export async function getPondStats(): Promise<PondStats> {
  return request('/lobster/pond/stats');
}

/** 喂食小龙虾 */
export async function feedLobster(id: string): Promise<{ success: boolean; message: string }> {
  return postJson(`/lobster/pond/${id}/feed`, {});
}

/** 训练小龙虾 */
export async function trainLobster(id: string): Promise<{ success: boolean; message: string }> {
  return postJson(`/lobster/pond/${id}/train`, {});
}

/** 让小龙虾休息 */
export async function restLobster(id: string): Promise<{ success: boolean; message: string }> {
  return postJson(`/lobster/pond/${id}/rest`, {});
}

// ============================================
// 养殖师系统 API
// ============================================

export interface CaretakerAction {
  id: string;
  timestamp: string;
  type: 'feed' | 'train' | 'rest' | 'clean' | 'observe' | 'evolve';
  targetLobsterId?: string;
  details: string;
  expGained: number;
}

export interface CaretakerState {
  name: string;
  level: 'novice' | 'apprentice' | 'junior' | 'senior' | 'master' | 'legendary';
  levelNumber: number;
  experience: number;
  maxExperience: number;
  skills: {
    feeding: number;
    training: number;
    cleaning: number;
    observing: number;
    evolving: number;
  };
  stats: {
    totalActions: number;
    feedCount: number;
    trainCount: number;
    restCount: number;
    cleanCount: number;
    observeCount: number;
    evolveCount: number;
    streakDays: number;
    lastActiveDate: string;
  };
  recentActions: CaretakerAction[];
  resources: {
    food: number;
    medicine: number;
    toys: number;
    tokens: number;
  };
}

/** 获取养殖师状态 */
export async function getCaretakerState(): Promise<CaretakerState> {
  return request('/lobster/caretaker');
}

/** 获取养殖师摘要 */
export async function getCaretakerSummary(): Promise<{
  name: string;
  level: string;
  emoji: string;
  levelNumber: number;
  experience: number;
  maxExperience: number;
  streakDays: number;
  totalActions: number;
  skills: CaretakerState['skills'];
  resources: CaretakerState['resources'];
}> {
  return request('/lobster/caretaker/summary');
}

/** 获取养殖师等级信息 */
export async function getCaretakerLevelInfo(): Promise<{
  current: CaretakerState['level'];
  next: CaretakerState['level'] | null;
  progress: number;
  benefits: string[];
}> {
  return request('/lobster/caretaker/level');
}

/** 记录养殖师行为 */
export async function recordCaretakerAction(
  type: CaretakerAction['type'],
  targetLobsterId?: string,
  details?: string
): Promise<{ success: boolean; action: CaretakerAction; levelUp?: boolean }> {
  return postJson('/lobster/caretaker/action', { type, targetLobsterId, details });
}
