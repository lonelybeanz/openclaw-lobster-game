/**
 * Office View - 实时办公室视图
 * 
 * 展示 OpenClaw Agent 的实时工作状态
 * - 办公室布局：不同部门位置
 * - 实时动画：工作中的龙虾
 * - 任务气泡：显示当前任务
 * - 协作连线：跨部门协作可视化
 */

import { useState, useEffect, useCallback } from 'react';
import type { LobsterAgent } from '../api';
import { useWebSocket } from '../hooks/useWebSocket';

// 任务类型图标
const taskIcons: Record<string, string> = {
  coding: '👨‍💻',
  planning: '📊',
  research: '🔬',
  review: '👀',
  debug: '🐛',
  meeting: '💬',
  writing: '📝',
  learning: '📚',
  maintenance: '🔧',
  unknown: '📋',
};

// 状态动画
const statusAnimations: Record<string, string> = {
  working: 'animate-pulse',
  idle: 'animate-bounce',
  resting: 'animate-pulse',
  offline: 'opacity-50',
};

interface AgentRealtimeState {
  agentId: string;
  status: 'working' | 'idle' | 'resting' | 'offline';
  currentTask?: {
    id: string;
    type: string;
    description: string;
    status: string;
    tokenConsumed: number;
    toolsUsed: { name: string; count: number }[];
  };
  todayTasks: any[];
  toolsUsed: { name: string; count: number; lastUsed: string }[];
  lastActive: string;
  efficiency: number;
  burnoutRisk: number;
}

interface OfficeAgent extends LobsterAgent {
  realtime?: AgentRealtimeState;
  officePosition: { x: number; y: number };
}

interface OfficeViewProps {
  agents: LobsterAgent[];
}

export function OfficeView({ agents }: OfficeViewProps) {
  const [officeAgents, setOfficeAgents] = useState<OfficeAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<OfficeAgent | null>(null);
  const [realtimeStats, setRealtimeStats] = useState<any>(null);
  const [showSystemMessages, setShowSystemMessages] = useState(true);

  // 分配办公室位置
  const assignPositions = useCallback((agents: LobsterAgent[]): OfficeAgent[] => {
    const positions: Record<string, { x: number; y: number }> = {
      dev: { x: 15, y: 20 },
      pm: { x: 55, y: 20 },
      main: { x: 35, y: 55 },
      ops: { x: 75, y: 20 },
      research: { x: 15, y: 60 },
      design: { x: 75, y: 60 },
      test: { x: 55, y: 60 },
      other: { x: 85, y: 40 },
    };

    return agents.map((agent, index) => ({
      ...agent,
      officePosition: positions[agent.role] || { x: 50 + index * 10, y: 40 },
    }));
  }, []);

  // 使用 WebSocket 接收实时更新
  const { status: wsStatus, agents: wsAgents, stats: wsStats, systemMessages } = useWebSocket({
    onMessage: (message) => {
      console.log('[OfficeView] Received:', message.type);
    },
    onConnect: () => {
      console.log('[OfficeView] WebSocket connected');
    },
    onDisconnect: () => {
      console.log('[OfficeView] WebSocket disconnected');
    },
  });

  // 初始化办公室布局
  useEffect(() => {
    setOfficeAgents(assignPositions(agents));
  }, [agents, assignPositions]);

  // 同步 WebSocket 数据到本地状态
  useEffect(() => {
    if (wsAgents.length > 0) {
      setOfficeAgents(prev =>
        prev.map(agent => {
          const wsAgent = wsAgents.find((a: any) => a.agentId === agent.id);
          if (wsAgent) {
            return {
              ...agent,
              realtime: wsAgent as AgentRealtimeState,
            };
          }
          return agent;
        })
      );
    }
  }, [wsAgents]);

  // 同步统计数据
  useEffect(() => {
    if (wsStats) {
      setRealtimeStats(wsStats);
    }
  }, [wsStats]);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'working': return '#22c55e'; // green
      case 'idle': return '#3b82f6'; // blue
      case 'resting': return '#f59e0b'; // yellow
      case 'offline': return '#6b7280'; // gray
      default: return '#6b7280';
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'working': return '工作中';
      case 'idle': return '空闲';
      case 'resting': return '休息';
      case 'offline': return '离线';
      default: return '未知';
    }
  };

  return (
    <div className="office-container">
      {/* 办公室背景 */}
      <div className="office-floor">
        {/* 部门标签 */}
        <div className="dept-label" style={{ left: '10%', top: '5%' }}>🖥️ 开发部</div>
        <div className="dept-label" style={{ left: '50%', top: '5%' }}>📊 产品部</div>
        <div className="dept-label" style={{ left: '30%', top: '45%' }}>🏢 总部</div>
        <div className="dept-label" style={{ left: '70%', top: '5%' }}>🔧 运维部</div>
        
        {/* 协作区 */}
        <div className="collab-zone">
          <span>🤝 协作区</span>
        </div>

        {/* Agent 位置 */}
        {officeAgents.map(agent => {
          const rt = agent.realtime;
          const isWorking = rt?.status === 'working';
          
          return (
            <div
              key={agent.id}
              className={`office-agent ${statusAnimations[rt?.status || 'offline']}`}
              style={{
                left: `${agent.officePosition.x}%`,
                top: `${agent.officePosition.y}%`,
              }}
              onClick={() => setSelectedAgent(agent)}
            >
              {/* 工位背景 */}
              <div className="desk">
                <div 
                  className="status-indicator"
                  style={{ backgroundColor: getStatusColor(rt?.status) }}
                />
                
                {/* 龙虾头像 */}
                <div className="agent-avatar" style={{ fontSize: '2rem' }}>
                  {agent.emoji}
                </div>
                
                {/* 名字标签 */}
                <div className="agent-name-tag">
                  {agent.name}
                </div>
                
                {/* 当前任务气泡 */}
                {isWorking && rt?.currentTask && (
                  <div className="task-bubble">
                    <span className="task-icon">
                      {taskIcons[rt.currentTask.type] || '📋'}
                    </span>
                    <span className="task-desc">
                      {rt.currentTask.description.slice(0, 15)}...
                    </span>
                  </div>
                )}
                
                {/* 疲劳度指示器 */}
                {rt && rt.burnoutRisk > 50 && (
                  <div className="burnout-warning">⚠️</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部状态栏 */}
      <div className="office-status-bar">
        <div className="stat-item">
          <span>💼 活跃员工: {realtimeStats?.activeTasks || 0}/{officeAgents.length}</span>
        </div>
        <div className="stat-item">
          <span>📊 今日任务: {realtimeStats?.totalTasks || 0}</span>
        </div>
        <div className="stat-item">
          <span>⚡ Token消耗: {(realtimeStats?.totalTokens || 0).toLocaleString()}</span>
        </div>
        <div className="stat-item">
          <span>🤝 协作次数: {realtimeStats?.collaborations || 0}</span>
        </div>
        <div className={`ws-status ${wsStatus}`}>
          {wsStatus === 'connected' ? '🟢 实时' : 
           wsStatus === 'reconnecting' ? '🟡 重连' : 
           wsStatus === 'connecting' ? '🔵 连接' : '🔴 离线'}
        </div>
      </div>

      {/* 系统消息面板 */}
      {showSystemMessages && systemMessages.length > 0 && (
        <div className="system-messages">
          <div className="messages-header">
            <span>📢 系统消息</span>
            <button onClick={() => setShowSystemMessages(false)}>×</button>
          </div>
          <div className="messages-list">
            {systemMessages.slice(-3).map((msg, i) => (
              <div key={i} className={`message-item ${msg.level}`}>
                <span className="message-time">{msg.time.toLocaleTimeString()}</span>
                <span className="message-content">{msg.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 选中 Agent 详情弹窗 */}
      {selectedAgent && (
        <AgentDetailModal
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
        />
      )}

      <style>{`
        .office-container {
          position: relative;
          width: 100%;
          height: 600px;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border-radius: 16px;
          overflow: hidden;
        }

        .office-floor {
          position: relative;
          width: 100%;
          height: calc(100% - 50px);
          background-image: 
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 50px 50px;
        }

        .dept-label {
          position: absolute;
          padding: 4px 12px;
          background: rgba(255,255,255,0.1);
          border-radius: 8px;
          font-size: 12px;
          color: rgba(255,255,255,0.6);
        }

        .collab-zone {
          position: absolute;
          right: 5%;
          bottom: 10%;
          width: 15%;
          height: 20%;
          border: 2px dashed rgba(255,255,255,0.2);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255,255,255,0.4);
          font-size: 14px;
        }

        .office-agent {
          position: absolute;
          transform: translate(-50%, -50%);
          cursor: pointer;
          transition: transform 0.2s;
        }

        .office-agent:hover {
          transform: translate(-50%, -50%) scale(1.1);
        }

        .desk {
          position: relative;
          width: 80px;
          height: 80px;
          background: rgba(255,255,255,0.1);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(10px);
        }

        .status-indicator {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .agent-name-tag {
          position: absolute;
          bottom: -20px;
          white-space: nowrap;
          font-size: 11px;
          color: rgba(255,255,255,0.8);
          background: rgba(0,0,0,0.5);
          padding: 2px 8px;
          border-radius: 4px;
        }

        .task-bubble {
          position: absolute;
          top: -40px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(59, 130, 246, 0.9);
          padding: 4px 12px;
          border-radius: 16px;
          font-size: 11px;
          color: white;
          white-space: nowrap;
          animation: float 3s ease-in-out infinite;
          z-index: 10;
        }

        @keyframes float {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-5px); }
        }

        .task-icon {
          margin-right: 4px;
        }

        .burnout-warning {
          position: absolute;
          top: -5px;
          left: -5px;
          font-size: 16px;
          animation: shake 1s infinite;
        }

        @keyframes shake {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-10deg); }
          75% { transform: rotate(10deg); }
        }

        .office-status-bar {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 50px;
          background: rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: space-around;
          padding: 0 20px;
          backdrop-filter: blur(10px);
        }

        .stat-item {
          font-size: 13px;
          color: rgba(255,255,255,0.8);
        }

        .ws-status {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
        }

        .ws-status.connected {
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
        }

        .ws-status.reconnecting {
          background: rgba(245, 158, 11, 0.2);
          color: #f59e0b;
          animation: blink 1s infinite;
        }

        .ws-status.connecting {
          background: rgba(59, 130, 246, 0.2);
          color: #3b82f6;
        }

        .ws-status.disconnected {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .system-messages {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 280px;
          background: rgba(0,0,0,0.8);
          border-radius: 8px;
          overflow: hidden;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .messages-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: rgba(255,255,255,0.05);
          font-size: 12px;
          color: rgba(255,255,255,0.8);
        }

        .messages-header button {
          background: none;
          border: none;
          color: rgba(255,255,255,0.5);
          cursor: pointer;
          font-size: 16px;
        }

        .messages-list {
          max-height: 150px;
          overflow-y: auto;
        }

        .message-item {
          padding: 8px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          font-size: 11px;
        }

        .message-item:last-child {
          border-bottom: none;
        }

        .message-item.info { border-left: 3px solid #3b82f6; }
        .message-item.warning { border-left: 3px solid #f59e0b; }
        .message-item.error { border-left: 3px solid #ef4444; }

        .message-time {
          color: rgba(255,255,255,0.4);
          margin-right: 8px;
        }

        .message-content {
          color: rgba(255,255,255,0.8);
        }

        .animate-pulse {
          animation: agent-pulse 2s infinite;
        }

        @keyframes agent-pulse {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.2); }
        }

        .animate-bounce {
          animation: agent-bounce 2s infinite;
        }

        @keyframes agent-bounce {
          0%, 100% { transform: translate(-50%, -50%) translateY(0); }
          50% { transform: translate(-50%, -50%) translateY(-3px); }
        }
      `}</style>
    </div>
  );
}

// Agent 详情弹窗
function AgentDetailModal({ agent, onClose }: { agent: OfficeAgent; onClose: () => void }) {
  const rt = agent.realtime;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        
        <div className="modal-header">
          <span className="modal-emoji">{agent.emoji}</span>
          <div>
            <h3>{agent.name}</h3>
            <span className="modal-role">{agent.role} · {agent.personality}</span>
          </div>
        </div>

        <div className="modal-body">
          {/* 状态概览 */}
          <div className="status-grid">
            <div className="status-item">
              <label>当前状态</label>
              <span className={`status-badge ${rt?.status || 'offline'}`}>
                {rt?.status === 'working' ? '👨‍💻 工作中' : 
                 rt?.status === 'idle' ? '💤 空闲' : 
                 rt?.status === 'resting' ? '☕ 休息' : '😴 离线'}
              </span>
            </div>
            <div className="status-item">
              <label>工作效率</label>
              <span className="efficiency">{rt?.efficiency || 0}%</span>
            </div>
            <div className="status-item">
              <label>疲劳风险</label>
              <span className={`burnout-risk ${(rt?.burnoutRisk || 0) > 50 ? 'high' : 'low'}`}>
                {rt?.burnoutRisk || 0}%
              </span>
            </div>
          </div>

          {/* 当前任务 */}
          {rt?.currentTask && (
            <div className="current-task">
              <h4>📋 当前任务</h4>
              <div className="task-card">
                <div className="task-type">
                  {taskIcons[rt.currentTask.type] || '📋'} {rt.currentTask.type}
                </div>
                <div className="task-desc">{rt.currentTask.description}</div>
                {rt.currentTask.toolsUsed.length > 0 && (
                  <div className="task-tools">
                    {rt.currentTask.toolsUsed.map(tool => (
                      <span key={tool.name} className="tool-tag">
                        {tool.name} x{tool.count}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 今日统计 */}
          <div className="today-stats">
            <h4>📊 今日统计</h4>
            <div className="stats-row">
              <div className="stat">
                <span className="stat-value">{rt?.todayTasks?.length || 0}</span>
                <span className="stat-label">完成任务</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {(rt?.todayTasks?.reduce((sum, t) => sum + (t.tokenConsumed || 0), 0) || 0).toLocaleString()}
                </span>
                <span className="stat-label">Token消耗</span>
              </div>
              <div className="stat">
                <span className="stat-value">{rt?.toolsUsed?.length || 0}</span>
                <span className="stat-label">使用工具</span>
              </div>
            </div>
          </div>

          {/* 最近使用工具 */}
          {rt?.toolsUsed && rt.toolsUsed.length > 0 && (
            <div className="tools-section">
              <h4>🛠️ 最近使用工具</h4>
              <div className="tools-list">
                {rt.toolsUsed.slice(0, 5).map(tool => (
                  <div key={tool.name} className="tool-item">
                    <span className="tool-name">{tool.name}</span>
                    <span className="tool-count">{tool.count}次</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="modal-actions">
          <button className="action-btn feed">🍖 投喂</button>
          <button className="action-btn train">💪 训练</button>
          <button className="action-btn rest">😴 安排休息</button>
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }

        .modal-content {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border-radius: 16px;
          padding: 24px;
          width: 90%;
          max-width: 500px;
          max-height: 80vh;
          overflow-y: auto;
          position: relative;
          border: 1px solid rgba(255,255,255,0.1);
        }

        .modal-close {
          position: absolute;
          top: 12px;
          right: 12px;
          background: none;
          border: none;
          color: rgba(255,255,255,0.6);
          font-size: 24px;
          cursor: pointer;
        }

        .modal-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
        }

        .modal-emoji {
          font-size: 48px;
        }

        .modal-header h3 {
          margin: 0;
          color: white;
        }

        .modal-role {
          color: rgba(255,255,255,0.6);
          font-size: 13px;
        }

        .status-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }

        .status-item {
          background: rgba(255,255,255,0.05);
          padding: 12px;
          border-radius: 8px;
          text-align: center;
        }

        .status-item label {
          display: block;
          font-size: 11px;
          color: rgba(255,255,255,0.5);
          margin-bottom: 4px;
        }

        .status-badge {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
        }

        .status-badge.working { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
        .status-badge.idle { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
        .status-badge.resting { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
        .status-badge.offline { background: rgba(107, 114, 128, 0.2); color: #6b7280; }

        .efficiency { color: #22c55e; font-weight: bold; }
        .burnout-risk.low { color: #22c55e; }
        .burnout-risk.high { color: #ef4444; }

        .current-task, .today-stats, .tools-section {
          margin-bottom: 20px;
        }

        .current-task h4, .today-stats h4, .tools-section h4 {
          color: rgba(255,255,255,0.8);
          font-size: 14px;
          margin-bottom: 12px;
        }

        .task-card {
          background: rgba(59, 130, 246, 0.1);
          border-left: 3px solid #3b82f6;
          padding: 12px;
          border-radius: 8px;
        }

        .task-type {
          font-size: 12px;
          color: #3b82f6;
          margin-bottom: 4px;
        }

        .task-desc {
          color: white;
          font-size: 13px;
        }

        .task-tools {
          margin-top: 8px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .tool-tag {
          background: rgba(255,255,255,0.1);
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          color: rgba(255,255,255,0.7);
        }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .stat {
          background: rgba(255,255,255,0.05);
          padding: 16px;
          border-radius: 8px;
          text-align: center;
        }

        .stat-value {
          display: block;
          font-size: 24px;
          font-weight: bold;
          color: white;
        }

        .stat-label {
          font-size: 11px;
          color: rgba(255,255,255,0.5);
        }

        .tools-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .tool-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 12px;
          background: rgba(255,255,255,0.05);
          border-radius: 6px;
        }

        .tool-name {
          color: rgba(255,255,255,0.8);
          font-size: 13px;
        }

        .tool-count {
          color: rgba(255,255,255,0.5);
          font-size: 12px;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          margin-top: 20px;
        }

        .action-btn {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          transition: opacity 0.2s;
        }

        .action-btn:hover {
          opacity: 0.8;
        }

        .action-btn.feed { background: linear-gradient(135deg, #f59e0b, #fbbf24); color: white; }
        .action-btn.train { background: linear-gradient(135deg, #8b5cf6, #a78bfa); color: white; }
        .action-btn.rest { background: linear-gradient(135deg, #3b82f6, #60a5fa); color: white; }
      `}</style>
    </div>
  );
}
