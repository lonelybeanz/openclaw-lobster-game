/**
 * 任务板面板 (Tasks)
 * 显示每日/周任务和成就
 */

import type { TaskBoardMetrics, LobsterTask } from '../../types/dashboard';

interface TaskBoardPanelProps {
  data: TaskBoardMetrics;
  isActive?: boolean;
  onClick?: () => void;
}

const typeConfig: Record<string, { icon: string; color: string; label: string }> = {
  daily: { icon: '📅', color: '#3b82f6', label: '每日' },
  weekly: { icon: '📆', color: '#8b5cf6', label: '每周' },
  achievement: { icon: '🏆', color: '#f59e0b', label: '成就' },
  event: { icon: '🎉', color: '#ec4899', label: '活动' },
};

const categoryIcons: Record<string, string> = {
  feeding: '🍖',
  training: '💪',
  maintenance: '🧹',
  exploration: '🔍',
  social: '💬',
};

const statusConfig: Record<string, { icon: string; color: string; label: string }> = {
  pending: { icon: '⏳', color: '#f59e0b', label: '待领取' },
  in_progress: { icon: '🔄', color: '#3b82f6', label: '进行中' },
  completed: { icon: '✓', color: '#22c55e', label: '已完成' },
  claimed: { icon: '✓', color: '#10b981', label: '已领取' },
};

function TaskCard({ task }: { task: LobsterTask }) {
  const type = typeConfig[task.type];
  const status = statusConfig[task.status];
  const progressPercent = (task.progress.current / task.progress.target) * 100;

  return (
    <div className={`task-card ${task.status}`}>
      <div className="task-icon" style={{ background: `${type.color}20` }}>
        {task.icon}
      </div>
      <div className="task-content">
        <div className="task-header">
          <span className="task-title">{task.title}</span>
          <span 
            className="task-type"
            style={{ background: `${type.color}30`, color: type.color }}
          >
            {type.icon} {type.label}
          </span>
        </div>
        <p className="task-description">{task.description}</p>
        
        {/* 进度条 */}
        <div className="task-progress">
          <div className="progress-bar task-bar">
            <div 
              className="progress-fill"
              style={{ width: `${progressPercent}%`, background: status.color }}
            />
          </div>
          <span className="progress-text">
            {task.progress.current}/{task.progress.target}
          </span>
        </div>

        <div className="task-footer">
          <div className="task-rewards">
            <span className="reward-exp">+{task.rewards.exp} EXP</span>
            {task.rewards.badge && (
              <span className="reward-badge">🏅 {task.rewards.badge}</span>
            )}
          </div>
          <span 
            className="task-status"
            style={{ color: status.color }}
          >
            {status.icon} {status.label}
          </span>
        </div>
      </div>
    </div>
  );
}

export function TaskBoardPanel({ data, isActive, onClick }: TaskBoardPanelProps) {
  const { tasks, stats, dailyAvailable, streakDays } = data;

  const dailyTasks = tasks.filter(t => t.type === 'daily');
  const weeklyTasks = tasks.filter(t => t.type === 'weekly');
  const achievementTasks = tasks.filter(t => t.type === 'achievement');

  return (
    <div 
      className={`dashboard-card task-card-wrapper ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="card-header">
        <div className="card-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)' }}>
          🎯
        </div>
        <div className="card-title">
          <h3>任务板</h3>
          <span className="card-subtitle">Task Board</span>
        </div>
        <div className="task-stats">
          <div className="stat-pill">
            <span className="stat-icon">🔥</span>
            <span className="stat-value">{streakDays} 天</span>
          </div>
          <div className="stat-pill">
            <span className="stat-icon">📋</span>
            <span className="stat-value">{stats.completed}/{stats.total}</span>
          </div>
        </div>
      </div>

      <div className="card-body">
        {/* 统计概览 */}
        <div className="task-overview">
          <div className="overview-item">
            <span className="overview-value">{dailyAvailable}</span>
            <span className="overview-label">今日可完成</span>
          </div>
          <div className="overview-item">
            <span className="overview-value">{stats.pending}</span>
            <span className="overview-label">待领取</span>
          </div>
          <div className="overview-item completed">
            <span className="overview-value">{stats.completed}</span>
            <span className="overview-label">已完成</span>
          </div>
        </div>

        {/* 连续天数 streak */}
        <div className="streak-display">
          <div className="streak-flame">
            {'🔥'.repeat(Math.min(streakDays, 5))}
            {streakDays > 5 && <span className="streak-more">+{streakDays - 5}</span>}
          </div>
          <span className="streak-text">
            {streakDays > 0 ? `连续 ${streakDays} 天完成日常！` : '开始你的第一个日常任务吧！'}
          </span>
        </div>

        {/* 任务分类标签 */}
        <div className="task-tabs">
          <div className="task-tab active">
            <span>每日</span>
            <span className="tab-count">{dailyTasks.filter(t => t.status !== 'completed').length}</span>
          </div>
          <div className="task-tab">
            <span>每周</span>
            <span className="tab-count">{weeklyTasks.filter(t => t.status !== 'completed').length}</span>
          </div>
          <div className="task-tab">
            <span>成就</span>
            <span className="tab-count">{achievementTasks.filter(t => t.status !== 'completed').length}</span>
          </div>
        </div>

        {/* 任务列表 */}
        <div className="tasks-list">
          {dailyTasks.slice(0, 3).map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </div>

      {/* 扩展内容 */}
      {isActive && (
        <div className="card-expanded">
          <h4>所有任务</h4>
          <div className="all-tasks">
            {tasks.map((task) => {
              const type = typeConfig[task.type];
              const status = statusConfig[task.status];
              return (
                <div key={task.id} className={`task-list-item ${task.status}`}>
                  <span className="task-list-icon" style={{ background: `${type.color}20` }}>
                    {task.icon}
                  </span>
                  <div className="task-list-info">
                    <span className="task-list-title">{task.title}</span>
                    <span className="task-list-category">
                      {categoryIcons[task.category]} {task.category}
                    </span>
                  </div>
                  <div className="task-list-progress">
                    <span>{task.progress.current}/{task.progress.target}</span>
                  </div>
                  <span 
                    className="task-list-status"
                    style={{ color: status.color }}
                  >
                    {status.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
