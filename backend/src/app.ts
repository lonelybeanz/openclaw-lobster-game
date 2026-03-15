import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCompleteLobsterStats } from './services/complete';
import { getOpenClawNews, searchWithOpenClaw, searchWithOpenClawAsync, getSearchResult } from './services/news';
import { getTokenStats, initTokenStats, updateTokenStats } from './services/tokenStats';
import { interact, loadLobsterState, getAchievements, saveLobsterState } from './services/persistence';
import { initModelBenchmarkUpdater } from './services/modelBenchmark';
import { getMilestones, generateCareMessage, enhanceMilestones } from './services/milestones';
import { checkOpenClawStatus, chatWithLobster } from './services/openclaw';
import { createTtlCache } from './services/cache';
import { getPromptStats } from './services/promptStats';

const app = new Hono();
const CACHE_TTL_MS = 5 * 60 * 1000;
const STATS_CACHE_TTL_MS = 20 * 1000;
const NEWS_CACHE_TTL_MS = 60 * 1000;
const MILESTONES_CACHE_TTL_MS = 30 * 1000;
const CARE_CACHE_TTL_MS = 30 * 1000;

type StatsResponseData = Awaited<ReturnType<typeof getCompleteLobsterStats>> & {
  hunger: number;
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
const newsCache = createTtlCache<Awaited<ReturnType<typeof getOpenClawNews>>>(NEWS_CACHE_TTL_MS);
const milestonesCache = createTtlCache<Awaited<ReturnType<typeof getMilestones>>>(MILESTONES_CACHE_TTL_MS);
const careMessageCache = createTtlCache<{ message: string | null }>(CARE_CACHE_TTL_MS);

function clearDynamicCaches() {
  statsCache.clear();
  achievementsCache.clear();
  milestonesCache.clear();
  careMessageCache.clear();
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

app.get('/lobster/stats', async (c) => {
  const data = await statsCache.get(async () => {
    const [stats, lobsterState] = await Promise.all([getCompleteLobsterStats(), loadLobsterState()]);
    return {
      ...stats,
      hunger: lobsterState.hunger,
      mood: lobsterState.mood,
      fatigue: lobsterState.fatigue,
      loyalty: lobsterState.loyalty,
      level: lobsterState.level,
      experience: lobsterState.experience,
      experiencePool: stats.experiencePool + lobsterState.experience,
      totalInteractions: lobsterState.totalInteractions,
    };
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
    return getMilestones(stats, milestoneStats);
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

export default app;
