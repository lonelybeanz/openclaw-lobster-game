import { useEffect, useMemo, useState } from 'react';
import { getLobsterNews, getLobsterStats, interact, getMilestones, getCareMessage, deepTalk, searchNews } from '../api';
import type { AchievementItem, LobsterNewsItem, LobsterStats, RandomEvent } from '../types';

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

function normalizeNewsItem(item: Partial<LobsterNewsItem>, index: number): LobsterNewsItem {
  return {
    id: item.id || `news-${index}`,
    title: item.title || '无标题',
    summary: item.summary || item.content || '暂无简介',
    source: item.source || '未知来源',
    date: item.date || item.publishedAt || '',
    content: item.content || item.summary || '',
    url: item.url,
    publishedAt: item.publishedAt || item.date,
  };
}

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

function sourceTip(text: string) {
  return (
    <span className="source-tip" data-tip={text} role="note" aria-label={`数据来源：${text}`}>
      ⓘ
    </span>
  );
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
  const [newsSubTab, setNewsSubTab] = useState<'github' | 'search'>('github');
  const [showFormulaGuide, setShowFormulaGuide] = useState(false);
  const [activeFormula, setActiveFormula] = useState<string | null>(null);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [milestonesLoading, setMilestonesLoading] = useState(false);
  const [careMessage, setCareMessage] = useState<string | null>(null);
  const [deepTalkLoading, setDeepTalkLoading] = useState(false);
  const [deepTalkInput, setDeepTalkInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('OpenClaw 最新版本 新功能 教程');
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
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
      const normalized = (Array.isArray(data) ? data : []).map(normalizeNewsItem);
      setNews(normalized);
      setExpandedNewsId((prev) => (prev && normalized.some((item) => item.id === prev) ? prev : normalized[0]?.id ?? null));
    } catch (e) {
      setNewsError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setNewsLoading(false);
    }
  }

  async function refreshAll() {
    await Promise.all([loadStats(), loadNews()]);
  }

  async function openMilestoneModal() {
    setShowMilestoneModal(true);
    setMilestonesLoading(true);
    try {
      const [milestoneData, careData] = await Promise.all([getMilestones(), getCareMessage()]);
      setMilestones(milestoneData?.milestones || []);
      setCareMessage(careData?.message);
    } catch (e) {
      console.error('加载成长记录失败:', e);
    } finally {
      setMilestonesLoading(false);
    }
  }

  async function handleDeepTalk() {
    if (!deepTalkInput.trim()) {
      setLastAction('请输入想说的话~');
      return;
    }
    setDeepTalkLoading(true);
    try {
      const result = await deepTalk(deepTalkInput);
      
      // 刷新里程碑
      const data = await getMilestones();
      setMilestones(data?.milestones || []);
      
      // 显示小龙虾的回复
      if (result?.reply) {
        setLastAction(`小龙虾: ${result.reply}`);
      } else if (result?.success) {
        setLastAction('深度对话成功！🧠');
      } else {
        setLastAction('对话已发送~');
      }
      setDeepTalkInput('');
    } catch (e) {
      console.error('深度对话失败:', e);
      setLastAction('对话发送失败');
    } finally {
      setDeepTalkLoading(false);
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchResults(null);
    try {
      const result = await searchNews(searchQuery);
      const results = Array.isArray(result?.results) ? result.results.map(normalizeNewsItem) : [];
      if (results && results.length > 0) {
        setSearchResults(results);
        setNewsSubTab('search');
        setLastAction('搜索完成！🔍');
      } else {
        setLastAction('未找到结果');
      }
    } catch (e) {
      setLastAction('搜索失败');
    } finally {
      setSearchLoading(false);
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
    { key: 'intelligence', label: '智力', value: intelligenceScore, formula: '脑神经×0.3 + 神经元×0.2 + 推理×0.5', rule: '影响学习速度和问题解决能力' },
    { key: 'perception', label: '感知', value: perceptionScore, formula: '视叶×0.35 + 触角叶×0.35 + 触角×0.15 + 脑干×0.15', rule: '影响信息采集和环境感知能力' },
    { key: 'memory', label: '记忆力', value: memoryScore, formula: '短期×0.2 + 长期×0.3 + 情景×0.2 + 程序×0.2', rule: '影响记忆存储和检索能力' },
    { key: 'reaction', label: '反应', value: reactionScore, formula: '小脑×0.3 + 脑干×0.25 + 敏捷×0.25 + 杏仁核×0.2', rule: '影响行动响应速度' },
    { key: 'growth', label: '成长值', value: growthScore, formula: 'EXP进度×0.35 + 等级×0.25 + 耐力×0.2 + 心情×0.1', rule: '影响进化速度和上限' },
  ] as const;

  return (
    <div className="page-shell lobster-page">
      <div className="bg-orb bg-orb-one" />
      <div className="bg-orb bg-orb-two" />
      <div className="bg-orb bg-orb-three" />

      <header className="header lobster-header glass-card fade-in-up">
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ fontSize: '48px', lineHeight: 1 }}>🦞</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '4px' }}>最近互动</div>
            <div style={{ fontSize: '15px', color: '#fff' }}>{lastAction}</div>
          </div>
        </div>
        <button className="refresh-btn" type="button" onClick={() => void refreshAll()} disabled={loading || newsLoading}>
          {loading || newsLoading ? '同步中...' : '🔄'}
        </button>
      </header>
      <div style={{display:"flex", gap:"8px", marginBottom:"15px", padding:"0 20px"}}>
        <button style={{flex:1, padding:"10px", border:"none", borderRadius:"8px", background:activeTab==="status"?"linear-gradient(135deg, #667eea, #764ba2)":"rgba(255,255,255,0.1)", color:"white", cursor:"pointer"}} onClick={()=>setActiveTab("status")}>📊状态</button>
        <button style={{flex:1, padding:"10px", border:"none", borderRadius:"8px", background:activeTab==="evolution"?"linear-gradient(135deg, #667eea, #764ba2)":"rgba(255,255,255,0.1)", color:"white", cursor:"pointer"}} onClick={()=>setActiveTab("evolution")}>🧬进化</button>
        <button style={{flex:1, padding:"10px", border:"none", borderRadius:"8px", background:activeTab==="memory"?"linear-gradient(135deg, #667eea, #764ba2)":"rgba(255,255,255,0.1)", color:"white", cursor:"pointer"}} onClick={()=>setActiveTab("memory")}>💾记忆</button>
        <button style={{flex:1, padding:"10px", border:"none", borderRadius:"8px", background:activeTab==="news"?"linear-gradient(135deg, #667eea, #764ba2)":"rgba(255,255,255,0.1)", color:"white", cursor:"pointer"}} onClick={()=>setActiveTab("news")}>📰资讯</button>
      </div>
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
              <p className="lobster-level">Lv.{view.level} {sourceTip('来自: Tokens / 50000')}</p>
              <h2>成长进度</h2>
              <div className="meter-track meter-track-exp">
                <div className="meter-fill meter-fill-exp" style={{ width: `${expRatio}%` }} />
              </div>
              <p className="meter-text">
                EXP {formatNumber(view.experience)} / {formatNumber(view.maxExperience)} {sourceTip('来自: totalTokens % 50000')}
              </p>
              <p className="lobster-age">寿命：{view.age} 天</p>
            </article>

            <article className="panel lobster-status-card glass-card fade-in-up delay-2">
              <h3>状态属性</h3>

              <div className="status-list">
                <div className="status-item">
                  <div className="status-title-row">
                    <span>🍤 饱食度 {sourceTip('来自: lobster-state.hunger')}</span>
                    <strong>{view.hunger}</strong>
                  </div>
                  <div className="meter-track">
                    <div className="meter-fill meter-fill-hunger" style={{ width: `${view.hunger}%` }} />
                  </div>
                </div>

                <div className="status-item">
                  <div className="status-title-row">
                    <span>💖 心情 {sourceTip('来自: lobster-state.mood')}</span>
                    <strong>{view.mood}</strong>
                  </div>
                  <div className="meter-track">
                    <div className="meter-fill meter-fill-mood" style={{ width: `${view.mood}%` }} />
                  </div>
                </div>

                <div className="status-item">
                  <div className="status-title-row">
                    <span>😴 疲劳度 {sourceTip('来自: lobster-state.fatigue')}</span>
                    <strong>{view.fatigue}</strong>
                  </div>
                  <div className="meter-track">
                    <div className="meter-fill meter-fill-fatigue" style={{ width: `${view.fatigue}%` }} />
                  </div>
                </div>

                <div className="status-item">
                  <div className="status-title-row">
                    <span>🤝 忠诚度 {sourceTip('来自: lobster-state.loyalty')}</span>
                    <strong>{view.loyalty}</strong>
                  </div>
                  <div className="meter-track">
                    <div className="meter-fill meter-fill-loyalty" style={{ width: `${view.loyalty}%` }} />
                  </div>
                </div>
              </div>

              <div className="milestone-row">
                <button type="button" onClick={() => void openMilestoneModal()} className="milestone-btn">
                  🎯 成长之路
                </button>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <input
                  type="text"
                  value={deepTalkInput}
                  onChange={(e) => setDeepTalkInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void handleDeepTalk()}
                  placeholder="想对小龙虾说什么？"
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #667eea', background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '14px' }}
                />
                <button type="button" onClick={() => void handleDeepTalk()} disabled={deepTalkLoading} className="milestone-btn" style={{ whiteSpace: 'nowrap' }}>
                  {deepTalkLoading ? '发送中...' : '💬 发送'}
                </button>
              </div>
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <p style={{ margin: 0, fontSize: '13px', opacity: 0.85 }}>{metric.label}</p>
                    <span
                      data-formula={metric.formula}
                      data-rule={metric.rule}
                      className="metric-tooltip"
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: 'rgba(102,126,234,0.7)',
                        color: 'white',
                        fontSize: '11px',
                        lineHeight: '18px',
                        textAlign: 'center',
                        cursor: 'help',
                        userSelect: 'none',
                        display: 'inline-block',
                      }}
                    >
                      ?
                    </span>
                  </div>
                  <h2 style={{ margin: 0, fontSize: '28px' }}>{metric.value.toFixed(1)}</h2>
                </article>
              ))}
            </div>
            <h4 style={{ margin: '0 0 12px 0' }}>Benchmark 评测整合</h4>
            <div
              className="kpi-grid lobster-kpi-grid"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' }}
            >
              <article className="kpi-card gradient-card-soft">
                <p>Intelligence {sourceTip('来自: artificialanalysis intelligence_index')}</p>
                <h2>{benchmarkIntelligence.toFixed(1)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>Reasoning {sourceTip('来自: reasoning_model 标记')}</p>
                <h2>{benchmarkReasoning.toFixed(1)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>Context {sourceTip('来自: context_window')}</p>
                <h2>{benchmarkContext.toFixed(1)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>Speed {sourceTip('来自: output_speed / tokens_per_second')}</p>
                <h2>{benchmarkSpeed.toFixed(1)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>Latency {sourceTip('来自: latency / first_token_latency')}</p>
                <h2>{benchmarkLatency.toFixed(1)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>Cost {sourceTip('来自: price(input+output)')}</p>
                <h2>{benchmarkCost.toFixed(1)}</h2>
              </article>
            </div>
            <h4 style={{ margin: '0 0 12px 0' }}>大脑属性</h4>
            <div
              className="kpi-grid lobster-kpi-grid"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' }}
            >
              <article className="kpi-card gradient-card-soft">
                <p>脑神经 {sourceTip('来自: tokens + 模型推理 + benchmark intelligence')}</p>
                <h2>{displayValue(view.brain?.cerebral)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>视叶 {sourceTip('来自: tokens + 模型视觉能力')}</p>
                <h2>{displayValue(view.brain?.opticLobes)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>触角叶 {sourceTip('来自: 感知能力 + benchmark context')}</p>
                <h2>{displayValue(view.brain?.antennaLobe)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>神经元 {sourceTip('来自: totalSessions + creativity')}</p>
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
                <p>小脑 {sourceTip('来自: coding + benchmark speed')}</p>
                <h2>{displayValue(view.brain?.cerebellum)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>脑干 {sourceTip('来自: benchmark latency/reasoning')}</p>
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
                <p>触角 {sourceTip('来自: contextWindow + tokens')}</p>
                <h2>{displayValue(view.limbs?.antennae)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>尾巴 {sourceTip('来自: output + benchmark speed')}</p>
                <h2>{displayValue(view.limbs?.tail)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>力量</p>
                <h2>{displayValue(view.limbs?.strength)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>敏捷 {sourceTip('来自: tokens + benchmark latency')}</p>
                <h2>{displayValue(view.limbs?.agility)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>耐力 {sourceTip('来自: 模型效率 + benchmark cost')}</p>
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
                <p>浅层记忆数 {sourceTip('来自: memory/YYYY-MM-DD-*.md 文件计数')}</p>
                <h2>{displayValue(view.memory?.shallow?.count)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>记忆质量 {sourceTip('来自: 记忆内容结构评分')}</p>
                <h2>{displayValue(view.memory?.shallow?.quality)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>组织度 {sourceTip('来自: MEMORY/SOUL/USER 等核心文件覆盖')}</p>
                <h2>{displayValue(view.memory?.organization)}</h2>
              </article>
              <article className="kpi-card gradient-card-soft">
                <p>完整度 {sourceTip('来自: MEMORY.md + USER.md + SOUL.md')}</p>
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
            {/* 子标签页 */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button 
                onClick={() => setNewsSubTab('github')}
                style={{ 
                  flex: 1, 
                  padding: '10px', 
                  border: 'none', 
                  borderRadius: '8px', 
                  background: newsSubTab === 'github' ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'rgba(255,255,255,0.1)', 
                  color: 'white', 
                  cursor: 'pointer',
                  fontWeight: newsSubTab === 'github' ? 'bold' : 'normal'
                }}
              >
                📰 GitHub 资讯
              </button>
              <button 
                onClick={() => setNewsSubTab('search')}
                style={{ 
                  flex: 1, 
                  padding: '10px', 
                  border: 'none', 
                  borderRadius: '8px', 
                  background: newsSubTab === 'search' ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'rgba(255,255,255,0.1)', 
                  color: 'white', 
                  cursor: 'pointer',
                  fontWeight: newsSubTab === 'search' ? 'bold' : 'normal'
                }}
              >
                🔍 搜索结果
              </button>
            </div>

            {/* GitHub 资讯 */}
            {newsSubTab === 'github' && (
              <>
                <div className="lobster-news-header">
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
                              <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>{item.date} · {item.source}</div>
                              <p style={{ margin: '0 0 10px 0', lineHeight: '1.6', color: '#d6d8e6' }}>
                                {item.content || item.summary}
                              </p>
                              {item.url ? (
                                <a href={item.url} target="_blank" rel="noreferrer" style={{ color: '#667eea', fontSize: '13px' }}>
                                  查看原文 →
                                </a>
                              ) : null}
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                ) : null}
              </>
            )}

            {/* 搜索结果 */}
            {newsSubTab === 'search' && (
              <>
                <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(102,126,234,0.2)', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
                      placeholder="输入关键词搜索..."
                      style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #667eea', background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '14px' }}
                    />
                    <button type="button" onClick={() => void handleSearch()} disabled={searchLoading} className="milestone-btn" style={{ whiteSpace: 'nowrap' }}>
                      {searchLoading ? '搜索中...' : '🔍'}
                    </button>
                  </div>
                </div>
                
                {searchLoading ? (
                  <p className="lobster-news-empty">搜索中...</p>
                ) : searchResults && searchResults.length > 0 ? (
                  <div style={{ maxHeight: '500px', overflow: 'auto' }}>
                    {searchResults.map((item: any) => (
                      <div key={item.id} style={{ padding: '12px', marginBottom: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', borderLeft: '3px solid #667eea' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '6px', lineHeight: '1.4' }}>{item.title}</div>
                        <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '6px', lineHeight: '1.4' }}>{item.summary}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: '#888' }}>{item.source} · {item.date}</span>
                          {item.url ? (
                            <a href={item.url} target="_blank" rel="noreferrer" style={{ color: '#667eea', fontSize: '12px' }}>
                              查看 →
                            </a>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#666' }}>无链接</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="lobster-news-empty">输入关键词搜索 OpenClaw 资讯</p>
                )}
              </>
            )}
          </section>
        </>
      ) : null}
      {/* 成长里程碑模态框 */}
      {showMilestoneModal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="成长记录弹窗"
          onClick={() => setShowMilestoneModal(false)}
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
              <h3 style={{ margin: 0 }}>🎯 成长之路</h3>
              <button
                type="button"
                onClick={() => setShowMilestoneModal(false)}
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

            {/* 主动关怀 */}
            {careMessage && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(139, 92, 246, 0.2))',
                  border: '1px solid rgba(139, 92, 246, 0.4)',
                  marginBottom: '16px',
                }}
              >
                <span style={{ fontSize: '20px' }}>💬 </span>
                <span>{careMessage}</span>
              </div>
            )}

            {milestonesLoading ? <p style={{ margin: 0 }}>成长记录加载中...</p> : null}
            {!milestonesLoading && milestones.length === 0 ? <p style={{ margin: 0 }}>暂无成长记录</p> : null}

            {!milestonesLoading && milestones.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                }}
              >
                {milestones.map((milestone) => (
                  <article
                    key={milestone.id}
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      background: milestone.unlocked 
                        ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(16, 185, 129, 0.15))'
                        : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${milestone.unlocked ? 'rgba(34, 197, 94, 0.5)' : 'rgba(255,255,255,0.1)'}`,
                      opacity: milestone.unlocked ? 1 : 0.5,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '24px' }}>{milestone.icon || '🎯'}</span>
                      <strong>{milestone.name}</strong>
                    </div>
                    <p style={{ margin: '0 0 8px 0', opacity: 0.92, fontSize: '14px' }}>{milestone.description || '暂无描述'}</p>
                    {milestone.unlocked && milestone.unlockedAt ? (
                      <p style={{ margin: 0, fontSize: '12px', color: '#4ade80' }}>✓ 已解锁</p>
                    ) : (
                      <p style={{ margin: 0, fontSize: '12px', opacity: 0.6 }}>未解锁</p>
                    )}
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
