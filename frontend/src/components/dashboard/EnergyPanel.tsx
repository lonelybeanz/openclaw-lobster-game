/**
 * 能量核心面板 (Usage → Energy)
 * 映射 Token 使用到游戏化能量和成长进度
 */

import type { EnergyCoreMetrics } from '../../types/dashboard';

interface EnergyPanelProps {
  data: EnergyCoreMetrics;
  isActive?: boolean;
  onClick?: () => void;
}

export function EnergyPanel({ data, isActive, onClick }: EnergyPanelProps) {
  const { dailyEnergy, growthProgress, expRing, consumptionTrend } = data;

  // 计算环形图的 stroke-dasharray
  const circumference = 2 * Math.PI * 54;
  const energyOffset = circumference - (dailyEnergy.percentage / 100) * circumference;
  const expOffset = circumference - (expRing.percentage / 100) * circumference;

  return (
    <div 
      className={`dashboard-card energy-card ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="card-header">
        <div className="card-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}>
          ⚡
        </div>
        <div className="card-title">
          <h3>能量核心</h3>
          <span className="card-subtitle">Energy Core</span>
        </div>
      </div>

      <div className="card-body">
        {/* 双环形图 */}
        <div className="energy-rings">
          {/* 能量环 */}
          <div className="ring-container">
            <svg className="progress-ring" viewBox="0 0 120 120">
              {/* 背景环 */}
              <circle
                className="ring-bg"
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="rgba(245, 158, 11, 0.2)"
                strokeWidth="8"
              />
              {/* 能量进度 */}
              <circle
                className="ring-progress energy-ring"
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="url(#energyGradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={energyOffset}
                transform="rotate(-90 60 60)"
              />
              <defs>
                <linearGradient id="energyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
              </defs>
            </svg>
            <div className="ring-content">
              <span className="ring-value">{Math.floor(dailyEnergy.remaining / 1000)}K</span>
              <span className="ring-label">能量剩余</span>
            </div>
          </div>

          {/* 经验环 */}
          <div className="ring-container">
            <svg className="progress-ring" viewBox="0 0 120 120">
              <circle
                className="ring-bg"
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="rgba(139, 92, 246, 0.2)"
                strokeWidth="8"
              />
              <circle
                className="ring-progress exp-ring"
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="url(#expGradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={expOffset}
                transform="rotate(-90 60 60)"
              />
              <defs>
                <linearGradient id="expGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#a78bfa" />
                </linearGradient>
              </defs>
            </svg>
            <div className="ring-content">
              <span className="ring-value">{expRing?.level || 1}</span>
              <span className="ring-label">等级</span>
            </div>
          </div>
        </div>

        {/* 数值详情 */}
        <div className="energy-stats">
          <div className="energy-stat-item">
            <span className="stat-label">今日消耗</span>
            <span className="stat-value consumed">{(dailyEnergy?.consumed || 0).toLocaleString()}</span>
          </div>
          <div className="energy-stat-item">
            <span className="stat-label">每日上限</span>
            <span className="stat-value limit">{(dailyEnergy?.limit || 100000).toLocaleString()}</span>
          </div>
          <div className="energy-stat-item">
            <span className="stat-label">成长进度</span>
            <span className="stat-value progress">{(growthProgress?.percentage || 0)}%</span>
          </div>
        </div>

        {/* 经验条 */}
        <div className="exp-bar-mini">
          <div className="exp-label">
            <span>EXP</span>
            <span>{(expRing.currentExp || 0).toLocaleString()} / {(expRing.maxExp || 50000).toLocaleString()}</span>
          </div>
          <div className="progress-bar mini">
            <div 
              className="progress-fill exp-fill"
              style={{ width: `${expRing.percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* 扩展内容：趋势图 */}
      {isActive && consumptionTrend.length > 0 && (
        <div className="card-expanded">
          <h4>能量消耗趋势</h4>
          <div className="trend-bars">
            {consumptionTrend.map((item, idx) => {
              const max = Math.max(...consumptionTrend.map(t => t.value));
              const height = max > 0 ? (item.value / max) * 100 : 0;
              return (
                <div key={idx} className="trend-bar-item">
                  <div 
                    className="trend-bar-fill"
                    style={{ height: `${height}%` }}
                    title={`${item.label}: ${item.value.toLocaleString()}`}
                  />
                  <span className="trend-label">{item.label.slice(-2)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
