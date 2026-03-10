import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCompleteLobsterStats } from './services/complete';
import { getOpenClawNews } from './services/news';
import { getTokenStats, initTokenStats, updateTokenStats } from './services/tokenStats';

const app = new Hono();

app.use('*', cors());

// 完整的龙虾数据
app.get('/lobster/stats', async (c) => {
  const stats = await getCompleteLobsterStats();
  return c.json({ code: 0, data: stats });
});

// 资讯
app.get('/lobster/news', async (c) => {
  const news = await getOpenClawNews();
  return c.json({ code: 0, data: news });
});

// Tokens
app.get('/lobster/tokens', async (c) => {
  const stats = await getTokenStats();
  return c.json({ code: 0, data: stats });
});

app.post('/lobster/tokens/init', async (c) => {
  const stats = await initTokenStats();
  return c.json({ code: 0, data: stats });
});

app.post('/lobster/tokens/update', async (c) => {
  const result = await updateTokenStats();
  return c.json({ code: 0, data: result });
});

// 喂食
app.post('/lobster/feed', async (c) => {
  return c.json({ 
    code: 0, 
    data: { 
      message: '🍕 小龙虾饱餐一顿，开心！',
      hunger: 100,
      mood: 90 
    } 
  });
});

// 训练
app.post('/lobster/train', async (c) => {
  return c.json({ 
    code: 0, 
    data: { 
      message: '💪 训练完成，属性提升！',
      experience: 50,
      fatigue: 10
    } 
  });
});

// 休息
app.post('/lobster/rest', async (c) => {
  return c.json({ 
    code: 0, 
    data: { 
      message: '😴 休息中，体力恢复中...',
      fatigue: -30,
      mood: 85
    } 
  });
});

// 主页
app.get('/', (c) => {
  return c.json({ 
    code: 0, 
    data: { 
      name: 'OpenClaw Lobster Game API', 
      version: '1.0.0',
      endpoints: [
        'GET /lobster/stats - 完整数据',
        'GET /lobster/news - 资讯',
        'GET /lobster/tokens - Token统计',
        'POST /lobster/feed - 喂食',
        'POST /lobster/train - 训练',
        'POST /lobster/rest - 休息'
      ]
    } 
  });
});

export default app;
