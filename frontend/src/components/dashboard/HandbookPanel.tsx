/**
 * 养殖手册面板 (Documents → Handbook)
 * 显示帮助文档阅读进度
 */

import type { HandbookMetrics, HandbookSection } from '../../types/dashboard';

interface HandbookPanelProps {
  data: HandbookMetrics;
  isActive?: boolean;
  onClick?: () => void;
}

const categoryConfig: Record<string, { icon: string; color: string; label: string }> = {
  guide: { icon: '📖', color: '#22c55e', label: '指南' },
  rule: { icon: '📋', color: '#f59e0b', label: '规则' },
  tutorial: { icon: '🎓', color: '#3b82f6', label: '教程' },
  reference: { icon: '📚', color: '#8b5cf6', label: '参考' },
};

function SectionCard({ section }: { section: HandbookSection }) {
  const config = categoryConfig[section.category];
  
  return (
    <div className={`handbook-section ${section.read ? 'read' : ''}`}>
      <div className="section-icon" style={{ background: `${config.color}20` }}>
        {config.icon}
      </div>
      <div className="section-content">
        <div className="section-header">
          <span className="section-title">{section.title}</span>
          <span 
            className="section-category"
            style={{ background: `${config.color}30`, color: config.color }}
          >
            {config.label}
          </span>
        </div>
        <p className="section-preview">{section.preview}</p>
        <div className="section-footer">
          <div className="read-progress">
            <div 
              className="progress-fill"
              style={{ width: `${section.readProgress}%`, background: config.color }}
            />
          </div>
          <span className="read-status">
            {section.read ? '✓ 已读' : `${section.readProgress}%`}
          </span>
        </div>
      </div>
    </div>
  );
}

export function HandbookPanel({ data, isActive, onClick }: HandbookPanelProps) {
  const { sections, totalSections, readCount, overallProgress, recommended } = data;

  const recommendedSections = sections.filter(s => recommended.includes(s.id));
  const unreadSections = sections.filter(s => !s.read).slice(0, 3);

  return (
    <div 
      className={`dashboard-card handbook-card ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="card-header">
        <div className="card-icon" style={{ background: 'linear-gradient(135deg, #10b981, #34d399)' }}>
          📚
        </div>
        <div className="card-title">
          <h3>养殖手册</h3>
          <span className="card-subtitle">Handbook</span>
        </div>
        <div className="read-badge">
          <span className="read-count">{readCount}/{totalSections}</span>
        </div>
      </div>

      <div className="card-body">
        {/* 总体阅读进度 */}
        <div className="overall-progress">
          <div className="progress-circle">
            <svg viewBox="0 0 100 100">
              <circle
                className="progress-bg"
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#374151"
                strokeWidth="8"
              />
              <circle
                className="progress-fill"
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="url(#handbookGradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${overallProgress * 2.83} 283`}
                transform="rotate(-90 50 50)"
              />
              <defs>
                <linearGradient id="handbookGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#34d399" />
                </linearGradient>
              </defs>
            </svg>
            <div className="progress-text">
              <span className="progress-value">{overallProgress}%</span>
              <span className="progress-label">已读</span>
            </div>
          </div>
        </div>

        {/* 推荐阅读 */}
        {recommendedSections.length > 0 && (
          <div className="recommended-sections">
            <h4>推荐阅读</h4>
            {recommendedSections.map((section) => (
              <div key={section.id} className="recommended-item">
                <span className="rec-icon">⭐</span>
                <span className="rec-title">{section.title}</span>
                <span className="rec-category">{categoryConfig[section.category]?.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* 文档列表 */}
        <div className="sections-list">
          {unreadSections.map((section) => (
            <SectionCard key={section.id} section={section} />
          ))}
        </div>
      </div>

      {/* 扩展内容 */}
      {isActive && (
        <div className="card-expanded">
          <h4>全部文档</h4>
          <div className="all-sections">
            {sections.map((section) => {
              const config = categoryConfig[section.category];
              return (
                <div key={section.id} className={`section-full ${section.read ? 'read' : ''}`}>
                  <span className="section-full-icon" style={{ background: `${config.color}20` }}>
                    {config.icon}
                  </span>
                  <div className="section-full-info">
                    <span className="section-full-title">{section.title}</span>
                    <span className="section-full-date">
                      更新: {new Date(section.lastUpdated).toLocaleDateString()}
                    </span>
                  </div>
                  <span 
                    className="section-full-status"
                    style={{ color: section.read ? '#22c55e' : '#9ca3af' }}
                  >
                    {section.read ? '✓ 已读' : `${section.readProgress}%`}
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
