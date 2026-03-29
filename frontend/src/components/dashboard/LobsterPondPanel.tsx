/**
 * 龙虾池塘面板 (Lobster Pond)
 * 
 * 核心理念：
 * - 每只 Agent 对应一只小龙虾
 * - 人类用户是养殖师
 * - 展示所有小龙虾的状态，支持单独照顾
 */

import { useState, useEffect } from 'react';
import { 
  getLobsterPond, 
  getPondStats,
  feedLobster,
  trainLobster,
  restLobster,
  recordCaretakerAction,
  type LobsterAgent,
  type PondStats 
} from '../../api';

interface LobsterPondPanelProps {
  isActive?: boolean;
  onClick?: () => void;
}

// 角色名称映射
const roleNames: Record<string, string> = {
  main: '主虾',
  dev: '开发虾',
  pm: '产品虾',
  ops: '运维虾',
  research: '研究虾',
  design: '设计虾',
  test: '测试虾',
  other: '小虾',
};

// 性格名称映射
const personalityNames: Record<string, string> = {
  diligent: '勤奋',
  lazy: '懒散',
  curious: '好奇',
  cautious: '谨慎',
  adventurous: '冒险',
  social: '社交',
};

// 状态颜色
function getStatusColor(value: number): string {
  if (value >= 70) return '#22c55e';
  if (value >= 40) return '#f59e0b';
  return '#ef4444';
}

function LobsterCard({ 
  lobster, 
  onFeed, 
  onTrain, 
  onRest,
  isProcessing 
}: { 
  lobster: LobsterAgent; 
  onFeed: (id: string) => void;
  onTrain: (id: string) => void;
  onRest: (id: string) => void;
  isProcessing: boolean;
}) {
  const [showActions, setShowActions] = useState(false);
  
  // 计算需要照顾的提示
  const needsFeed = lobster.status.hunger > 60;
  const needsRest = lobster.status.energy < 30;
  const moodLow = lobster.status.mood < 40;
  
  return (
    <div 
      className={`lobster-card ${showActions ? 'active' : ''}`}
      style={{ borderColor: lobster.color }}
      onClick={() => setShowActions(!showActions)}
    >
      {/* 龙虾头像 */}
      <div className="lobster-avatar-section" style={{ background: `${lobster.color}20` }}>
        <span className="lobster-emoji">{lobster.emoji}</span>
        {needsFeed && <span className="need-badge hunger">🍖</span>}
        {needsRest && <span className="need-badge rest">😴</span>}
        {moodLow && <span className="need-badge mood">😢</span>}
      </div>
      
      {/* 基本信息 */}
      <div className="lobster-info">
        <div className="lobster-header">
          <span className="lobster-name">{lobster.name}</span>
          <span className="lobster-level">Lv.{lobster.status.level}</span>
        </div>
        
        <div className="lobster-meta">
          <span className="lobster-role" style={{ color: lobster.color }}>
            {roleNames[lobster.role]}
          </span>
          <span className="lobster-personality">
            {personalityNames[lobster.personality]}
          </span>
        </div>
        
        {/* 当前行为 */}
        <div className="lobster-action">
          <span className="action-dot" style={{ background: lobster.color }} />
          <span>{lobster.currentAction}</span>
        </div>
        
        {/* 状态条 */}
        <div className="lobster-status-bars">
          <div className="status-bar">
            <span className="bar-label">饱食</span>
            <div className="bar-track">
              <div 
                className="bar-fill" 
                style={{ 
                  width: `${100 - lobster.status.hunger}%`,
                  background: getStatusColor(100 - lobster.status.hunger)
                }} 
              />
            </div>
            <span className="bar-value">{100 - lobster.status.hunger}%</span>
          </div>
          
          <div className="status-bar">
            <span className="bar-label">心情</span>
            <div className="bar-track">
              <div 
                className="bar-fill" 
                style={{ 
                  width: `${lobster.status.mood}%`,
                  background: getStatusColor(lobster.status.mood)
                }} 
              />
            </div>
            <span className="bar-value">{lobster.status.mood}%</span>
          </div>
          
          <div className="status-bar">
            <span className="bar-label">能量</span>
            <div className="bar-track">
              <div 
                className="bar-fill" 
                style={{ 
                  width: `${lobster.status.energy}%`,
                  background: getStatusColor(lobster.status.energy)
                }} 
              />
            </div>
            <span className="bar-value">{lobster.status.energy}%</span>
          </div>
        </div>
        
        {/* 属性 */}
        <div className="lobster-stats">
          <span title="智力">🧠{lobster.stats.intelligence}</span>
          {lobster.role === 'dev' && <span title="编程">💻{lobster.stats.coding}</span>}
          {lobster.role === 'pm' && <span title="规划">📋{lobster.stats.planning}</span>}
          {lobster.role === 'ops' && <span title="稳定">🛡️{lobster.stats.stability}</span>}
          <span title="创造力">✨{lobster.stats.creativity}</span>
        </div>
      </div>
      
      {/* 操作按钮 */}
      {showActions && (
        <div className="lobster-actions" onClick={(e) => e.stopPropagation()}>
          <button 
            onClick={() => onFeed(lobster.id)} 
            disabled={isProcessing}
            className="action-btn feed"
          >
            🍖 喂食
          </button>
          <button 
            onClick={() => onTrain(lobster.id)} 
            disabled={isProcessing}
            className="action-btn train"
          >
            💪 训练
          </button>
          <button 
            onClick={() => onRest(lobster.id)} 
            disabled={isProcessing}
            className="action-btn rest"
          >
            😴 休息
          </button>
        </div>
      )}
    </div>
  );
}

export function LobsterPondPanel({ isActive, onClick }: LobsterPondPanelProps) {
  const [lobsters, setLobsters] = useState<LobsterAgent[]>([]);
  const [stats, setStats] = useState<PondStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string>('');

  async function loadData() {
    try {
      setLoading(true);
      const [pondData, statsData] = await Promise.all([
        getLobsterPond(),
        getPondStats(),
      ]);
      setLobsters(pondData);
      setStats(statsData);
    } catch (e) {
      console.error('加载龙虾池塘失败:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    const interval = setInterval(() => void loadData(), 10000);
    return () => clearInterval(interval);
  }, []);

  async function handleFeed(id: string) {
    setProcessingId(id);
    try {
      const result = await feedLobster(id);
      await recordCaretakerAction('feed', id);
      setLastAction(result.message);
      await loadData();
    } catch (e) {
      console.error('喂食失败:', e);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleTrain(id: string) {
    setProcessingId(id);
    try {
      const result = await trainLobster(id);
      await recordCaretakerAction('train', id);
      setLastAction(result.message);
      await loadData();
    } catch (e) {
      console.error('训练失败:', e);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleRest(id: string) {
    setProcessingId(id);
    try {
      const result = await restLobster(id);
      await recordCaretakerAction('rest', id);
      setLastAction(result.message);
      await loadData();
    } catch (e) {
      console.error('休息失败:', e);
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div 
      className={`dashboard-card pond-card ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="card-header">
        <div className="card-icon" style={{ background: 'linear-gradient(135deg, #06b6d4, #22d3ee)' }}>
          🏖️
        </div>
        <div className="card-title">
          <h3>龙虾池塘</h3>
          <span className="card-subtitle">Lobster Pond</span>
        </div>
        {stats && (
          <div className="pond-stats-badge">
            <span>🦞 {stats.totalLobsters}</span>
          </div>
        )}
      </div>

      <div className="card-body">
        {/* 池塘统计 */}
        {stats && (
          <div className="pond-overview">
            <div className="pond-stat">
              <span className="stat-value">{stats.averageLevel.toFixed(1)}</span>
              <span className="stat-label">平均等级</span>
            </div>
            <div className="pond-stat">
              <span className="stat-value">{(stats.totalTokens / 1000).toFixed(0)}k</span>
              <span className="stat-label">总Token</span>
            </div>
            <div className="pond-stat">
              <span className="stat-value">{stats.totalSessions}</span>
              <span className="stat-label">总会话</span>
            </div>
            <div className="pond-stat">
              <span className="stat-value">{stats.averageMood.toFixed(0)}%</span>
              <span className="stat-label">平均心情</span>
            </div>
          </div>
        )}

        {/* 需要照顾的提示 */}
        {stats && (stats.needsFeeding > 0 || stats.needsRest > 0) && (
          <div className="pond-alerts">
            {stats.needsFeeding > 0 && (
              <span className="alert-badge hunger">
                🍖 {stats.needsFeeding}只虾饿了
              </span>
            )}
            {stats.needsRest > 0 && (
              <span className="alert-badge rest">
                😴 {stats.needsRest}只虾累了
              </span>
            )}
          </div>
        )}

        {/* 上次操作反馈 */}
        {lastAction && (
          <div className="last-action">
            <span>✨ {lastAction}</span>
          </div>
        )}

        {/* 龙虾列表 */}
        <div className="lobsters-grid">
          {lobsters.map((lobster) => (
            <LobsterCard
              key={lobster.id}
              lobster={lobster}
              onFeed={handleFeed}
              onTrain={handleTrain}
              onRest={handleRest}
              isProcessing={processingId === lobster.id}
            />
          ))}
        </div>
      </div>

      {/* 扩展内容：详细统计 */}
      {isActive && stats && (
        <div className="card-expanded">
          <h4>池塘详情</h4>
          <div className="pond-details">
            <div className="detail-row">
              <span>🦞 龙虾总数</span>
              <span>{stats.totalLobsters} 只</span>
            </div>
            <div className="detail-row">
              <span>📊 平均等级</span>
              <span>Lv.{stats.averageLevel.toFixed(1)}</span>
            </div>
            <div className="detail-row">
              <span>💬 总会话数</span>
              <span>{stats.totalSessions} 次</span>
            </div>
            <div className="detail-row">
              <span>🔤 总Token消耗</span>
              <span>{(stats.totalTokens / 1000).toFixed(1)}k</span>
            </div>
            <div className="detail-row">
              <span>😊 平均心情</span>
              <span>{stats.averageMood.toFixed(0)}%</span>
            </div>
            <div className="detail-row">
              <span>🍖 需要喂食</span>
              <span>{stats.needsFeeding} 只</span>
            </div>
            <div className="detail-row">
              <span>😴 需要休息</span>
              <span>{stats.needsRest} 只</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LobsterPondPanel;
