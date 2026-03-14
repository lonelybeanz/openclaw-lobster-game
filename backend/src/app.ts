import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCompleteLobsterStats } from './services/complete';
import { getOpenClawNews } from './services/news';
import { getTokenStats, initTokenStats, updateTokenStats } from './services/tokenStats';
import { interact, loadLobsterState, getAchievements } from './services/persistence';
import { initModelBenchmarkUpdater } from './services/modelBenchmark';

const app = new Hono();

app.use('*', cors());

// 初始化（降级启动，不阻塞服务）
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

// 完整的龙虾数据
app.get('/lobster/stats', async (c) => {
  const stats = await getCompleteLobsterStats();
  
  // 合并持久化状态
  const lobsterState = await loadLobsterState();
  
  return c.json({ 
    code: 0, 
    data: {
      ...stats,
      hunger: lobsterState.hunger,
      mood: lobsterState.mood,
      fatigue: lobsterState.fatigue,
      loyalty: lobsterState.loyalty,
      level: lobsterState.level,
      experience: lobsterState.experience,
      experiencePool: stats.experiencePool + lobsterState.experience,
      totalInteractions: lobsterState.totalInteractions
    } 
  });
});

// 资讯
app.get('/lobster/news', async (c) => {
  const news = await getOpenClawNews();
  return c.json({ code: 0, data: news });
});

// Token 统计
app.get('/lobster/tokens', async (c) => {
  const stats = await getTokenStats();
  return c.json({ code: 0, data: stats });
});

// 互动接口 - 喂食/训练/休息
app.post('/lobster/interact', async (c) => {
  const { action } = await c.req.json();
  
  if (!['feed', 'train', 'rest'].includes(action)) {
    return c.json({ code: 1, message: '无效动作' }, 400);
  }
  
  const result = await interact(action);
  return c.json({ 
    code: 0, 
    data: {
      ...result.state,
      message: result.message,
      expGained: result.exp,
      randomEvent: result.randomEvent
    } 
  });
});

// 获取成就
app.get('/lobster/achievements', async (c) => {
  const achievements = await getAchievements();
  return c.json({ code: 0, data: achievements });
});

// Token 增量更新
app.post('/lobster/tokens', async (c) => {
  const { tokens } = await c.req.json();
  if (tokens !== undefined && (!Number.isFinite(tokens) || tokens < 0)) {
    return c.json({ code: 1, message: 'tokens 必须是非负数字' }, 400);
  }
  await updateTokenStats(tokens);
  return c.json({ code: 0, message: '已更新' });
});

export default app;
