import type { Server, ServerWebSocket } from 'bun';
import app from './src/app';
import { dialogueTracker } from './src/services/dialogueTracker';
import { realtimeMonitor } from './src/services/realtimeMonitor';
import { wsManager } from './src/services/websocket';

realtimeMonitor.start().then(() => {
  console.log('[Server] Realtime monitor started');
});

dialogueTracker.start().then(() => {
  console.log('[Server] Dialogue tracker started');
});

wsManager.initialize();

type WsData = Record<string, never>;

const websocketHandler = {
  message(ws: ServerWebSocket<WsData>, message: string | Buffer) {
    const msg = typeof message === 'string' ? message : message.toString();
    wsManager.handleMessage(ws as any, msg);
  },
  open(ws: ServerWebSocket<WsData>) {
    wsManager.handleConnection(ws as any);
  },
  close(ws: ServerWebSocket<WsData>) {
    wsManager.handleDisconnect(ws as any);
  },
  drain(_ws: ServerWebSocket<WsData>) {
    // 处理背压
  },
};

export default {
  port: 13000,
  fetch(req: Request, server: Server<WsData>) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      const success = server.upgrade(req, { data: {} });
      if (success) {
        return undefined;
      }
    }

    return app.fetch(req, server);
  },
  websocket: websocketHandler,
  idleTimeout: 0,
};
