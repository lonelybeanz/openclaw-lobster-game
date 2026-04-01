/**
 * WebSocket Hook for Real-time Updates
 * 
 * 提供前端 WebSocket 连接管理
 * - 自动重连
 * - 心跳检测
 * - 消息订阅
 * - 状态同步
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export type ServerMessage =
  | { type: 'agentStatusChanged'; agentId: string; status: string; timestamp: string }
  | { type: 'taskStarted'; agentId: string; task: any; timestamp: string }
  | { type: 'taskUpdated'; agentId: string; taskId: string; update: any; timestamp: string }
  | { type: 'taskCompleted'; agentId: string; task: any; timestamp: string }
  | { type: 'toolUsed'; agentId: string; toolName: string; taskId: string; timestamp: string }
  | { type: 'collaboration'; event: any; timestamp: string }
  | { type: 'system'; level: 'info' | 'warning' | 'error'; message: string; timestamp: string }
  | { type: 'statsUpdate'; stats: any; timestamp: string }
  | { type: 'initialState'; agents: any[]; timestamp: string }
  | { type: 'pong'; timestamp: string };

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface UseWebSocketOptions {
  onMessage?: (message: ServerMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    autoReconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [agents, setAgents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [systemMessages, setSystemMessages] = useState<{ level: string; message: string; time: Date }[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 连接 WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');

    const wsUrl = `ws://localhost:13000/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WebSocket] Connected');
      setStatus('connected');
      reconnectAttemptsRef.current = 0;
      onConnect?.();

      // 开始心跳
      pingTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);
        
        // 处理不同类型的消息
        switch (message.type) {
          case 'initialState':
            setAgents(message.agents);
            break;
          case 'agentStatusChanged':
            setAgents(prev =>
              prev.map(agent =>
                agent.agentId === message.agentId
                  ? { ...agent, status: message.status }
                  : agent
              )
            );
            break;
          case 'taskStarted':
          case 'taskCompleted':
            // 更新 agent 的任务信息
            setAgents(prev =>
              prev.map(agent =>
                agent.agentId === message.agentId
                  ? { ...agent, currentTask: message.task }
                  : agent
              )
            );
            break;
          case 'taskUpdated':
            // 任务更新不覆盖整个任务
            break;
          case 'statsUpdate':
            setStats(message.stats);
            break;
          case 'system':
            setSystemMessages(prev => [
              ...prev.slice(-9), // 只保留最近10条
              { level: message.level, message: message.message, time: new Date() },
            ]);
            break;
          case 'pong':
            // 心跳响应，忽略
            break;
        }

        // 调用外部回调
        onMessage?.(message);
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    };

    ws.onclose = () => {
      console.log('[WebSocket] Disconnected');
      setStatus('disconnected');
      onDisconnect?.();

      // 清理定时器
      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }

      // 自动重连
      if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
        setStatus('reconnecting');
        reconnectAttemptsRef.current++;
        
        console.log(`[WebSocket] Reconnecting in ${reconnectInterval}ms (attempt ${reconnectAttemptsRef.current})`);
        
        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, reconnectInterval);
      }
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
    };

    wsRef.current = ws;
  }, [onMessage, onConnect, onDisconnect, autoReconnect, reconnectInterval, maxReconnectAttempts]);

  // 断开连接
  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  // 发送消息
  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // 订阅 agent
  const subscribe = useCallback((agentIds?: string[]) => {
    sendMessage({ type: 'subscribe', agentIds });
  }, [sendMessage]);

  // 取消订阅
  const unsubscribe = useCallback((agentIds?: string[]) => {
    sendMessage({ type: 'unsubscribe', agentIds });
  }, [sendMessage]);

  // 请求同步
  const requestSync = useCallback(() => {
    sendMessage({ type: 'requestSync' });
  }, [sendMessage]);

  // 组件挂载时连接
  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return {
    status,
    agents,
    stats,
    systemMessages,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    requestSync,
  };
}
