import { useEffect, useMemo, useState } from 'react';
import { getAchievements, getLobsterNews, getLobsterStats, interact } from '../api';
import type { LobsterNewsItem, LobsterStats, RandomEvent } from '../types';

type ActionType = 'feed' | 'train' | 'rest';

type DeltaState = {
  hunger: number;
  mood: number;
  fatigue: number;
  experience: number;
};

type AchievementItem = {
  id: string;
  name: string;
  unlocked: boolean;
  icon?: string;
  description?: string;
  unlockedAt?: string;
  unlockTime?: string;
  unlocked_at?: string;
  achievedAt?: string;
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

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '--';
  }
  return String(value);
}

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeAchievement(raw: unknown, index: number): AchievementItem {
  const item = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    id: String(item.id ?? `achievement-${index}`),
    name: String(item.name ?? '未命名成就'),
    unlocked: Boolean(item.unlocked),
    icon: typeof item.icon === 'string' ? item.icon : undefined,
    description: typeof item.description === 'string' ? item.description : undefined,
    unlockedAt: typeof item.unlockedAt === 'string' ? item.unlockedAt : undefined,
    unlockTime: typeof item.unlockTime === 'string' ? item.unlockTime : undefined,
    unlocked_at: typeof item.unlocked_at === 'string' ? item.unlocked_at : undefined,
    achievedAt: typeof item.achievedAt === 'string' ? item.achievedAt : undefined,
  };
}

function formatUnlockTime(item: AchievementItem) {
  const raw = item.unlockedAt ?? item.unlockTime ?? item.unlocked_at ?? item.achievedAt;
  if (!raw) {
    return '--';
  }
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) {
    return raw;
  }
  return dt.toLocaleString('zh-CN');
}

function formatEventEffect(event: RandomEvent | null) {
  if (!event?.effect) {
    return '';
  }
  const fields: Array<{ key: keyof NonNullable<RandomEvent['effect']>; label: string }> = [
    { key: 'experience', label: '经验' },
    { key: 'mood', label: '心情' },
    { key: 'hunger', label: '饱食度' },
    { key: 'fatigue', label: '疲劳' },
    { key: 'loyalty', label: '忠诚' },
  ];
  const effects = fields
    .map(({ key, label }) => {
      const val = event.effect?.[key];
      if (typeof val !== 'number' || !Number.isFinite(val) || val === 0) {
        return null;
      }
      return `${label}${val > 0 ? '+' : ''}${val}`;
    })
    .filter(Boolean);
  return effects.join('，');
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
  const [activeTab, setActiveTab] = useState<'status' | 'evolution' | 'memory' | 'news'>('status');
  const [showFormulaGuide, setShowFormulaGuide] = useState(false);
  const [activeFormula, setActiveFormula] = useState<string | null>(null);
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [achievementsLoading, setAchievementsLoading] = useState(false);
  const [achievementsError, setAchievementsError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [randomEventPrompt, setRandomEventPrompt] = useState<RandomEvent | null>(null);

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

  async function openAchievementModal() {
    setShowAchievementModal(true);
    setAchievementsLoading(true);
    setAchievementsError(null);
    try {
      const data = await getAchievements();
      const normalized = (Array.isArray(data) ? data : []).map((item, index) => normalizeAchievement(item, index));
      setAchievements(normalized.filter((item) => item.unlocked));
    } catch (e) {
      setAchievementsError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setAchievementsLoading(false);
    }
  }

  useEffect(() => {
    void refreshAll();
  }, []);

  useEffect(() => {
    document.querySelectorAll<HTMLElement>('.tab-content').forEach((section) => {
      const tab = section.dataset.tab;
      section.style.display = tab === activeTab ? 'block' : 'none';
    });
  }, [activeTab]);

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

  async function handleAction(action: ActionType) {
    if (!stats) {
      return;
    }
    try {
      setActionLoading(true);
      const result = await interact(action);
      const { message, expGained, randomEvent: rawRandomEvent, ...statePatch } = (result || {}) as Record<string, unknown>;
      setStats((prev) => (prev ? ({ ...prev, ...statePatch } as LobsterStats) : prev));
      setDelta(initialDelta);
      const randomEvent =
        typeof rawRandomEvent === 'object' && rawRandomEvent
          ? (rawRandomEvent as RandomEvent)
          : null;
      setRandomEventPrompt(randomEvent);
      const gained = typeof expGained === 'number' && expGained > 0 ? `（+${expGained} EXP）` : '';
      const eventText = randomEvent ? ` | 随机事件：${randomEvent.title}` : '';
      setLastAction(`${typeof message === 'string' ? message : '互动完成'}${gained}${eventText}`);
    } catch (e) {
      setLastAction(`互动失败：${e instanceof Error ? e.message : '未知错误'}`);
    } finally {
      setActionLoading(false);
    }
  }

  const expRatio = view ? Math.min(100, (view.experience / Math.max(1, view.maxExperience)) * 100) : 0;
  const cerebral = toNumber(view?.brain?.cerebral);
  const opticLobes = toNumber(view?.brain?.opticLobes);
  const antennaLobe = toNumber(view?.brain?.antennaLobe);
  const neurons = toNumber(view?.brain?.neurons);
  const shortTerm = toNumber(view?.brain?.shortTerm);
  const longTerm = toNumber(view?.brain?.longTerm);
  const episodic = toNumber(view?.brain?.episodic);
  const procedural = toNumber(view?.brain?.procedural);
  const amygdala = toNumber(view?.brain?.amygdala);
  const cerebellum = toNumber(view?.brain?.cerebellum);
  const brainstem = toNumber(view?.brain?.brainstem);
  const claws = toNumber(view?.limbs?.claws);
  const legs = toNumber(view?.limbs?.legs);
  const antennae = toNumber(view?.limbs?.antennae);
  const tail = toNumber(view?.limbs?.tail);
  const strength = toNumber(view?.limbs?.strength);
  const agility = toNumber(view?.limbs?.agility);
  const endurance = toNumber(view?.limbs?.endurance);
  const memoryQuality = toNumber(view?.memory?.shallow?.quality);
  const levelScore = toNumber(view?.level);
  const moodScore = toNumber(view?.mood);
  const benchmark = view?.brainMapping?.benchmark;
  const benchmarkIntelligence = benchmark?.intelligence ?? 50;
  const benchmarkReasoning = benchmark?.reasoningScore ?? 50;
  const benchmarkContext = benchmark?.contextScore ?? 50;
  const benchmarkSpeed = benchmark?.speedScore ?? 50;
  const benchmarkLatency = benchmark?.latencyScore ?? 50;
  const benchmarkCost = benchmark?.costScore ?? 50;

  const reasoningScore = cerebral * 0.28 + opticLobes * 0.14 + antennaLobe * 0.14 + neurons * 0.14 + benchmarkReasoning * 0.3;
  const intelligenceScore = cerebral * 0.22 + neurons * 0.18 + reasoningScore * 0.25 + benchmarkIntelligence * 0.35;
  const perceptionScore = opticLobes * 0.25 + antennaLobe * 0.25 + antennae * 0.15 + brainstem * 0.1 + benchmarkContext * 0.25;
  const memoryScore = shortTerm * 0.18 + longTerm * 0.25 + episodic * 0.15 + procedural * 0.17 + memoryQuality * 0.1 + benchmarkContext * 0.15;
  const reactionScore = cerebellum * 0.2 + brainstem * 0.15 + agility * 0.15 + amygdala * 0.1 + benchmarkSpeed * 0.25 + benchmarkLatency * 0.15;
  const growthScore = expRatio * 0.2 + levelScore * 4 * 0.2 + endurance * 0.15 + neurons * 0.05 + moodScore * 0.05 + benchmarkCost * 0.35;
  const evolutionScore =
    intelligenceScore * 0.25 + perceptionScore * 0.2 + memoryScore * 0.2 + reactionScore * 0.2 + growthScore * 0.15;

  const majorMetrics = [
    { key: 'intelligence', label: '智力', value: intelligenceScore, formula: '智力 = 脑神经/神经元/推理得分 + Benchmark intelligence_index' },
    { key: 'perception', label: '感知', value: perceptionScore, formula: '感知 = 视叶/触角叶/触角 + Benchmark context score' },
    { key: 'memory', label: '记忆力', value: memoryScore, formula: '记忆力 = 短期/长期/情景/程序记忆 + Benchmark context score' },
    { key: 'reaction', label: '反应', value: reactionScore, formula: '反应 = 小脑/脑干/敏捷 + Benchmark speed/latency score' },
    { key: 'growth', label: '成长值', value: growthScore, formula: '成长值 = 经验/等级/耐力 + Benchmark cost score' },
  ] as const;

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
      <div style={{display:"flex", gap:"8px", marginBottom:"15px", padding:"0 20px"}}>
        <button style={{flex:1, padding:"10px", border:"none", borderRadius:"8px", background:activeTab==="status"?"linear-gradient(135deg, #667eea, #764ba2)":"rgba(255,255,255,0.1)", color:"white", cursor:"pointer"}} onClick={()=>setActiveTab("status")}>📊状态</button>
        <div style={{display:"flex", flex:1, gap:"6px", alignItems:"center"}}>
          <button style={{flex:1, padding:"10px", border:"none", borderRadius:"8px", background:activeTab==="evolution"?"linear-gradient(135deg, #667eea, #764ba2)":"rgba(255,255,255,0.1)", color:"white", cursor:"pointer"}} onClick={()=>setActiveTab("evolution")}>🧬进化</button>
          <button
            type="button"
            aria-label="查看进化计算公式"
            style={{padding:"10px 12px", border:"1px solid rgba(255,255,255,0.2)", borderRadius:"8px", background:showFormulaGuide?"rgba(102,126,234,0.5)":"rgba(255,255,255,0.1)", color:"white", cursor:"pointer"}}
            onClick={() => setShowFormulaGuide((prev) => !prev)}
          >
            ？
          </button>
        </div>
        <button style={{flex:1, padding:"10px", border:"none", borderRadius:"8px", background:activeTab==="memory"?"linear-gradient(135deg, #667eea, #764ba2)":"rgba(255,255,255,0.1)", color:"white", cursor:"pointer"}} onClick={()=>setActiveTab("memory")}>💾记忆</button>
        <button style={{flex:1, padding:"10px", border:"none", borderRadius:"8px", background:activeTab==="news"?"linear-gradient(135deg, #667eea, #764ba2)":"rgba(255,255,255,0.1)", color:"white", cursor:"pointer"}} onClick={()=>setActiveTab("news")}>📰资讯</button>
      </div>
      {showFormulaGuide ? (
        <section
          className="panel glass-card"
          style={{ margin: '0 20px 15px', padding: '12px 14px', border: '1px dashed rgba(255,255,255,0.3)' }}
        >
          <h4 style={{ margin: '0 0 8px 0' }}>进化计算公式说明</h4>
          <p style={{ margin: '0 0 6px 0' }}>综合进化得分 = 智力×0.25 + 感知×0.2 + 记忆力×0.2 + 反应×0.2 + 成长值×0.15</p>
          <p style={{ margin: 0, opacity: 0.85 }}>提示：点击下方每个主要属性右侧的小气泡可查看该属性的详细公式。</p>
        </section>
      ) : null}
      {error ? <div className="panel error glass-card">数据加载失败：{error}</div> : null}
      {loading && !stats ? <div className="panel glass-card">正在加载龙虾状态...</div> : null}
      {newsError ? <div className="panel error glass-card">资讯加载失败：{newsError}</div> : null}

      {view ? (
        <>
          <section className="lobster-main-grid tab-content" data-tab="status">
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
                <button type="button" onClick={() => void handleAction('feed')} disabled={actionLoading}>
                  喂食
                </button>
                <button type="button" onClick={() => void handleAction('train')} disabled={actionLoading}>
                  训练
                </button>
                <button type="button" onClick={() => void handleAction('rest')} disabled={actionLoading}>
                  休息
                </button>
              </div>
              <button
                type="button"
                onClick={() => void openAchievementModal()}
                style={{
                  width: '100%',
                  marginTop: '10px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.22)',
                  background: 'linear-gradient(135deg, rgba(255,215,0,0.35), rgba(255,166,0,0.3))',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                🏆 成就
              </button>
              {randomEventPrompt ? (
                <div className="random-event-tip">
                  <p className="random-event-title">🎲 {randomEventPrompt.title}</p>
                  <p>{randomEventPrompt.description}</p>
                  {formatEventEffect(randomEventPrompt) ? <p className="random-event-effect">{formatEventEffect(randomEventPrompt)}</p> : null}
                </div>
              ) : null}
              <p className="hint">互动行为已写入服务端持久化状态。</p>
            </article>
          </section>

          <section className="fade-in-up delay-3 tab-content" data-tab="evolution">
            <h3 style={{ margin: '0 0 12px 0' }}>🧬 进化程度</h3>
            <div
              className="kpi-grid lobster-kpi-grid"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' }}
            >
              <article className="kpi-card gradient-card-soft" style={{ gridColumn: '1 / -1' }}>
                <p>进化得分（综合计算）</p>
                <h2>{evolutionScore.toFixed(1)}</h2>
              </article>
              {majorMetrics.map((metric) => (
                <article key={metric.key} className="kpi-card gradient-card-soft">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <p style={{ margin: 0 }}>{metric.label}</p>
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        aria-label={`查看${metric.label}计算公式`}
                        style={{
                          minWidth: '40px',
                          height: '24px',
                          borderRadius: '999px',
                          border: '1px solid rgba(255,255,255,0.25)',
                          background: activeFormula === metric.key ? 'rgba(102,126,234,0.55)' : 'rgba(255,255,255,0.12)',
                          color: 'white',
                          cursor: 'pointer',
                          fontSize: '12px',
                          lineHeight: 1,
                          padding: '0 8px',
                        }}
                        onClick={() => setActiveFormula((prev) => (prev === metric.key ? null : metric.key))}
                      >
                        【？】
                      </button>
                      {activeFormula === metric.key ? (
                        <div
                          style={{
                            position: 'absolute',
                            top: '30px',
                            right: 0,
                            zIndex: 10,
                            minWidth: '220px',
                            maxWidth: '300px',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.2)',
                            background: 'rgba(10,12,22,0.94)',
                            color: 'white',
                            fontSize: '12px',
                            lineHeight: 1.45,
                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.28)',
                          }}
                        >
                          {metric.formula}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <h2>{metric.value.toFixed(1)}</h2>
                </article>
              ))}
            </div>
            <h4 style={{ margin: '0 0 12px 0' }}>Benchmark 评测整合</h4>
            <div
              className="kpi-grid lobster-kpi-grid"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' }}
            >
              <article className="kpi-card gradient-card-soft">
                <p>Intelligence</p>
                <h2>{benchmarkIntelligence.toFixed(1)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>Reasoning</p>
                <h2>{benchmarkReasoning.toFixed(1)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>Context</p>
                <h2>{benchmarkContext.toFixed(1)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>Speed</p>
                <h2>{benchmarkSpeed.toFixed(1)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>Latency</p>
                <h2>{benchmarkLatency.toFixed(1)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>Cost</p>
                <h2>{benchmarkCost.toFixed(1)}</h2>
              </article>
            </div>
            <h4 style={{ margin: '0 0 12px 0' }}>大脑属性</h4>
            <div
              className="kpi-grid lobster-kpi-grid"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' }}
            >
              <article className="kpi-card gradient-card-soft">
                <p>脑神经</p>
                <h2>{displayValue(view.brain?.cerebral)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>视叶</p>
                <h2>{displayValue(view.brain?.opticLobes)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>触角叶</p>
                <h2>{displayValue(view.brain?.antennaLobe)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>神经元</p>
                <h2>{displayValue(view.brain?.neurons)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>短期记忆</p>
                <h2>{displayValue(view.brain?.shortTerm)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>长期记忆</p>
                <h2>{displayValue(view.brain?.longTerm)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>情景记忆</p>
                <h2>{displayValue(view.brain?.episodic)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>程序记忆</p>
                <h2>{displayValue(view.brain?.procedural)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>杏仁核</p>
                <h2>{displayValue(view.brain?.amygdala)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>小脑</p>
                <h2>{displayValue(view.brain?.cerebellum)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>脑干</p>
                <h2>{displayValue(view.brain?.brainstem)}</h2>
              </article>
            </div>
            <h4 style={{ margin: '0 0 12px 0' }}>躯干属性</h4>
            <div
              className="kpi-grid lobster-kpi-grid"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}
            >
              <article className="kpi-card gradient-card-soft">
                <p>螯</p>
                <h2>{displayValue(view.limbs?.claws)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>步足</p>
                <h2>{displayValue(view.limbs?.legs)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>触角</p>
                <h2>{displayValue(view.limbs?.antennae)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>尾巴</p>
                <h2>{displayValue(view.limbs?.tail)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>力量</p>
                <h2>{displayValue(view.limbs?.strength)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>敏捷</p>
                <h2>{displayValue(view.limbs?.agility)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>耐力</p>
                <h2>{displayValue(view.limbs?.endurance)}</h2>
              </article>
            </div>
          </section>

          <section className="fade-in-up delay-3 tab-content" data-tab="memory">
            <h3 style={{ margin: '0 0 12px 0' }}>💾 记忆系统</h3>
            <div
              className="kpi-grid lobster-kpi-grid"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}
            >
              <article className="kpi-card gradient-card-soft">
                <p>浅层记忆数</p>
                <h2>{displayValue(view.memory?.shallow?.count)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>记忆质量</p>
                <h2>{displayValue(view.memory?.shallow?.quality)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>组织度</p>
                <h2>{displayValue(view.memory?.organization)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>完整度</p>
                <h2>{displayValue(view.memory?.completeness)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft" style={{ gridColumn: '1 / -1' }}>
                <p>近期记忆文件</p>
                {view.memory?.shallow?.recent && view.memory.shallow.recent.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                    {view.memory.shallow.recent.map((item) => (
                      <div
                        key={item}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: 'rgba(255,255,255,0.08)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          wordBreak: 'break-all',
                        }}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                ) : (
                  <h2>--</h2>
                )}
              </article>
            </div>
          </section>

          <section className="panel glass-card lobster-news-panel fade-in-up delay-3 tab-content" data-tab="news">
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
      {showAchievementModal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="成就弹窗"
          onClick={() => setShowAchievementModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div
            className="glass-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(900px, 100%)',
              maxHeight: '80vh',
              overflowY: 'auto',
              borderRadius: '16px',
              padding: '16px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(9, 14, 28, 0.9)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>🏆 成就</h3>
              <button
                type="button"
                onClick={() => setShowAchievementModal(false)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.08)',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                关闭
              </button>
            </div>

            {achievementsLoading ? <p style={{ margin: 0 }}>成就加载中...</p> : null}
            {achievementsError ? <p style={{ margin: 0, color: '#ff9f9f' }}>加载失败：{achievementsError}</p> : null}
            {!achievementsLoading && !achievementsError && achievements.length === 0 ? <p style={{ margin: 0 }}>暂无已解锁成就</p> : null}

            {!achievementsLoading && !achievementsError && achievements.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '12px',
                }}
              >
                {achievements.map((achievement) => (
                  <article
                    key={achievement.id}
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.16)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '24px' }}>{achievement.icon || '🏅'}</span>
                      <strong>{achievement.name}</strong>
                    </div>
                    <p style={{ margin: '0 0 8px 0', opacity: 0.92 }}>{achievement.description || '暂无描述'}</p>
                    <p style={{ margin: 0, fontSize: '12px', opacity: 0.75 }}>解锁时间：{formatUnlockTime(achievement)}</p>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
