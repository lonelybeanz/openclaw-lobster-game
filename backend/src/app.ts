import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCompleteLobsterStats } from './services/complete';
import { getOpenClawNews, searchWithOpenClaw, searchWithOpenClawAsync, getSearchResult } from './services/news';
import { getTokenStats, initTokenStats, updateTokenStats } from './services/tokenStats';
import { interact, loadLobsterState, getAchievements, saveLobsterState } from './services/persistence';
import { initModelBenchmarkUpdater } from './services/modelBenchmark';
import { getMilestones, generateCareMessage, enhanceMilestones } from './services/milestones';
import { getLlmMilestones } from './services/llmMilestones';
import { checkOpenClawStatus, chatWithLobster } from './services/openclaw';
import { createTtlCache } from './services/cache';
import { getPromptStats } from './services/promptStats';
import { getMemoryScore } from './services/memoryScore';
import { getMemoryLlmEval } from './services/memoryLlmEval';
import { getLatestMemoryLlmEvalResult, saveMemoryLlmEvalResult } from './services/memoryLlmEvalPersistence';
import { ensureHealthTimelineLog, getHealthTrend } from './services/healthTimeline';
import { getVisualizationSnapshot } from './services/visualization';
import { getAchievementStore, getAchievementUnlockHistory } from './services/achievementStore';
import { computeLobsterState } from './services/lobsterStateEngine';
import { getGameDashboardSnapshot, clearDashboardCache } from './services/gameDashboard';
import { 
  getLearningState, 
  recordLearning, 
  getTodayLearningSummary, 
  checkLearningMilestones,
  simulateMemoryRead,
  simulateMemoryWrite,
  simulateMemoryExplore,
  type LearningActionType 
} from './services/learningPoints';
import {
  getLobsterAgents,
  getPondStats,
  feedLobster,
  trainLobster,
  restLobster,
} from './services/lobsterAgents';
import {
  getCaretakerState,
  recordCaretakerAction,
  getCaretakerLevelInfo,
  getCaretakerSummary,
  consumeResource,
} from './services/caretaker';

const app = new Hono();
const CACHE_TTL_MS = 5 * 60 * 1000;
const STATS_CACHE_TTL_MS = 20 * 1000;
const SKILLS_CACHE_TTL_MS = 20 * 1000;
const NEWS_CACHE_TTL_MS = 60 * 1000;
const MILESTONES_CACHE_TTL_MS = 30 * 1000;
const CARE_CACHE_TTL_MS = 30 * 1000;

type StatsResponseData = Awaited<ReturnType<typeof getCompleteLobsterStats>> & {
  hunger: number;
  health: number;
  mood: number;
  fatigue: number;
  loyalty: number;
  level: number;
  experience: number;
  experiencePool: number;
  totalInteractions: number;
};

const achievementsCache = createTtlCache<{ id: string; name: string; unlocked: boolean }[]>(CACHE_TTL_MS);
const statsCache = createTtlCache<StatsResponseData>(STATS_CACHE_TTL_MS);
const skillsCache = createTtlCache<Awaited<ReturnType<typeof getCompleteLobsterStats>>['skillsAnalysis']>(SKILLS_CACHE_TTL_MS);
const newsCache = createTtlCache<Awaited<ReturnType<typeof getOpenClawNews>>>(NEWS_CACHE_TTL_MS);
const milestonesCache = createTtlCache<Awaited<ReturnType<typeof getMilestones>>>(MILESTONES_CACHE_TTL_MS);
const careMessageCache = createTtlCache<{ message: string | null }>(CARE_CACHE_TTL_MS);
const DASHBOARD_CACHE_TTL_MS = 30 * 1000;
const dashboardCache = createTtlCache<Awaited<ReturnType<typeof getGameDashboardSnapshot>>>(DASHBOARD_CACHE_TTL_MS);

function clearDynamicCaches() {
  statsCache.clear();
  achievementsCache.clear();
  milestonesCache.clear();
  careMessageCache.clear();
  dashboardCache.clear();
}

app.use('*', cors());
app.use('*', async (c, next) => {
  const start = performance.now();
  await next();
  const cost = performance.now() - start;
  c.header('X-Response-Time', `${cost.toFixed(1)}ms`);
  const path = new URL(c.req.url).pathname;
  console.info(`[api] ${c.req.method} ${path} ${cost.toFixed(1)}ms`);
});

try {
  await initTokenStats();
} catch (e) {
  console.error('[startup] initTokenStats failed:', e);
}
try {
  await initModelBenchmarkUpdater();
} catch (e) {
  console.error('[startup] initModelBenchmarkUpdater failed:', e);
}
try {
  await ensureHealthTimelineLog();
} catch (e) {
  console.error('[startup] ensureHealthTimelineLog failed:', e);
}

app.get('/lobster/stats', async (c) => {
  // 使用状态引擎计算动态数据
  const computed = await computeLobsterState();
  
  const data = await statsCache.get(async () => {
    const [stats, lobsterState] = await Promise.all([getCompleteLobsterStats(), loadLobsterState()]);
    return {
      ...stats,
      // 使用计算引擎的动态值
      hunger: computed.hunger,
      mood: computed.mood,
      fatigue: computed.fatigue,
      loyalty: computed.loyalty,
      health: Math.floor(100 - computed.fatigue / 2),
      // Token 相关
      totalTokens: computed.totalTokens,
      totalSessions: computed.totalSessions,
      // 经验等级系统
      experience: computed.experience,
      level: computed.level,
      experiencePool: stats.experiencePool + computed.experience,
      // 脑力和技能
      brain: computed.brain,
      skills: computed.skills,
      // 互动
      totalInteractions: lobsterState.totalInteractions,
    };
  });

  return c.json({ code: 0, data });
});

app.get('/lobster/skills', async (c) => {
  const data = await skillsCache.get(async () => {
    const stats = await getCompleteLobsterStats();
    return stats.skillsAnalysis;
  });

  return c.json({ code: 0, data });
});

app.get('/lobster/news', async (c) => {
  const news = await newsCache.get(() => getOpenClawNews());
  return c.json({ code: 0, data: news });
});

app.post('/lobster/search-news', async (c) => {
  const { query, async: asyncMode } = await c.req.json().catch(() => ({ query: '', async: false }));
  if (!query) {
    return c.json({ code: 1, message: '请提供搜索关键词' }, 400);
  }

  if (asyncMode) {
    const jobId = await searchWithOpenClawAsync(query);
    return c.json({ code: 0, data: { success: true, jobId, status: 'pending' } });
  }

  const results = await searchWithOpenClaw(query);
  return c.json({ code: 0, data: { success: true, results } });
});

app.get('/lobster/search-result/:jobId', async (c) => {
  const jobId = c.req.param('jobId');
  if (!jobId) {
    return c.json({ code: 1, message: '缺少 jobId' }, 400);
  }
  return c.json({ code: 0, data: getSearchResult(jobId) });
});

app.get('/lobster/tokens', async (c) => {
  const stats = await getTokenStats();
  return c.json({ code: 0, data: stats });
});

app.get('/lobster/health-timeline', async (c) => {
  const period = c.req.query('period');
  const data = await getHealthTrend(period === '30d' || period === '90d' ? period : '7d');
  return c.json({ code: 0, data });
});

// 别名：前端使用的路径
app.get('/lobster/health/trend', async (c) => {
  const period = c.req.query('period');
  const data = await getHealthTrend(period === '30d' || period === '90d' ? period : '7d');
  return c.json({ code: 0, data });
});

// 时间线热力图
app.get('/lobster/timeline/heatmap', async (c) => {
  const year = parseInt(c.req.query('year') || String(new Date().getFullYear()), 10);
  // 生成热力图数据（简化版）
  const data = [];
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    data.push({
      date: d.toISOString().slice(0, 10),
      interactions: Math.floor(Math.random() * 10), // 实际应从数据库读取
      deepTalks: Math.floor(Math.random() * 3),
    });
  }
  return c.json({ code: 0, data });
});

// 时间线成就
app.get('/lobster/timeline/achievements', async (c) => {
  try {
    const store = await getAchievementStore();
    const data = store.unlocks.map((u) => ({
      date: u.unlockedAt.slice(0, 10),
      achievement: {
        id: u.achievementId,
        name: u.achievementId,
        icon: '🏆',
      },
    }));
    return c.json({ code: 0, data });
  } catch (err) {
    console.error('[timeline/achievements]', err);
    return c.json({ code: 0, data: [] });
  }
});

// Prompt 查询统计
app.get('/lobster/prompt', async (c) => {
  const stats = await getPromptStats();
  return c.json({ code: 0, data: stats });
});

// 互动接口 - 喂食/训练/休息
app.post('/lobster/interact', async (c) => {
  const { action } = await c.req.json();

  if (!['feed', 'train', 'rest'].includes(action)) {
    return c.json({ code: 1, message: '无效动作' }, 400);
  }

  const result = await interact(action);
  clearDynamicCaches();

  return c.json({
    code: 0,
    data: {
      ...result.state,
      message: result.message,
      expGained: result.exp,
      randomEvent: result.randomEvent,
    },
  });
});

app.get('/lobster/achievements', async (c) => {
  const achievements = await achievementsCache.get(() => getAchievements());
  return c.json({ code: 0, data: achievements });
});

app.get('/lobster/achievement-unlock-history', async (c) => {
  try {
    const history = await getAchievementUnlockHistory();
    return c.json({ code: 0, data: history });
  } catch (err) {
    console.error('[achievement-unlock-history]', err);
    return c.json({ code: 0, data: [] });
  }
});

app.get('/lobster/milestones', async (c) => {
  const milestones = await milestonesCache.get(async () => {
    const [stats, lobsterState] = await Promise.all([getCompleteLobsterStats(), loadLobsterState()]);
    const milestoneStats = {
      totalInteractions: lobsterState.totalInteractions || 0,
      consecutiveDays: lobsterState.consecutiveDays || 0,
      lastActiveDate: lobsterState.lastActiveDate || new Date().toISOString().slice(0, 10),
      firstMeet: lobsterState.firstMeet,
      midnightCount: lobsterState.midnightCount || 0,
      deepTalkCount: lobsterState.deepTalkCount || 0,
      challengesCompleted: lobsterState.challengesCompleted || 0,
      skills: stats.skills || 0,
    };
    
    // 获取 LLM 心路历程卡片
    let llmCards: any[] = [];
    try {
      const llmData = await getLlmMilestones();
      if (llmData.cards?.length > 0) {
        llmCards = llmData.cards;
      }
    } catch (err) {
      console.error('[milestones] getLlmMilestones failed:', err);
    }
    
    return getMilestones(stats, milestoneStats, llmCards);
  });
  return c.json({ code: 0, data: milestones });
});

// 增强里程碑描述（调用 OpenClaw）
app.post('/lobster/enhance-milestones', async (c) => {
  const enhancements = await enhanceMilestones();
  return c.json({ code: 0, data: { success: true, count: Object.keys(enhancements).length, enhancements } });
});

app.get('/lobster/care', async (c) => {
  const data = await careMessageCache.get(async () => {
    const [stats, lobsterState] = await Promise.all([getCompleteLobsterStats(), loadLobsterState()]);
    const mergedStats = {
      ...stats,
      hunger: lobsterState.hunger,
      mood: lobsterState.mood,
      fatigue: lobsterState.fatigue,
      totalInteractions: lobsterState.totalInteractions,
    };
    return { message: generateCareMessage(mergedStats) };
  });
  return c.json({ code: 0, data });
});

app.get('/lobster/memory-score', async (c) => {
  const data = await getMemoryScore();
  return c.json({ code: 0, data });
});

app.get('/lobster/memory-llm-eval', async (c) => {
  const data = await getMemoryLlmEval();
  return c.json({ code: 0, data });
});

app.get('/lobster/memory-llm-eval/latest', async (c) => {
  const data = await getLatestMemoryLlmEvalResult();
  return c.json({ code: 0, data });
});

app.post('/lobster/memory-llm-eval/save', async (c) => {
  const { result } = await c.req.json().catch(() => ({ result: null }));
  if (!result || typeof result !== 'object') {
    return c.json({ code: 1, message: '缺少评分结果' }, 400);
  }

  const data = await saveMemoryLlmEvalResult(result);
  return c.json({ code: 0, data });
});

app.post('/lobster/deeptalk', async (c) => {
  const { message } = await c.req.json().catch(() => ({ message: '你好，小龙虾！' }));

  const openclowAvailable = await checkOpenClawStatus();
  if (!openclowAvailable) {
    return c.json({
      code: 1,
      message: 'OpenClaw 未运行',
      deepTalkCount: 0,
    });
  }

  const result = await chatWithLobster(message);

  const state = await loadLobsterState();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const previousActiveDate = state.lastActiveDate;

  const hour = now.getHours();
  const isMidnight = hour >= 23 || hour < 5;

  state.deepTalkCount = (state.deepTalkCount || 0) + 1;
  state.totalInteractions = (state.totalInteractions || 0) + 1;

  if (!state.firstMeet) {
    state.firstMeet = now.toISOString();
  }

  if (!previousActiveDate) {
    state.consecutiveDays = Math.max(1, state.consecutiveDays || 1);
  } else if (previousActiveDate !== today) {
    const lastDate = new Date(previousActiveDate);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      state.consecutiveDays = (state.consecutiveDays || 0) + 1;
    } else if (diffDays > 1) {
      state.consecutiveDays = 1;
    }
  }

  state.lastActiveDate = today;

  if (isMidnight) {
    state.midnightCount = (state.midnightCount || 0) + 1;
  }

  await saveLobsterState(state);
  clearDynamicCaches();

  return c.json({
    code: 0,
    data: {
      success: result.success,
      deepTalkCount: state.deepTalkCount,
      consecutiveDays: state.consecutiveDays,
      midnightCount: state.midnightCount,
      reply: result.reply || result.error,
      sessionKept: true,
    },
  });
});

app.get('/lobster/openclaw-status', async (c) => {
  const available = await checkOpenClawStatus();
  return c.json({ code: 0, data: { available } });
});

app.post('/lobster/tokens', async (c) => {
  const { tokens } = await c.req.json();
  if (tokens !== undefined && (!Number.isFinite(tokens) || tokens < 0)) {
    return c.json({ code: 1, message: 'tokens 必须是非负数字' }, 400);
  }
  await updateTokenStats(tokens);
  clearDynamicCaches();
  newsCache.clear();
  return c.json({ code: 0, message: '已更新' });
});

// 可视化数据
app.get('/lobster/visualization', async (c) => {
  try {
    const data = await getVisualizationSnapshot();
    return c.json({ code: 0, data });
  } catch (error) {
    console.error('[visualization] error:', error);
    return c.json({ code: 1, message: '获取可视化数据失败' }, 500);
  }
});

// ============================================
// OCC 游戏化仪表盘 API
// ============================================

/** 获取完整游戏仪表盘数据 */
app.get('/lobster/dashboard', async (c) => {
  try {
    const data = await dashboardCache.get(() => getGameDashboardSnapshot());
    return c.json({ code: 0, data });
  } catch (error) {
    console.error('[dashboard] error:', error);
    return c.json({ code: 1, message: '获取仪表盘数据失败' }, 500);
  }
});

/** 获取健康仪表盘 */
app.get('/lobster/dashboard/health', async (c) => {
  try {
    const { getHealthMetrics } = await import('./services/gameDashboard');
    const data = await getHealthMetrics();
    return c.json({ code: 0, data });
  } catch (error) {
    console.error('[dashboard/health] error:', error);
    return c.json({ code: 1, message: '获取健康数据失败' }, 500);
  }
});

/** 获取能量核心数据 */
app.get('/lobster/dashboard/energy', async (c) => {
  try {
    const { getEnergyMetrics } = await import('./services/gameDashboard');
    const data = await getEnergyMetrics();
    return c.json({ code: 0, data });
  } catch (error) {
    console.error('[dashboard/energy] error:', error);
    return c.json({ code: 1, message: '获取能量数据失败' }, 500);
  }
});

/** 获取养殖师团队 */
app.get('/lobster/dashboard/staff', async (c) => {
  try {
    const { getStaffMetrics } = await import('./services/gameDashboard');
    const data = await getStaffMetrics();
    return c.json({ code: 0, data });
  } catch (error) {
    console.error('[dashboard/staff] error:', error);
    return c.json({ code: 1, message: '获取团队数据失败' }, 500);
  }
});

/** 获取进化树 */
app.get('/lobster/dashboard/evolution', async (c) => {
  try {
    const { getEvolutionMetrics } = await import('./services/gameDashboard');
    const data = await getEvolutionMetrics();
    return c.json({ code: 0, data });
  } catch (error) {
    console.error('[dashboard/evolution] error:', error);
    return c.json({ code: 1, message: '获取进化树失败' }, 500);
  }
});

/** 获取记忆宫殿 */
app.get('/lobster/dashboard/memory', async (c) => {
  try {
    const { getMemoryMetrics } = await import('./services/gameDashboard');
    const data = await getMemoryMetrics();
    return c.json({ code: 0, data });
  } catch (error) {
    console.error('[dashboard/memory] error:', error);
    return c.json({ code: 1, message: '获取记忆数据失败' }, 500);
  }
});

/** 获取养殖手册 */
app.get('/lobster/dashboard/handbook', async (c) => {
  try {
    const { getHandbookMetrics } = await import('./services/gameDashboard');
    const data = await getHandbookMetrics();
    return c.json({ code: 0, data });
  } catch (error) {
    console.error('[dashboard/handbook] error:', error);
    return c.json({ code: 1, message: '获取手册数据失败' }, 500);
  }
});

/** 获取任务板 */
app.get('/lobster/dashboard/tasks', async (c) => {
  try {
    const { getTaskMetrics } = await import('./services/gameDashboard');
    const data = await getTaskMetrics();
    return c.json({ code: 0, data });
  } catch (error) {
    console.error('[dashboard/tasks] error:', error);
    return c.json({ code: 1, message: '获取任务数据失败' }, 500);
  }
});

/** 获取设施状态 */
app.get('/lobster/dashboard/facility', async (c) => {
  try {
    const { getFacilityMetrics } = await import('./services/gameDashboard');
    const data = await getFacilityMetrics();
    return c.json({ code: 0, data });
  } catch (error) {
    console.error('[dashboard/facility] error:', error);
    return c.json({ code: 1, message: '获取设施数据失败' }, 500);
  }
});

// ============================================
// 学习点数系统 API
// ============================================

/** 获取学习状态 */
app.get('/lobster/learning', async (c) => {
  try {
    const data = await getLearningState();
    return c.json({ code: 0, data });
  } catch (error) {
    console.error('[learning] error:', error);
    return c.json({ code: 1, message: '获取学习状态失败' }, 500);
  }
});

/** 获取今日学习摘要 */
app.get('/lobster/learning/today', async (c) => {
  try {
    const data = await getTodayLearningSummary();
    return c.json({ code: 0, data });
  } catch (error) {
    console.error('[learning/today] error:', error);
    return c.json({ code: 1, message: '获取今日学习摘要失败' }, 500);
  }
});

/** 获取学习里程碑 */
app.get('/lobster/learning/milestones', async (c) => {
  try {
    const data = await checkLearningMilestones();
    return c.json({ code: 0, data });
  } catch (error) {
    console.error('[learning/milestones] error:', error);
    return c.json({ code: 1, message: '获取学习里程碑失败' }, 500);
  }
});

/** 记录学习行为 */
app.post('/lobster/learning/record', async (c) => {
  try {
    const { action, metadata } = await c.req.json().catch(() => ({ action: '', metadata: {} }));
    
    const validActions: LearningActionType[] = [
      'memory_read', 'memory_write', 'memory_explore', 'skill_learn', 'task_complete'
    ];
    
    if (!validActions.includes(action)) {
      return c.json({ code: 1, message: '无效的学习行为类型' }, 400);
    }
    
    const record = await recordLearning(action as LearningActionType, metadata);
    return c.json({ code: 0, data: record });
  } catch (error) {
    console.error('[learning/record] error:', error);
    return c.json({ code: 1, message: '记录学习行为失败' }, 500);
  }
});

/** 模拟记忆读取（获得学习点） */
app.post('/lobster/learning/memory-read', async (c) => {
  try {
    const { memoryFile } = await c.req.json().catch(() => ({ memoryFile: 'unknown' }));
    const record = await simulateMemoryRead(memoryFile);
    return c.json({ code: 0, data: record });
  } catch (error) {
    console.error('[learning/memory-read] error:', error);
    return c.json({ code: 1, message: '记录记忆读取失败' }, 500);
  }
});

/** 模拟记忆探索（获得学习点） */
app.post('/lobster/learning/memory-explore', async (c) => {
  try {
    const { query } = await c.req.json().catch(() => ({ query: '' }));
    if (!query) {
      return c.json({ code: 1, message: '请提供探索关键词' }, 400);
    }
    const record = await simulateMemoryExplore(query);
    return c.json({ code: 0, data: record });
  } catch (error) {
    console.error('[learning/memory-explore] error:', error);
    return c.json({ code: 1, message: '记录记忆探索失败' }, 500);
  }
});

// ============================================
// 小龙虾群系统 API
// ============================================

/** 获取所有小龙虾 */
app.get('/lobster/pond', async (c) => {
  try {
    const data = await getLobsterAgents();
    return c.json({ code: 0, data });
  } catch (error) {
    console.error('[pond] error:', error);
    return c.json({ code: 1, message: '获取龙虾群失败' }, 500);
  }
});

/** 获取池塘统计 */
app.get('/lobster/pond/stats', async (c) => {
  try {
    const data = await getPondStats();
    return c.json({ code: 0, data });
  } catch (error) {
    console.error('[pond/stats] error:', error);
    return c.json({ code: 1, message: '获取池塘统计失败' }, 500);
  }
});

/** 喂食小龙虾 */
app.post('/lobster/pond/:id/feed', async (c) => {
  try {
    const id = c.req.param('id');
    const result = await feedLobster(id);
    return c.json({ code: 0, data: result });
  } catch (error) {
    console.error('[pond/feed] error:', error);
    return c.json({ code: 1, message: '喂食失败' }, 500);
  }
});

/** 训练小龙虾 */
app.post('/lobster/pond/:id/train', async (c) => {
  try {
    const id = c.req.param('id');
    const result = await trainLobster(id);
    return c.json({ code: 0, data: result });
  } catch (error) {
    console.error('[pond/train] error:', error);
    return c.json({ code: 1, message: '训练失败' }, 500);
  }
});

/** 让小龙虾休息 */
app.post('/lobster/pond/:id/rest', async (c) => {
  try {
    const id = c.req.param('id');
    const result = await restLobster(id);
    return c.json({ code: 0, data: result });
  } catch (error) {
    console.error('[pond/rest] error:', error);
    return c.json({ code: 1, message: '休息失败' }, 500);
  }
});

// ============================================
// 养殖师系统 API
// ============================================

/** 获取养殖师状态 */
app.get('/lobster/caretaker', async (c) => {
  try {
    const data = await getCaretakerState();
    return c.json({ code: 0, data });
  } catch (error) {
    console.error('[caretaker] error:', error);
    return c.json({ code: 1, message: '获取养殖师状态失败' }, 500);
  }
});

/** 获取养殖师摘要 */
app.get('/lobster/caretaker/summary', async (c) => {
  try {
    const data = await getCaretakerSummary();
    return c.json({ code: 0, data });
  } catch (error) {
    console.error('[caretaker/summary] error:', error);
    return c.json({ code: 1, message: '获取养殖师摘要失败' }, 500);
  }
});

/** 获取养殖师等级信息 */
app.get('/lobster/caretaker/level', async (c) => {
  try {
    const data = await getCaretakerLevelInfo();
    return c.json({ code: 0, data });
  } catch (error) {
    console.error('[caretaker/level] error:', error);
    return c.json({ code: 1, message: '获取等级信息失败' }, 500);
  }
});

/** 记录养殖师行为 */
app.post('/lobster/caretaker/action', async (c) => {
  try {
    const { type, targetLobsterId, details } = await c.req.json().catch(() => ({ 
      type: '', 
      targetLobsterId: undefined, 
      details: '' 
    }));
    
    const validTypes = ['feed', 'train', 'rest', 'clean', 'observe', 'evolve'];
    if (!validTypes.includes(type)) {
      return c.json({ code: 1, message: '无效的行为类型' }, 400);
    }
    
    const result = await recordCaretakerAction(type as any, targetLobsterId, details);
    return c.json({ code: 0, data: result });
  } catch (error) {
    console.error('[caretaker/action] error:', error);
    return c.json({ code: 1, message: '记录行为失败' }, 500);
  }
});

// ============================================
// 实时监控 API (Realtime Monitor)
// ============================================

/** 获取所有 agent 实时状态 */
app.get('/lobster/realtime/agents', async (c) => {
  try {
    const { realtimeMonitor } = await import('./services/realtimeMonitor');
    const states = realtimeMonitor.getAllAgentStates();
    return c.json({ code: 0, data: states });
  } catch (error) {
    console.error('[realtime/agents] error:', error);
    return c.json({ code: 1, message: '获取实时状态失败' }, 500);
  }
});

/** 获取单个 agent 实时状态 */
app.get('/lobster/realtime/agents/:id', async (c) => {
  try {
    const agentId = c.req.param('id');
    const { realtimeMonitor } = await import('./services/realtimeMonitor');
    const state = realtimeMonitor.getAgentState(agentId);
    if (!state) {
      return c.json({ code: 1, message: 'Agent 不存在' }, 404);
    }
    return c.json({ code: 0, data: state });
  } catch (error) {
    console.error('[realtime/agent] error:', error);
    return c.json({ code: 1, message: '获取实时状态失败' }, 500);
  }
});

/** 获取活跃任务 */
app.get('/lobster/realtime/tasks', async (c) => {
  try {
    const { realtimeMonitor } = await import('./services/realtimeMonitor');
    const tasks = realtimeMonitor.getActiveTasks();
    return c.json({ code: 0, data: tasks });
  } catch (error) {
    console.error('[realtime/tasks] error:', error);
    return c.json({ code: 1, message: '获取活跃任务失败' }, 500);
  }
});

/** 获取今日统计 */
app.get('/lobster/realtime/stats', async (c) => {
  try {
    const { realtimeMonitor } = await import('./services/realtimeMonitor');
    const stats = realtimeMonitor.getTodayStats();
    return c.json({ code: 0, data: stats });
  } catch (error) {
    console.error('[realtime/stats] error:', error);
    return c.json({ code: 1, message: '获取统计数据失败' }, 500);
  }
});

/** 获取协作历史 */
app.get('/lobster/realtime/collaborations', async (c) => {
  try {
    const { realtimeMonitor } = await import('./services/realtimeMonitor');
    const history = realtimeMonitor.getCollaborationHistory();
    return c.json({ code: 0, data: history });
  } catch (error) {
    console.error('[realtime/collaborations] error:', error);
    return c.json({ code: 1, message: '获取协作历史失败' }, 500);
  }
});

/** 启动实时监控 */
app.post('/lobster/realtime/start', async (c) => {
  try {
    const { realtimeMonitor } = await import('./services/realtimeMonitor');
    await realtimeMonitor.start();
    return c.json({ code: 0, data: { success: true, message: '实时监控已启动' } });
  } catch (error) {
    console.error('[realtime/start] error:', error);
    return c.json({ code: 1, message: '启动实时监控失败' }, 500);
  }
});

/** 停止实时监控 */
app.post('/lobster/realtime/stop', async (c) => {
  try {
    const { realtimeMonitor } = await import('./services/realtimeMonitor');
    realtimeMonitor.stop();
    return c.json({ code: 0, data: { success: true, message: '实时监控已停止' } });
  } catch (error) {
    console.error('[realtime/stop] error:', error);
    return c.json({ code: 1, message: '停止实时监控失败' }, 500);
  }
});

export default app;
