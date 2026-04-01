/**
 * WebSocket Server for Real-time Updates
 * 
 * 提供实时数据推送，替代轮询
 * - 员工状态变化实时推送
 * - 新任务实时通知
 * - 协作事件实时广播
 * - 系统消息推送
 */

import type { ServerWebSocket } from 'bun';
import { realtimeMonitor, type AgentRealtimeState, type WorkTask, type CollaborationEvent } from './realtimeMonitor';

// 客户端类型
export type ClientType = 'dashboard' | 'office' | 'admin' | 'mobile';

// 客户端连接信息
interface ClientInfo {
  ws: ServerWebSocket<ClientInfo>;
  type: ClientType;
  subscribedAgents: string[]; // 订阅的 agent IDs，空数组表示订阅所有
  connectedAt: Date;
  lastPing: Date;
}

// 消息类型定义
export type ServerMessage =
  | { type: 'agentStatusChanged'; agentId: string; status: AgentRealtimeState['status']; timestamp: string }
  | { type: 'taskStarted'; agentId: string; task: WorkTask; timestamp: string }
  | { type: 'taskUpdated'; agentId: string; taskId: string; update: { type: string; content?: string }; timestamp: string }
  | { type: 'taskCompleted'; agentId: string; task: WorkTask; timestamp: string }
  | { type: 'toolUsed'; agentId: string; toolName: string; taskId: string; timestamp: string }
  | { type: 'collaboration'; event: CollaborationEvent; timestamp: string }
  | { type: 'system'; level: 'info' | 'warning' | 'error'; message: string; timestamp: string }
  | { type: 'statsUpdate'; stats: { totalTasks: number; activeTasks: number; totalTokens: number; collaborations: number }; timestamp: string }
  | { type: 'initialState'; agents: AgentRealtimeState[]; timestamp: string };

export type ClientMessage =
  | { type: 'subscribe'; agentIds?: string[] }
  | { type: 'unsubscribe'; agentIds?: string[] }
  | { type: 'ping' }
  | { type: 'requestSync' };

class WebSocketManager {
  private clients: Map<string, ClientInfo> = new Map();
  private isInitialized = false;

  /**
   * 初始化 WebSocket 管理器
   */
  initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 监听 realtimeMonitor 事件
    this.setupEventListeners();

    console.log('[WebSocket] Manager initialized');
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 员工状态变化
    realtimeMonitor.on('agentStatusChanged', ({ agentId, status }) => {
      this.broadcast({
        type: 'agentStatusChanged',
        agentId,
        status,
        timestamp: new Date().toISOString(),
      }, [agentId]);
    });

    // 任务开始
    realtimeMonitor.on('taskStarted', ({ agentId, task }) => {
      this.broadcast({
        type: 'taskStarted',
        agentId,
        task,
        timestamp: new Date().toISOString(),
      }, [agentId]);

      // 发送系统通知
      this.broadcast({
        type: 'system',
        level: 'info',
        message: `${agentId} 开始新任务: ${task.description}`,
        timestamp: new Date().toISOString(),
      });
    });

    // 任务更新
    realtimeMonitor.on('taskUpdated', ({ agentId, task, update }) => {
      this.broadcast({
        type: 'taskUpdated',
        agentId,
        taskId: task.id,
        update,
        timestamp: new Date().toISOString(),
      }, [agentId]);
    });

    // 任务完成
    realtimeMonitor.on('taskCompleted', ({ agentId, task }) => {
      this.broadcast({
        type: 'taskCompleted',
        agentId,
        task,
        timestamp: new Date().toISOString(),
      }, [agentId]);

      // 更新统计
      this.broadcastStats();
    });

    // 工具使用
    realtimeMonitor.on('toolUsed', ({ agentId, toolName, taskId }) => {
      this.broadcast({
        type: 'toolUsed',
        agentId,
        toolName,
        taskId,
        timestamp: new Date().toISOString(),
      }, [agentId]);
    });

    // 协作事件
    realtimeMonitor.on('collaboration', (event) => {
      this.broadcast({
        type: 'collaboration',
        event,
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * 处理新的 WebSocket 连接
   */
  handleConnection(ws: ServerWebSocket<ClientInfo>): void {
    const clientId = crypto.randomUUID();
    
    const clientInfo: ClientInfo = {
      ws,
      type: 'dashboard',
      subscribedAgents: [],
      connectedAt: new Date(),
      lastPing: new Date(),
    };

    this.clients.set(clientId, clientInfo);
    
    console.log(`[WebSocket] Client connected: ${clientId}, total: ${this.clients.size}`);

    // 发送初始状态
    const agents = realtimeMonitor.getAllAgentStates();
    this.sendToClient(ws, {
      type: 'initialState',
      agents,
      timestamp: new Date().toISOString(),
    });

    // 设置消息处理器
    ws.data = clientInfo;
  }

  /**
   * 处理消息
   */
  handleMessage(ws: ServerWebSocket<ClientInfo>, message: string): void {
    try {
      const data: ClientMessage = JSON.parse(message);
      const client = Array.from(this.clients.values()).find(c => c.ws === ws);
      
      if (!client) return;

      switch (data.type) {
        case 'subscribe':
          if (data.agentIds) {
            client.subscribedAgents = [...new Set([...client.subscribedAgents, ...data.agentIds])];
          } else {
            client.subscribedAgents = []; // 订阅所有
          }
          break;

        case 'unsubscribe':
          if (data.agentIds) {
            client.subscribedAgents = client.subscribedAgents.filter(id => !data.agentIds?.includes(id));
          }
          break;

        case 'ping':
          client.lastPing = new Date();
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
          break;

        case 'requestSync':
          // 重新发送当前状态
          const agents = realtimeMonitor.getAllAgentStates();
          this.sendToClient(ws, {
            type: 'initialState',
            agents,
            timestamp: new Date().toISOString(),
          });
          break;
      }
    } catch (error) {
      console.error('[WebSocket] Invalid message:', error);
    }
  }

  /**
   * 处理断开连接
   */
  handleDisconnect(ws: ServerWebSocket<ClientInfo>): void {
    for (const [clientId, client] of this.clients) {
      if (client.ws === ws) {
        this.clients.delete(clientId);
        console.log(`[WebSocket] Client disconnected: ${clientId}, total: ${this.clients.size}`);
        break;
      }
    }
  }

  /**
   * 广播消息给所有订阅的客户端
   */
  private broadcast(message: ServerMessage, agentIds?: string[]): void {
    const messageStr = JSON.stringify(message);

    for (const client of this.clients.values()) {
      // 检查是否订阅了相关 agent
      if (agentIds && agentIds.length > 0) {
        const isSubscribed = client.subscribedAgents.length === 0 || 
          agentIds.some(id => client.subscribedAgents.includes(id));
        if (!isSubscribed) continue;
      }

      try {
        client.ws.send(messageStr);
      } catch (error) {
        console.error('[WebSocket] Send failed:', error);
      }
    }
  }

  /**
   * 发送消息给指定客户端
   */
  private sendToClient(ws: ServerWebSocket<ClientInfo>, message: ServerMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('[WebSocket] Send failed:', error);
    }
  }

  /**
   * 广播统计更新
   */
  private broadcastStats(): void {
    const stats = realtimeMonitor.getTodayStats();
    this.broadcast({
      type: 'statsUpdate',
      stats: {
        totalTasks: stats.totalTasks,
        activeTasks: stats.activeTasks,
        totalTokens: stats.totalTokens,
        collaborations: stats.collaborations,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 发送系统消息
   */
  sendSystemMessage(level: 'info' | 'warning' | 'error', message: string): void {
    this.broadcast({
      type: 'system',
      level,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 获取连接统计
   */
  getStats(): { total: number; byType: Record<ClientType, number> } {
    const byType: Record<ClientType, number> = {
      dashboard: 0,
      office: 0,
      admin: 0,
      mobile: 0,
    };

    for (const client of this.clients.values()) {
      byType[client.type]++;
    }

    return {
      total: this.clients.size,
      byType,
    };
  }
}

// 导出单例
export const wsManager = new WebSocketManager();
