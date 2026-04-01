import app from './src/app';
import { realtimeMonitor } from './src/services/realtimeMonitor';

// 启动实时监控
realtimeMonitor.start().then(() => {
  console.log('[Server] Realtime monitor started');
});

export default {
  port: 13000,
  fetch: app.fetch,
  idleTimeout: 0, // 禁用空闲超时
};
