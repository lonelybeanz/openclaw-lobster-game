/**
 * 养殖师团队面板 (Staff)
 * 显示活跃 Agents 作为小虾团队成员
 */

import type { StaffTeamMetrics, StaffMember } from '../../types/dashboard';

interface StaffPanelProps {
  data: StaffTeamMetrics;
  isActive?: boolean;
  onClick?: () => void;
}

const roleLabels: Record<string, string> = {
  feeder: '喂食员',
  trainer: '训练师',
  caretaker: '护理员',
  explorer: '探险家',
};

const roleColors: Record<string, string> = {
  feeder: '#22c55e',
  trainer: '#3b82f6',
  caretaker: '#ec4899',
  explorer: '#f59e0b',
};

function StaffAvatar({ member }: { member: StaffMember }) {
  return (
    <div className={`staff-avatar ${member.activityStatus}`}>
      <div 
        className="avatar-circle"
        style={{ 
          background: `linear-gradient(135deg, ${roleColors[member.role]}20, ${roleColors[member.role]}40)`,
          borderColor: roleColors[member.role]
        }}
      >
        <span className="avatar-emoji">{member.avatar}</span>
        {member.activityStatus === 'active' && (
          <span className="status-dot active" />
        )}
      </div>
      {member.bubbleMessage && (
        <div className="speech-bubble">
          {member.bubbleMessage}
        </div>
      )}
    </div>
  );
}

export function StaffPanel({ data, isActive, onClick }: StaffPanelProps) {
  const { members, totalActive, teamMood, collaborationIndex } = data;

  return (
    <div 
      className={`dashboard-card staff-card ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="card-header">
        <div className="card-icon" style={{ background: 'linear-gradient(135deg, #ec4899, #f472b6)' }}>
          👥
        </div>
        <div className="card-title">
          <h3>养殖师团队</h3>
          <span className="card-subtitle">Staff Team</span>
        </div>
        <div className="active-count">
          <span className="count-value">{totalActive}</span>
          <span className="count-label">在线</span>
        </div>
      </div>

      <div className="card-body">
        {/* 团队成员头像 */}
        <div className="staff-avatars">
          {members.slice(0, 5).map((member) => (
            <StaffAvatar key={member.id} member={member} />
          ))}
          {members.length > 5 && (
            <div className="more-staff">
              <span>+{members.length - 5}</span>
            </div>
          )}
        </div>

        {/* 成员列表 */}
        <div className="staff-list">
          {members.slice(0, 3).map((member) => (
            <div key={member.id} className="staff-item">
              <div className="staff-info">
                <span className="staff-name">{member.name}</span>
                <span 
                  className="staff-role"
                  style={{ color: roleColors[member.role] }}
                >
                  {roleLabels[member.role]}
                </span>
              </div>
              <div className="staff-action">
                <span className="action-text">{member.currentAction}</span>
                <span className="contribution">+{member.todayContribution}</span>
              </div>
            </div>
          ))}
        </div>

        {/* 团队指标 */}
        <div className="team-metrics">
          <div className="team-metric">
            <span className="metric-icon">😊</span>
            <div className="metric-bar">
              <div className="metric-fill" style={{ width: `${teamMood}%`, background: '#fbbf24' }} />
            </div>
            <span className="metric-value">{teamMood}%</span>
          </div>
          <div className="team-metric">
            <span className="metric-icon">🤝</span>
            <div className="metric-bar">
              <div className="metric-fill" style={{ width: `${collaborationIndex}%`, background: '#22c55e' }} />
            </div>
            <span className="metric-value">{collaborationIndex}%</span>
          </div>
        </div>
      </div>

      {/* 扩展内容 */}
      {isActive && (
        <div className="card-expanded">
          <h4>所有成员</h4>
          <div className="full-staff-list">
            {members.map((member) => (
              <div key={member.id} className="full-staff-item">
                <span className="staff-avatar-small">{member.avatar}</span>
                <div className="staff-details">
                  <span className="staff-name-full">{member.name}</span>
                  <span className="staff-role-full">{roleLabels[member.role]}</span>
                </div>
                <span className={`status-badge-small ${member.activityStatus}`}>
                  {member.activityStatus === 'active' ? '活跃' : 
                   member.activityStatus === 'idle' ? '空闲' : '休息'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
