/**
 * 设施状态面板 (Settings → Facility)
 * 映射系统设置到养殖设施状态
 */

import type { FacilityStatus } from '../../types/dashboard';

interface FacilityPanelProps {
  data: FacilityStatus;
  isActive?: boolean;
  onClick?: () => void;
}

const waterQualityConfig = {
  clear: { 
    color: '#06b6d4', 
    icon: '💧', 
    label: '清澈',
    description: '水质优良，适合龙虾生长',
    waveColor: 'rgba(6, 182, 212, 0.3)'
  },
  slightly_turbid: { 
    color: '#22c55e', 
    icon: '🌊', 
    label: '微浑',
    description: '水质尚可，建议观察',
    waveColor: 'rgba(34, 197, 94, 0.3)'
  },
  turbid: { 
    color: '#f59e0b', 
    icon: '😶\u200d🌫️', 
    label: '浑浊',
    description: '水质需要清理',
    waveColor: 'rgba(245, 158, 11, 0.3)'
  },
  polluted: { 
    color: '#ef4444', 
    icon: '☠️', 
    label: '污染',
    description: '水质严重污染，立即处理！',
    waveColor: 'rgba(239, 68, 68, 0.3)'
  },
};

const tempConfig = {
  comfortable: { color: '#22c55e', icon: '😊', label: '舒适' },
  warm: { color: '#f59e0b', icon: '😅', label: '偏热' },
  hot: { color: '#ef4444', icon: '🥵', label: '过热' },
  cold: { color: '#3b82f6', icon: '🥶', label: '过冷' },
};

const securityConfig = {
  secure: { color: '#22c55e', icon: '🔒', label: '安全' },
  warning: { color: '#f59e0b', icon: '⚠️', label: '警告' },
  danger: { color: '#ef4444', icon: '🚨', label: '危险' },
};

export function FacilityPanel({ data, isActive, onClick }: FacilityPanelProps) {
  const { waterQuality, season, temperature, security } = data;
  const waterConfig = waterQualityConfig[waterQuality.status];
  const tempStatus = tempConfig[temperature.status];
  const secStatus = securityConfig[security.status];

  return (
    <div 
      className={`dashboard-card facility-card ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="card-header">
        <div className="card-icon" style={{ background: 'linear-gradient(135deg, #06b6d4, #22d3ee)' }}>
          🔧
        </div>
        <div className="card-title">
          <h3>设施状态</h3>
          <span className="card-subtitle">Facility Status</span>
        </div>
        <div 
          className="security-badge"
          style={{ background: `${secStatus.color}30`, color: secStatus.color }}
        >
          {secStatus.icon}
        </div>
      </div>

      <div className="card-body">
        {/* 水质可视化 */}
        <div className="water-quality-display">
          <div 
            className="water-tank"
            style={{ 
              background: `linear-gradient(to bottom, ${waterConfig.color}20, ${waterConfig.color}40)`,
              borderColor: waterConfig.color
            }}
          >
            <div 
              className="water-waves"
              style={{ background: waterConfig.waveColor }}
            >
              <div className="wave wave-1" />
              <div className="wave wave-2" />
              <div className="wave wave-3" />
            </div>
            <div className="water-info">
              <span className="water-icon">{waterConfig.icon}</span>
              <span className="water-label">{waterConfig.label}</span>
              <span className="water-percentage">{waterQuality.percentage}%</span>
            </div>
          </div>
          <p className="water-description">{waterQuality.description}</p>
        </div>

        {/* 季节信息 */}
        <div className="season-info">
          <div className="season-current">
            <span className="season-icon">🌸</span>
            <div className="season-details">
              <span className="season-name">{season.current}</span>
              <span className="season-next">
                {season.nextSeason} 还有 {season.daysUntilChange} 天
              </span>
            </div>
          </div>
          {season.updateAvailable && (
            <div className="update-alert">
              <span className="alert-icon">🔄</span>
              <span>系统更新可用</span>
            </div>
          )}
        </div>

        {/* 环境指标 */}
        <div className="environment-metrics">
          <div className="env-metric">
            <span className="env-icon">🌡️</span>
            <div className="env-info">
              <span className="env-value" style={{ color: tempStatus.color }}>
                {temperature.current}°C
              </span>
              <span className="env-label">{tempStatus.icon} {tempStatus.label}</span>
            </div>
          </div>
          <div className="env-metric">
            <span className="env-icon">🔒</span>
            <div className="env-info">
              <span className="env-value" style={{ color: secStatus.color }}>
                {secStatus.label}
              </span>
              <span className="env-label">上次检查</span>
            </div>
          </div>
        </div>

        {/* 安全状态 */}
        <div className="security-status">
          <div 
            className="security-indicator"
            style={{ background: `${secStatus.color}20`, borderColor: secStatus.color }}
          >
            <span className="sec-icon">{secStatus.icon}</span>
            <span className="sec-text">系统安全状态: {secStatus.label}</span>
          </div>
        </div>
      </div>

      {/* 扩展内容 */}
      {isActive && (
        <div className="card-expanded">
          <h4>设施详情</h4>
          <div className="facility-details">
            <div className="detail-row">
              <span>水质指数</span>
              <span style={{ color: waterConfig.color }}>{waterQuality.percentage}/100</span>
            </div>
            <div className="detail-row">
              <span>温度范围</span>
              <span>{temperature.current}°C (适宜: 18-25°C)</span>
            </div>
            <div className="detail-row">
              <span>安全检查</span>
              <span>{new Date(security.lastCheck).toLocaleString()}</span>
            </div>
            <div className="detail-row">
              <span>季节周期</span>
              <span>{season.current} → {season.nextSeason}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
