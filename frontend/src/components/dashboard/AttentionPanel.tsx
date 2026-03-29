/**
 * 关注列表面板 (Attention Panel)
 * 
 * 显示需要照顾的虾：
 * - 饥饿的虾
 * - 疲劳的虾  
 * - 心情低落的虾
 * - 即将进化的虾
 */

import { useState, useEffect } from 'react';
import { getLobsterPond, feedLobster, restLobster, type LobsterAgent } from '../../api';

interface AttentionPanelProps {
  isActive?: boolean;
  onClick?: () => void;
}

export function AttentionPanel({ isActive, onClick }: AttentionPanelProps) {
  const [lobsters, setLobsters] = useState<LobsterAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  async function loadData() {
    try {
      setLoading(true);
      const data = await getLobsterPond();
      setLobsters(data);
    } catch (e) {
      console.error('加载失败:', e);
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
    setProcessing(id + '-feed');
    try {
      await feedLobster(id);
      await loadData();
    } finally {
      setProcessing(null);
    }
  }

  async function handleRest(id: string) {
    setProcessing(id + '-rest');
    try {
      await restLobster(id);
      await loadData();
    } finally {
      setProcessing(null);
    }
  }

  // 筛选需要关注的虾
  const hungryLobsters = lobsters.filter(l => l.status.hunger > 60);
  const tiredLobsters = lobsters.filter(l => l.status.energy < 30);
  const sadLobsters = lobsters.filter(l => l.status.mood < 40);
  const readyToEvolve = lobsters.filter(l => l.status.growth > 80 && l.status.level < 20);

  const allAttention = [...hungryLobsters, ...tiredLobsters, ...sadLobsters]
    .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i); // 去重

  return (
    <div 
      className={`dashboard-card attention-card ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="card-header">
        <div className="card-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)' }}>
          🔔
        </div>
        <div className="card-title">
          <h3>关注列表</h3>
          <span className="card-subtitle">需要照顾的虾</span>
        </div>
        {allAttention.length > 0 && (
          <div className="attention-badge">
            <span>{allAttention.length}</span>
          </div>
        )}
      </div>

      <div className="card-body">
        {loading ? (
          <div className="loading-text">加载中...</div>
        ) : allAttention.length === 0 ? (
          <div className="all-good">
            <span className="good-icon">✨</span>
            <p>所有虾状态良好！</p>
          </div>
        ) : (
          <div className="attention-list">
            {allAttention.slice(0, 5).map((lobster) => (
              <div key={lobster.id} className="attention-item">
                <div className="attention-avatar" style={{ background: `${lobster.color}20` }}>
                  <span>{lobster.emoji}</span>
                </div>
                <div className="attention-info">
                  <span className="attention-name">{lobster.name}</span>
                  <div className="attention-needs">
                    {lobster.status.hunger > 60 && <span className="need hunger">🍖 饿了</span>}
                    {lobster.status.energy < 30 && <span className="need rest">😴 累了</span>}
                    {lobster.status.mood < 40 && <span className="need mood">😢 不开心</span>}
                  </div>
                </div>
                <div className="attention-actions">
                  {lobster.status.hunger > 60 && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); void handleFeed(lobster.id); }}
                      disabled={processing === lobster.id + '-feed'}
                      className="action-mini feed"
                    >
                      {processing === lobster.id + '-feed' ? '...' : '🍖'}
                    </button>
                  )}
                  {lobster.status.energy < 30 && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); void handleRest(lobster.id); }}
                      disabled={processing === lobster.id + '-rest'}
                      className="action-mini rest"
                    >
                      {processing === lobster.id + '-rest' ? '...' : '😴'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 即将进化的虾 */}
        {readyToEvolve.length > 0 && (
          <div className="evolve-section">
            <h4>🌟 即将进化</h4>
            <div className="evolve-list">
              {readyToEvolve.map(lobster => (
                <div key={lobster.id} className="evolve-item">
                  <span>{lobster.emoji}</span>
                  <span>{lobster.name}</span>
                  <span className="growth-bar">
                    <span className="growth-fill" style={{ width: `${lobster.status.growth}%` }} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AttentionPanel;
