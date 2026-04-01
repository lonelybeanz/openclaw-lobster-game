import app from './src/app';
import { realtimeMonitor } from './src/services/realtimeMonitor';
import { wsManager } from './src/services/websocket';

// 启动实时监控
realtimeMonitor.start().then(() => {
  console.log('[Server] Realtime monitor started');
});

// 初始化 WebSocket 管理器
wsManager.initialize();

// WebSocket 处理器
const websocketHandler = {
  message(ws, message) {
    const msg = typeof message === 'string' ? message : message.toString();
    wsManager.handleMessage(ws, msg);
  },
  open(ws) {
    wsManager.handleConnection(ws);
  },
  close(ws) {
    wsManager.handleDisconnect(ws);
  },
  drain(ws) {
    // 处理背压
  },
};

export default {
  port: 13000,
  fetch(req, server) {
    // 处理 WebSocket 升级请求
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      const success = server.upgrade(req, { data: {} });
      if (success) {
        return undefined;
      }
    }
    
    // 否则使用 Hono 处理
    return app.fetch(req, server);
  },
  websocket: websocketHandler,
  idleTimeout: 0,
};
