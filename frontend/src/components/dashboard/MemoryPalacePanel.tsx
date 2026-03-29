/**
 * 记忆宫殿面板 (Memory) - 增强版
 * 
 * 功能：
 * - 记忆碎片收集展示
 * - 学习点数系统（读取/写入/探索获得经验）
 * - 记忆探索任务（搜索/grep）
 * - 连续学习天数 streak
 */

import { useEffect, useState } from 'react';
import { 
  getLearningState, 
  simulateMemoryRead, 
  simulateMemoryExplore,
  getLearningMilestones,
  type LearningState,
  type LearningRecord 
} from '../../api';
import type { MemoryPalaceMetrics, MemoryFragment } from '../../types/dashboard';

interface MemoryPalacePanelProps {
  data?: MemoryPalaceMetrics;
  isActive?: boolean;
  onClick?: () => void;
}

const qualityConfig = {
  common: { color: '#9ca3af', label: '普通', glow: 'none' },
  rare: { color: '#3b82f6', label: '稀有', glow: '0 0 10px rgba(59, 130, 246, 0.4)' },
  epic: { color: '#a855f7', label: '史诗', glow: '0 0 15px rgba(168, 85, 247, 0.5)' },
  legendary: { color: '#f59e0b', label: '传说', glow: '0 0 20px rgba(245, 158, 11, 0.6)' },
};

const categoryIcons: Record<string, string> = {
  player: '👤',
  level: '📊',
  conversation: '💬',
  achievement: '🏆',
};

function FragmentCard({ fragment, onClick }: { fragment: MemoryFragment; onClick?: () => void }) {
  const quality = qualityConfig[fragment.quality];
  
  return (
    <div 
      className={`fragment-card ${fragment.quality}`}
      onClick={onClick}
      style={{ 
        borderColor: quality.color,
        boxShadow: quality.glow,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div className="fragment-icon" style={{ background: `${quality.color}20` }}>
        {fragment.icon}
      </div>
      <div className="fragment-info">
        <span className="fragment-title">{fragment.title}</span>
        <span className="fragment-category">
          {categoryIcons[fragment.category]} {fragment.category}
        </span>
      </div>
      <div className="fragment-meta">
        <span className="quality-badge" style={{ background: quality.color }}>
          {quality.label}
        </span>
        {fragment.searchable && <span className="searchable-badge">🔍</span>}
      </div>
    </div>
  );
}

export function MemoryPalacePanel({ data, isActive, onClick }: MemoryPalacePanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [learningState, setLearningState] = useState<LearningState | null>(null);
  const [milestones, setMilestones] = useState<string[]>([]);
  const [exploring, setExploring] = useState(false);
  const [lastRecord, setLastRecord] = useState<LearningRecord | null>(null);
  const [loading, setLoading] = useState(true);

  // 加载学习状态
  async function loadLearningState() {
    try {
      const state = await getLearningState();
      setLearningState(state);
      const ms = await getLearningMilestones();
      setMilestones(ms);
    } catch (e) {
      console.error('加载学习状态失败:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLearningState();
    // 每 10 秒刷新一次学习状态
    const interval = setInterval(() => void loadLearningState(), 10000);
    return () => clearInterval(interval);
  }, []);

  // 探索记忆
  async function handleExplore() {
    if (!searchQuery.trim()) return;
    
    setExploring(true);
    try {
      const record = await simulateMemoryExplore(searchQuery);
      setLastRecord(record);
      await loadLearningState(); // 刷新状态
      setSearchQuery('');
    } catch (e) {
      console.error('探索失败:', e);
    } finally {
      setExploring(false);
    }
  }

  // 读取记忆获得学习点
  async function handleFragmentClick(fragment: MemoryFragment) {
    try {
      const record = await simulateMemoryRead(fragment.title);
      setLastRecord(record);
      await loadLearningState();
    } catch (e) {
      console.error('记录读取失败:', e);
    }
  }

  // 使用传入的数据或空数据
  const fragments = data?.fragments || [];
  const recentFragments = fragments.slice(0, 4);

  return (
    <div 
      className={`dashboard-card memory-card ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="card-header">
        <div className="card-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)' }}>
          🧠
        </div>
        <div className="card-title">
          <h3>记忆宫殿</h3>
          <span className="card-subtitle">Memory Palace</span>
        </div>
        <div className="collection-badge">
          <span className="collection-icon">📚</span>
          <span className="collection-count">{fragments.length}</span>
        </div>
      </div>

      <div className="card-body">
        {/* 学习点数状态 */}
        {learningState && (
          <div className="learning-status">
            <div className="learning-stats">
              <div className="learning-stat">
                <span className="stat-icon">⭐</span>
                <div className="stat-info">
                  <span className="stat-value">{learningState.todayPoints}</span>
                  <span className="stat-label">今日学习点</span>
                </div>
              </div>
              <div className="learning-stat">
                <span className="stat-icon">🔥</span>
                <div className="stat-info">
                  <span className="stat-value">{learningState.streakDays}</span>
                  <span className="stat-label">连续天数</span>
                </div>
              </div>
              <div className="learning-stat">
                <span className="stat-icon">🧠</span>
                <div className="stat-info">
                  <span className="stat-value">{learningState.totalPoints}</span>
                  <span className="stat-label">总学习点</span>
                </div>
              </div>
            </div>
            
            {/* 里程碑徽章 */}
            {milestones.length > 0 && (
              <div className="milestones-row">
                {milestones.slice(0, 3).map((m, i) => (
                  <span key={i} className="milestone-badge">{m}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 记忆探索 */}
        <div className="memory-explore" onClick={(e) => e.stopPropagation()}>
          <div className="explore-input-group">
            <input
              type="text"
              placeholder="搜索记忆探索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleExplore()}
              className="explore-input"
            />
            <button 
              onClick={() => void handleExplore()}
              disabled={exploring || !searchQuery.trim()}
              className="explore-btn"
            >
              {exploring ? '🔍 探索中...' : '🔍 探索'}
            </button>
          </div>
          <span className="explore-hint">探索记忆可获得 5 学习点 + 25 经验</span>
        </div>

        {/* 最近学习记录 */}
        {lastRecord && (
          <div className="last-record">
            <span className="record-icon">✨</span>
            <span className="record-text">
              {lastRecord.reason} +{lastRecord.points}点 (+{lastRecord.exp} EXP)
            </span>
          </div>
        )}

        {/* 记忆碎片 */}
        <div className="fragments-section">
          <h4>记忆碎片（点击读取）</h4>
          <div className="fragments-grid">
            {recentFragments.map((fragment) => (
              <FragmentCard 
                key={fragment.id} 
                fragment={fragment} 
                onClick={() => void handleFragmentClick(fragment)}
              />
            ))}
          </div>
        </div>

        {/* 学习统计 */}
        {learningState && (
          <div className="learning-stats-detail">
            <div className="stat-row">
              <span>📖 记忆读取</span>
              <span>{learningState.stats.memoryReads} 次</span>
            </div>
            <div className="stat-row">
              <span>✍️ 记忆写入</span>
              <span>{learningState.stats.memoryWrites} 次</span>
            </div>
            <div className="stat-row">
              <span>🔍 记忆探索</span>
              <span>{learningState.stats.memoryExplores} 次</span>
            </div>
          </div>
        )}
      </div>

      {/* 扩展内容：完整学习记录 */}
      {isActive && learningState && (
        <div className="card-expanded">
          <h4>最近学习记录</h4>
          <div className="learning-records">
            {learningState.records.slice(0, 10).map((record) => (
              <div key={record.id} className="learning-record-item">
                <span className="record-action">
                  {record.action === 'memory_read' && '📖'}
                  {record.action === 'memory_write' && '✍️'}
                  {record.action === 'memory_explore' && '🔍'}
                  {record.action === 'skill_learn' && '🎯'}
                  {record.action === 'task_complete' && '✅'}
                </span>
                <span className="record-reason">{record.reason}</span>
                <span className="record-points">+{record.points}点</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default MemoryPalacePanel;
