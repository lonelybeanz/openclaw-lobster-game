/**
 * 龙虾健康仪表盘 (Overview → Health)
 * 映射系统健康状态到游戏化 HP/Stamina
 */

import type { LobsterHealthMetrics } from '../../types/dashboard';

interface HealthPanelProps {
  data: LobsterHealthMetrics;
  isActive?: boolean;
  onClick?: () => void;
}

export function HealthPanel({ data, isActive, onClick }: HealthPanelProps) {
  const { hp, stamina, overallStatus, healthTips, uptimeDays } = data;

  const statusConfig = {
    excellent: { color: '#22c55e', icon: '💚', label: '极佳', glow: '0 0 20px rgba(34, 197, 94, 0.5)' },
    good: { color: '#3b82f6', icon: '💙', label: '良好', glow: '0 0 15px rgba(59, 130, 246, 0.4)' },
    warning: { color: '#f59e0b', icon: '💛', label: '警告', glow: '0 0 15px rgba(245, 158, 11, 0.4)' },
    critical: { color: '#ef4444', icon: '❤️', label: '危急', glow: '0 0 25px rgba(239, 68, 68, 0.6)' },
  };

  const status = statusConfig[overallStatus];

  return (
    <div 
      className={`dashboard-card health-card ${isActive ? 'active' : ''}`}
      onClick={onClick}
      style={{ '--status-glow': status.glow } as React.CSSProperties}
    >
      <div className="card-header">
        <div className="card-icon" style={{ background: status.color }}>
          🏥
        </div>
        <div className="card-title">
          <h3>健康中心</h3>
          <span className="card-subtitle">Health Center</span>
        </div>
        <div className="status-badge" style={{ background: status.color }}>
          {status.icon} {status.label}
        </div>
      </div>

      <div className="card-body">
        {/* 体力条 (HP) */}
        <div className="stat-bar">
          <div className="stat-label-row">
            <span className="stat-name">
              <span className="stat-icon">❤️</span> 体力 (HP)
            </span>
            <span className="stat-value">{hp.current}/{hp.max}</span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill hp-fill"
              style={{ 
                width: `${hp.percentage}%`,
                background: hp.percentage > 60 ? '#22c55e' : hp.percentage > 30 ? '#f59e0b' : '#ef4444'
              }}
            />
          </div>
          <span className="stat-desc">基于系统 Memory 使用率</span>
        </div>

        {/* 新陈代谢条 */}
        <div className="stat-bar">
          <div className="stat-label-row">
            <span className="stat-name">
              <span className="stat-icon">⚡</span> 新陈代谢
            </span>
            <span className="stat-value">{stamina.current}/{stamina.max}</span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill stamina-fill"
              style={{ 
                width: `${stamina.percentage}%`,
                background: 'linear-gradient(90deg, #3b82f6, #06b6d4)'
              }}
            />
          </div>
          <span className="stat-desc">基于 CPU 负载</span>
        </div>

        {/* 寿命显示 */}
        <div className="uptime-display">
          <span className="uptime-icon">⏱️</span>
          <span className="uptime-value">{uptimeDays}</span>
          <span className="uptime-unit">天寿命</span>
        </div>

        {/* 健康提示 */}
        <div className="health-tips">
          {healthTips.slice(0, 2).map((tip, index) => (
            <div key={index} className="tip-item">
              {tip}
            </div>
          ))}
        </div>
      </div>

      {/* 扩展内容 */}
      {isActive && (
        <div className="card-expanded">
          <h4>详细指标</h4>
          <div className="detailed-stats">
            {data.loadHistory.map((record, idx) => (
              <div key={idx} className="detail-row">
                <span>{new Date(record.timestamp).toLocaleTimeString()}</span>
                <span>CPU: {record.cpu.toFixed(1)}%</span>
                <span>Memory: {record.memory.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
