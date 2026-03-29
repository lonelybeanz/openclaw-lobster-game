/**
 * 养殖师面板 (Human Caretaker)
 * 
 * 展示人类用户的养殖师身份：
 * - 等级、经验、技能
 * - 连续照顾天数
 * - 资源存量
 * - 最近行为记录
 */

import { useState, useEffect } from 'react';
import { 
  getCaretakerSummary, 
  getCaretakerLevelInfo,
  recordCaretakerAction,
  type CaretakerState 
} from '../../api';

interface CaretakerPanelProps {
  isActive?: boolean;
  onClick?: () => void;
}

const levelNames: Record<string, string> = {
  novice: '新手',
  apprentice: '学徒',
  junior: '初级',
  senior: '高级',
  master: '大师',
  legendary: '传奇',
};

const levelColors: Record<string, string> = {
  novice: '#6b7280',
  apprentice: '#22c55e',
  junior: '#3b82f6',
  senior: '#8b5cf6',
  master: '#f59e0b',
  legendary: '#ef4444',
};

export function CaretakerPanel({ isActive, onClick }: CaretakerPanelProps) {
  const [summary, setSummary] = useState<any>(null);
  const [levelInfo, setLevelInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [observing, setObserving] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      const [summaryData, levelData] = await Promise.all([
        getCaretakerSummary(),
        getCaretakerLevelInfo(),
      ]);
      setSummary(summaryData);
      setLevelInfo(levelData);
    } catch (e) {
      console.error('加载养殖师信息失败:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleClean() {
    setCleaning(true);
    try {
      await recordCaretakerAction('clean');
      await loadData();
    } catch (e) {
      console.error('清理失败:', e);
    } finally {
      setCleaning(false);
    }
  }

  async function handleObserve() {
    setObserving(true);
    try {
      await recordCaretakerAction('observe');
      await loadData();
    } catch (e) {
      console.error('观察失败:', e);
    } finally {
      setObserving(false);
    }
  }

  if (loading || !summary || !levelInfo) {
    return (
      <div className={`dashboard-card caretaker-card ${isActive ? 'active' : ''}`}>
        <div className="card-body">
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  const progressPercent = levelInfo.progress;
  const levelColor = levelColors[summary.level] || '#6b7280';

  return (
    <div 
      className={`dashboard-card caretaker-card ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="card-header">
        <div className="card-icon" style={{ background: `linear-gradient(135deg, ${levelColor}, ${levelColor}80)` }}>
          {summary.emoji}
        </div>
        <div className="card-title">
          <h3>养殖师</h3>
          <span className="card-subtitle">{summary.name}</span>
        </div>
        <div className="streak-badge">
          <span>🔥 {summary.streakDays}</span>
        </div>
      </div>

      <div className="card-body">
        {/* 等级信息 */}
        <div className="caretaker-level-section">
          <div className="level-display">
            <span className="level-emoji">{summary.emoji}</span>
            <div className="level-info">
              <span className="level-name" style={{ color: levelColor }}>
                {summary.level} · {levelNames[summary.level]}
              </span>
              <span className="level-number">Lv.{summary.levelNumber}</span>
            </div>
          </div>
          
          {/* 经验条 */}
          <div className="exp-section">
            <div className="exp-header">
              <span>经验值</span>
              <span>{summary.experience} / {summary.maxExperience}</span>
            </div>
            <div className="exp-bar">
              <div 
                className="exp-fill" 
                style={{ 
                  width: `${progressPercent}%`,
                  background: `linear-gradient(90deg, ${levelColor}, ${levelColor}80)`
                }} 
              />
            </div>
            <span className="exp-percent">{progressPercent}%</span>
          </div>
          
          {levelInfo.benefits && (
            <div className="level-benefits">
              {levelInfo.benefits.map((benefit: string, i: number) => (
                <span key={i} className="benefit-tag">✨ {benefit}</span>
              ))}
            </div>
          )}
        </div>

        {/* 技能 */}
        <div className="skills-section">
          <h4>养殖技能</h4>
          <div className="skills-grid">
            <div className="skill-item">
              <span className="skill-icon">🍖</span>
              <span className="skill-name">喂养</span>
              <span className="skill-value">{summary.skills.feeding}</span>
            </div>
            <div className="skill-item">
              <span className="skill-icon">💪</span>
              <span className="skill-name">训练</span>
              <span className="skill-value">{summary.skills.training}</span>
            </div>
            <div className="skill-item">
              <span className="skill-icon">🧹</span>
              <span className="skill-name">清理</span>
              <span className="skill-value">{summary.skills.cleaning}</span>
            </div>
            <div className="skill-item">
              <span className="skill-icon">👀</span>
              <span className="skill-name">观察</span>
              <span className="skill-value">{summary.skills.observing}</span>
            </div>
            <div className="skill-item">
              <span className="skill-icon">🧬</span>
              <span className="skill-name">进化</span>
              <span className="skill-value">{summary.skills.evolving}</span>
            </div>
          </div>
        </div>

        {/* 资源 */}
        <div className="resources-section">
          <h4>资源存量</h4>
          <div className="resources-grid">
            <div className="resource-item">
              <span className="resource-icon">🍖</span>
              <span className="resource-name">食物</span>
              <span className="resource-value">{summary.resources.food}</span>
            </div>
            <div className="resource-item">
              <span className="resource-icon">💊</span>
              <span className="resource-name">药品</span>
              <span className="resource-value">{summary.resources.medicine}</span>
            </div>
            <div className="resource-item">
              <span className="resource-icon">🎾</span>
              <span className="resource-name">玩具</span>
              <span className="resource-value">{summary.resources.toys}</span>
            </div>
            <div className="resource-item">
              <span className="resource-icon">🪙</span>
              <span className="resource-name">代币</span>
              <span className="resource-value">{summary.resources.tokens}</span>
            </div>
          </div>
        </div>

        {/* 快速操作 */}
        <div className="quick-actions">
          <button 
            onClick={(e) => { e.stopPropagation(); void handleClean(); }}
            disabled={cleaning}
            className="quick-btn clean"
          >
            {cleaning ? '🧹 清理中...' : '🧹 清理池塘'}
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); void handleObserve(); }}
            disabled={observing}
            className="quick-btn observe"
          >
            {observing ? '👀 观察中...' : '👀 全面观察'}
          </button>
        </div>

        {/* 统计 */}
        <div className="caretaker-stats">
          <div className="stat-item">
            <span className="stat-icon">✋</span>
            <span className="stat-label">总操作</span>
            <span className="stat-value">{summary.totalActions}</span>
          </div>
          <div className="stat-item">
            <span className="stat-icon">🔥</span>
            <span className="stat-label">连续天数</span>
            <span className="stat-value">{summary.streakDays}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CaretakerPanel;
