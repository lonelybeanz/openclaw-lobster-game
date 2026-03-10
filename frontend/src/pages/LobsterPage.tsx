import { useEffect, useMemo, useState } from 'react';
import { getLobsterNews, getLobsterStats } from '../api';
import type { LobsterNewsItem, LobsterStats } from '../types';

type ActionType = 'feed' | 'train' | 'rest';

type DeltaState = {
  hunger: number;
  mood: number;
  fatigue: number;
  experience: number;
};

const initialDelta: DeltaState = {
  hunger: 0,
  mood: 0,
  fatigue: 0,
  experience: 0,
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value: number) {
  return value.toLocaleString('zh-CN');
}

export default function LobsterPage() {
  const [stats, setStats] = useState<LobsterStats | null>(null);
  const [news, setNews] = useState<LobsterNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newsLoading, setNewsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [delta, setDelta] = useState<DeltaState>(initialDelta);
  const [lastAction, setLastAction] = useState<string>('等待互动');
  const [expandedNewsId, setExpandedNewsId] = useState<string | null>(null);

  async function loadStats() {
    try {
      setLoading(true);
      setError(null);
      const data = await getLobsterStats();
      setStats(data);
      setDelta(initialDelta);
      setLastAction('状态已同步');
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function loadNews() {
    try {
      setNewsLoading(true);
      setNewsError(null);
      const data = await getLobsterNews();
      setNews(data);
      setExpandedNewsId((prev) => (prev && data.some((item) => item.id === prev) ? prev : data[0]?.id ?? null));
    } catch (e) {
      setNewsError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setNewsLoading(false);
    }
  }

  async function refreshAll() {
    await Promise.all([loadStats(), loadNews()]);
  }

  useEffect(() => {
    void refreshAll();
  }, []);

  const view = useMemo(() => {
    if (!stats) {
      return null;
    }

    return {
      ...stats,
      hunger: clamp(stats.hunger + delta.hunger),
      mood: clamp(stats.mood + delta.mood),
      fatigue: clamp(stats.fatigue + delta.fatigue),
      experience: Math.max(0, stats.experience + delta.experience),
    };
  }, [stats, delta]);

  function handleAction(action: ActionType) {
    if (!stats) {
      return;
    }

    if (action === 'feed') {
      setDelta((prev) => ({ ...prev, hunger: prev.hunger + 12, mood: prev.mood + 4 }));
      setLastAction('喂食完成：饱食度提升，心情小幅上升');
      return;
    }

    if (action === 'train') {
      setDelta((prev) => ({
        ...prev,
        experience: prev.experience + 200,
        mood: prev.mood + 2,
        fatigue: prev.fatigue + 10,
      }));
      setLastAction('训练完成：经验增长，疲劳度上升');
      return;
    }

    setDelta((prev) => ({ ...prev, fatigue: prev.fatigue - 16, mood: prev.mood + 3 }));
    setLastAction('休息完成：疲劳度下降');
  }

  const expRatio = view ? Math.min(100, (view.experience / Math.max(1, view.maxExperience)) * 100) : 0;

  return (
    <div className="page-shell lobster-page">
      <div className="bg-orb bg-orb-one" />
      <div className="bg-orb bg-orb-two" />
      <div className="bg-orb bg-orb-three" />

      <header className="header lobster-header glass-card fade-in-up">
        <div>
          <p className="eyebrow">OpenClaw Lobster</p>
          <h1>龙虾养成面板</h1>
          <p className="lobster-subtitle">根据 /lobster/stats 实时数据渲染属性与状态。</p>
        </div>
        <div className="header-right">
          <p>最近互动</p>
          <strong>{lastAction}</strong>
          <button className="refresh-btn" type="button" onClick={() => void refreshAll()} disabled={loading || newsLoading}>
            {loading || newsLoading ? '同步中...' : '刷新状态'}
          </button>
        </div>
      </header>

      {error ? <div className="panel error glass-card">数据加载失败：{error}</div> : null}
      {loading && !stats ? <div className="panel glass-card">正在加载龙虾状态...</div> : null}
      {newsError ? <div className="panel error glass-card">资讯加载失败：{newsError}</div> : null}

      {view ? (
        <>
          <section className="lobster-main-grid">
            <article className="panel lobster-avatar-card gradient-card fade-in-up delay-1">
              <div className="emoji-wrap" aria-hidden="true">
                <span className="sparkle sparkle-left">✨</span>
                <div className="lobster-avatar">🦞</div>
                <span className="sparkle sparkle-right">✨</span>
              </div>
              <p className="lobster-level">Lv.{view.level}</p>
              <h2>成长进度</h2>
              <div className="meter-track meter-track-exp">
                <div className="meter-fill meter-fill-exp" style={{ width: `${expRatio}%` }} />
              </div>
              <p className="meter-text">
                EXP {formatNumber(view.experience)} / {formatNumber(view.maxExperience)}
              </p>
              <p className="lobster-age">寿命：{view.age} 天</p>
            </article>

            <article className="panel lobster-status-card glass-card fade-in-up delay-2">
              <h3>状态属性</h3>

              <div className="status-list">
                <div className="status-item">
                  <div className="status-title-row">
                    <span>🍤 饱食度</span>
                    <strong>{view.hunger}</strong>
                  </div>
                  <div className="meter-track">
                    <div className="meter-fill meter-fill-hunger" style={{ width: `${view.hunger}%` }} />
                  </div>
                </div>

                <div className="status-item">
                  <div className="status-title-row">
                    <span>💖 心情</span>
                    <strong>{view.mood}</strong>
                  </div>
                  <div className="meter-track">
                    <div className="meter-fill meter-fill-mood" style={{ width: `${view.mood}%` }} />
                  </div>
                </div>

                <div className="status-item">
                  <div className="status-title-row">
                    <span>😴 疲劳度</span>
                    <strong>{view.fatigue}</strong>
                  </div>
                  <div className="meter-track">
                    <div className="meter-fill meter-fill-fatigue" style={{ width: `${view.fatigue}%` }} />
                  </div>
                </div>

                <div className="status-item">
                  <div className="status-title-row">
                    <span>🤝 忠诚度</span>
                    <strong>{view.loyalty}</strong>
                  </div>
                  <div className="meter-track">
                    <div className="meter-fill meter-fill-loyalty" style={{ width: `${view.loyalty}%` }} />
                  </div>
                </div>
              </div>

              <div className="action-row">
                <button type="button" onClick={() => handleAction('feed')}>
                  喂食
                </button>
                <button type="button" onClick={() => handleAction('train')}>
                  训练
                </button>
                <button type="button" onClick={() => handleAction('rest')}>
                  休息
                </button>
              </div>
              <p className="hint">互动行为为前端即时反馈，刷新后回到服务端真实数据。</p>
            </article>
          </section>

          <section className="kpi-grid lobster-kpi-grid fade-in-up delay-3">
            <article className="kpi-card gradient-card-soft">
              <p>智力</p>
              <h2>{view.intelligence}</h2>
            </article>
            <article className="kpi-card gradient-card-soft">
              <p>记忆力</p>
              <h2>{view.memory}</h2>
            </article>
            <article className="kpi-card gradient-card-soft">
              <p>技能数</p>
              <h2>{view.skills}</h2>
            </article>
            <article className="kpi-card gradient-card-soft">
              <p>经验池</p>
              <h2>{view.experiencePool}</h2>
            </article>
            <article className="kpi-card gradient-card-soft">
              <p>总 Tokens</p>
              <h2>{formatNumber(view.totalTokens)}</h2>
            </article>
            <article className="kpi-card gradient-card-soft">
              <p>总会话</p>
              <h2>{formatNumber(view.totalSessions)}</h2>
            </article>
            <article className="kpi-card gradient-card-soft">
              <p>总消息</p>
              <h2>{formatNumber(view.totalMessages)}</h2>
            </article>
            <article className="kpi-card gradient-card-soft">
              <p>最近活跃</p>
              <h2 className="time-kpi">{new Date(view.lastActive).toLocaleString('zh-CN')}</h2>
            </article>
          </section>

          <section className="panel glass-card lobster-news-panel fade-in-up delay-3">
            <div className="lobster-news-header">
              <h3>OpenClaw 资讯专栏</h3>
              <span>{newsLoading ? '同步资讯中...' : `共 ${news.length} 条`}</span>
            </div>
            {newsLoading ? <p className="lobster-news-empty">正在获取最新资讯...</p> : null}
            {!newsLoading && news.length === 0 ? <p className="lobster-news-empty">暂无资讯</p> : null}

            {!newsLoading && news.length > 0 ? (
              <div className="lobster-news-list">
                {news.map((item) => {
                  const expanded = expandedNewsId === item.id;
                  return (
                    <article key={item.id} className={`lobster-news-card ${expanded ? 'expanded' : ''}`}>
                      <button
                        type="button"
                        className="lobster-news-trigger"
                        onClick={() => setExpandedNewsId((prev) => (prev === item.id ? null : item.id))}
                      >
                        <div>
                          <h4>{item.title}</h4>
                          <p>{item.summary}</p>
                        </div>
                        <span>{expanded ? '收起' : '展开'}</span>
                      </button>
                      {expanded ? (
                        <div className="lobster-news-detail">
                          <p>{item.content}</p>
                          <div className="lobster-news-meta">
                            <span>{new Date(item.publishedAt).toLocaleString('zh-CN')}</span>
                            <span>来源：{item.source}</span>
                            {item.url ? (
                              <a href={item.url} target="_blank" rel="noreferrer">
                                查看原文
                              </a>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
