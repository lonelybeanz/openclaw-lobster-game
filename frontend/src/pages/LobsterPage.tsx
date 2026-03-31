import { useEffect, useMemo, useState } from 'react';
import {
  RequestTimeoutError,
  deepTalk,
  getCareMessage,
  getHealthTrend,
  getLobsterNews,
  getLobsterStats,
  getMemoryLlmEval,
  getMemoryScore,
  getMilestones,
  getSearchResult,
  getVisualizationSnapshot,
  getLobsterPond,
  interact,
  saveMemoryLlmEval,
  searchNews,
} from '../api';
import type { LobsterAgent } from '../api';
import type {
  AchievementItem,
  HealthTrendSnapshot,
  LobsterNewsItem,
  LobsterStats,
  MemoryLlmEvalResponse,
  MemoryLlmEvalSavedRecord,
  MemoryScoreSnapshot,
  RandomEvent,
  VisualizationSnapshot,
} from '../types';
import MemoryScorePanel from '../components/MemoryScorePanel';
import VisualizationDashboard from '../components/VisualizationDashboard';
import EvolutionTrendChart from '../components/EvolutionTrendChart';
import GameDashboard from '../components/GameDashboard';

type ActionType = 'feed' | 'train' | 'rest';

type DeltaState = {
  hunger: number;
  mood: number;
  fatigue: number;
  experience: number;
};

type SearchUiState = 'idle' | 'loading' | 'success' | 'empty' | 'error' | 'timeout';

const SEARCH_START_TIMEOUT_MS = 10000;
const SEARCH_POLL_INTERVAL_MS = 2000;
const SEARCH_MAX_WAIT_MS = 60000;

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

function formatDateLabel(value?: string | null) {
  if (!value) {
    return '暂无记录';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function formatDateTimeLabel(value?: string | null) {
  if (!value) {
    return '暂无记录';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function evalTone(score: number | null) {
  if (score === null) {
    return '#cbd5e1';
  }
  if (score >= 90) {
    return '#86efac';
  }
  if (score >= 75) {
    return '#fde68a';
  }
  return '#fca5a5';
}

export default function LobsterPage() {
  const [stats, setStats] = useState<LobsterStats | null>(null);
  const [news, setNews] = useState<LobsterNewsItem[]>([]);
  const [memorySnapshot, setMemorySnapshot] = useState<MemoryScoreSnapshot | null>(null);
  const [visualizationSnapshot, setVisualizationSnapshot] = useState<VisualizationSnapshot | null>(null);
  const [healthTrendSnapshot, setHealthTrendSnapshot] = useState<HealthTrendSnapshot | null>(null);
  const [lobsterAgents, setLobsterAgents] = useState<LobsterAgent[]>([]);
  const [lobsterAgentsLoading, setLobsterAgentsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [newsLoading, setNewsLoading] = useState(true);
  const [memoryLoading, setMemoryLoading] = useState(true);
  const [visualizationLoading, setVisualizationLoading] = useState(true);
  const [healthTrendLoading, setHealthTrendLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [visualizationError, setVisualizationError] = useState<string | null>(null);
  const [healthTrendError, setHealthTrendError] = useState<string | null>(null);
  const [memoryEval, setMemoryEval] = useState<MemoryLlmEvalResponse | null>(null);
  const [memoryEvalLoading, setMemoryEvalLoading] = useState(false);
  const [memoryEvalMessage, setMemoryEvalMessage] = useState('点击 AI 评分，检查每个 agent 的记忆结构、可检索性和长期记忆支持度。');
  const [memoryEvalError, setMemoryEvalError] = useState<string | null>(null);
  const [memoryEvalSavedRecord, setMemoryEvalSavedRecord] = useState<MemoryLlmEvalSavedRecord | null>(null);
  const [delta, setDelta] = useState<DeltaState>(initialDelta);
  const [lastAction, setLastAction] = useState<string>('等待互动');
  const [expandedNewsId, setExpandedNewsId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'status' | 'evolution' | 'memory' | 'news' | 'dashboard'>('dashboard');
  const [newsSubTab, setNewsSubTab] = useState<'github' | 'search'>('github');
  const [timelinePeriod, setTimelinePeriod] = useState<'7d' | '30d' | '90d'>('7d');
  const [showFormulaGuide, setShowFormulaGuide] = useState(false);
  const [activeFormula, setActiveFormula] = useState<string | null>(null);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [milestoneCategories, setMilestoneCategories] = useState<any[]>([]);
  const [milestonesLoading, setMilestonesLoading] = useState(false);
  const [careMessage, setCareMessage] = useState<string | null>(null);
  const [deepTalkLoading, setDeepTalkLoading] = useState(false);
  const [deepTalkInput, setDeepTalkInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('OpenClaw 最新版本 新功能 教程');
  const [searchResults, setSearchResults] = useState<LobsterNewsItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchState, setSearchState] = useState<SearchUiState>('idle');
  const [searchMessage, setSearchMessage] = useState('');
  const [searchJobId, setSearchJobId] = useState<string | null>(null);
  const [showSearchTimeoutModal, setShowSearchTimeoutModal] = useState(false);
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

  async function loadMemorySnapshot() {
    try {
      setMemoryLoading(true);
      setMemoryError(null);
      const data = await getMemoryScore();
      setMemorySnapshot(data);
    } catch (e) {
      setMemoryError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setMemoryLoading(false);
    }
  }

  async function loadVisualization() {
    try {
      setVisualizationLoading(true);
      setVisualizationError(null);
      const data = await getVisualizationSnapshot();
      setVisualizationSnapshot(data);
    } catch (e) {
      setVisualizationError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setVisualizationLoading(false);
    }
  }

  async function loadHealthTrend() {
    try {
      setHealthTrendLoading(true);
      setHealthTrendError(null);
      const data = await getHealthTrend('30d');
      setHealthTrendSnapshot(data);
    } catch (e) {
      setHealthTrendError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setHealthTrendLoading(false);
    }
  }

  async function loadLobsterAgents() {
    try {
      setLobsterAgentsLoading(true);
      const data = await getLobsterPond();
      setLobsterAgents(data);
    } catch (e) {
      console.error('加载龙虾群失败:', e);
    } finally {
      setLobsterAgentsLoading(false);
    }
  }

  async function refreshAll() {
    await Promise.all([
      loadStats(), 
      loadNews(), 
      loadMemorySnapshot(), 
      loadVisualization(), 
      loadHealthTrend(),
      loadLobsterAgents()
    ]);
  }

  async function openMilestoneModal() {
    setShowMilestoneModal(true);
    setMilestonesLoading(true);
    try {
      const [milestoneData, careData] = await Promise.all([getMilestones(), getCareMessage()]);
      setMilestones(milestoneData?.milestones || []);
      setMilestoneCategories(milestoneData?.categories || []);
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
      setMilestoneCategories(data?.categories || []);
      
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

  async function handleMemoryEval() {
    try {
      setMemoryEvalLoading(true);
      setMemoryEvalError(null);
      setMemoryEvalMessage('AI 正在逐个检查 agent 的核心记忆文件，这通常需要几十秒，请稍等。');
      const result = await getMemoryLlmEval();
      setMemoryEval(result);
      setMemoryEvalMessage('评分完成，正在将结果写入后端 JSON 持久化存储...');
      const savedRecord = await saveMemoryLlmEval(result);
      setMemoryEvalSavedRecord(savedRecord);
      setMemoryEvalMessage(`AI 评分完成，已保存 ${result.agents.length} 个 agent 的评分结果。`);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'AI 评分失败';
      setMemoryEvalError(message);
      setMemoryEvalMessage('本次评分没有成功返回结果，你可以稍后重试。');
    } finally {
      setMemoryEvalLoading(false);
    }
  }

  function applySearchResults(items: LobsterNewsItem[]) {
    setSearchResults(items);
    if (items.length > 0) {
      setSearchState('success');
      setSearchMessage(`已找到 ${items.length} 条资讯`);
      setLastAction('搜索完成！🔍');
      return;
    }

    setSearchState('empty');
    setSearchMessage('这次没有找到相关资讯，可以换个关键词重试。');
    setLastAction('未找到结果');
  }

  async function pollSearchJob(jobId: string, maxWaitMs: number | null = SEARCH_MAX_WAIT_MS) {
    const deadline = maxWaitMs === null ? null : Date.now() + maxWaitMs;

    while (deadline === null || Date.now() < deadline) {
      const result = await getSearchResult(jobId, SEARCH_START_TIMEOUT_MS);
      if (result?.status === 'done') {
        const results = Array.isArray(result.results) ? result.results.map(normalizeNewsItem) : [];
        setShowSearchTimeoutModal(false);
        applySearchResults(results);
        return true;
      }

      if (result?.status === 'error') {
        setShowSearchTimeoutModal(false);
        throw new Error(result.error || '搜索任务失败');
      }

      await new Promise((resolve) => window.setTimeout(resolve, SEARCH_POLL_INTERVAL_MS));
    }

    setSearchState('timeout');
    setSearchMessage('搜索已超过 60 秒，OpenClaw 仍在处理中。');
    setLastAction('搜索超时，等待你的选择');
    setShowSearchTimeoutModal(true);
    return false;
  }

  async function handleSearch() {
    const query = searchQuery.trim();
    if (!query) {
      setSearchState('error');
      setSearchMessage('请输入搜索关键词');
      return;
    }

    setActiveTab('news');
    setNewsSubTab('search');
    setSearchLoading(true);
    setSearchState('loading');
    setSearchMessage('正在调用 OpenClaw 搜索互联网资讯，预计需要 1 分钟左右...');
    setSearchResults([]);
    setSearchJobId(null);
    setShowSearchTimeoutModal(false);

    try {
      const job = await searchNews(query, true, SEARCH_START_TIMEOUT_MS);
      if (!job?.jobId) {
        throw new Error('搜索任务创建失败');
      }

      setSearchJobId(job.jobId);
      await pollSearchJob(job.jobId);
    } catch (e) {
      const message =
        e instanceof RequestTimeoutError
          ? '搜索请求启动超时，请检查后端或稍后重试。'
          : e instanceof Error
            ? e.message
            : '搜索失败';
      setSearchState('error');
      setSearchMessage(message);
      setLastAction('搜索失败');
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleContinueSearch() {
    if (!searchJobId) {
      return;
    }

    setShowSearchTimeoutModal(false);
    setSearchLoading(true);
    setSearchState('loading');
    setSearchMessage('继续等待 OpenClaw 返回搜索结果...');

    try {
      await pollSearchJob(searchJobId, null);
    } catch (e) {
      const message = e instanceof Error ? e.message : '继续查询失败';
      setSearchState('error');
      setSearchMessage(message);
      setLastAction('继续查询失败');
    } finally {
      setSearchLoading(false);
    }
  }

  function handleCancelSearchWait() {
    setShowSearchTimeoutModal(false);
    setSearchLoading(false);
    setSearchState('timeout');
    setSearchMessage('你已停止等待，本次搜索任务可稍后重新发起。');
    setLastAction('已取消等待搜索结果');
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
  const memoryOverview = {
    shallowCount: toNumber(view?.memory?.shallow?.count),
    shallowQuality: toNumber(view?.memory?.shallow?.quality),
    organization: toNumber(view?.memory?.organization),
    completeness: toNumber(view?.memory?.completeness),
    overallScore: toNumber(view?.memory?.overallScore ?? memorySnapshot?.overall?.score),
    deepCount: toNumber(view?.memory?.deep?.count),
    indexedAgents: toNumber(view?.memory?.indexedAgents ?? memorySnapshot?.indexedAgents),
    totalAgents: toNumber(view?.memory?.totalAgents ?? memorySnapshot?.totalAgents),
    historyDays: memorySnapshot?.history.length ?? 0,
    latestRunAt: memorySnapshot?.scheduler.lastRunAt ?? null,
  };

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
        <div className="lobster-header-summary">
          <div className="lobster-header-emoji">🦞</div>
          <div style={{ flex: 1 }}>
            <div className="lobster-header-description">最近互动</div>
            <div className="lobster-header-value">{lastAction}</div>
          </div>
        </div>
        <button className="refresh-btn" type="button" onClick={() => void refreshAll()} disabled={loading || newsLoading}>
          {loading || newsLoading ? '同步中...' : '🔄'}
        </button>
      </header>
      <div className="lobster-tabs" style={{ padding: '0 20px' }}>
        <button className={`lobster-tab${activeTab === 'dashboard' ? ' active' : ''}`} type="button" onClick={() => setActiveTab('dashboard')}>
          🎮仪表盘
        </button>
        <button className={`lobster-tab${activeTab === 'status' ? ' active' : ''}`} type="button" onClick={() => setActiveTab('status')}>
          📊状态
        </button>
        <button className={`lobster-tab${activeTab === 'evolution' ? ' active' : ''}`} type="button" onClick={() => setActiveTab('evolution')}>
          🧬进化
        </button>
        <button className={`lobster-tab${activeTab === 'memory' ? ' active' : ''}`} type="button" onClick={() => setActiveTab('memory')}>
          💾记忆
        </button>
        <button className={`lobster-tab${activeTab === 'news' ? ' active' : ''}`} type="button" onClick={() => setActiveTab('news')}>
          📰资讯
        </button>
      </div>
      {error ? <div className="panel error glass-card">数据加载失败：{error}</div> : null}
      {loading && !stats ? <div className="panel glass-card">正在加载龙虾状态...</div> : null}
      {newsError ? <div className="panel error glass-card">资讯加载失败：{newsError}</div> : null}

      {view ? (
        <>
          {/* 🎮 游戏化仪表盘 Tab */}
          <section className="tab-content dashboard-tab-content" data-tab="dashboard" style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}>
            <GameDashboard />
          </section>

          <section className="lobster-main-grid tab-content" data-tab="status" style={{ display: activeTab === 'status' ? 'grid' : 'none' }}>
            {/* 第一排：成长进度 + 状态属性 */}
            <div className="status-top-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', gridColumn: '1 / -1' }}>
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

                <div className="status-list" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <div className="status-item">
                    <div className="status-title-row">
                      <span>💖 心情 {sourceTip('心情 = 80 + min(20, totalTokens/50000)，基于使用量')}</span>
                      <strong>{view.mood}</strong>
                    </div>
                    <div className="meter-track">
                      <div className="meter-fill meter-fill-mood" style={{ width: `${view.mood}%` }} />
                    </div>
                  </div>

                  <div className="status-item">
                    <div className="status-title-row">
                      <span>😴 疲劳度 {sourceTip('疲劳度 = totalTokens/10000，最高80，使用越多越疲劳')}</span>
                      <strong>{view.fatigue}</strong>
                    </div>
                    <div className="meter-track">
                      <div className="meter-fill meter-fill-fatigue" style={{ width: `${view.fatigue}%` }} />
                    </div>
                  </div>

                  <div className="status-item">
                    <div className="status-title-row">
                      <span>🤝 忠诚度 {sourceTip('忠诚度 = 50 + totalTokens/10000，最高100')}</span>
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
            </div>

            {/* 搜索超时弹窗 - 移到状态模块外部 */}
            {showSearchTimeoutModal ? (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="搜索等待确认"
                onClick={handleCancelSearchWait}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0, 0, 0, 0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1100,
                  padding: '16px',
                }}
              >
                <div
                  className="glass-card"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: 'min(420px, 100%)',
                    borderRadius: '16px',
                    padding: '20px',
                    border: '1px solid rgba(255,255,255,0.18)',
                    background: 'rgba(9, 14, 28, 0.95)',
                  }}
                >
                  <h3 style={{ margin: '0 0 10px 0' }}>搜索还在进行中</h3>
                  <p style={{ margin: '0 0 16px 0', color: '#cfd6ff', lineHeight: 1.6 }}>
                    OpenClaw 搜索已超过 60 秒，是否继续等待？
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button type="button" onClick={handleCancelSearchWait} className="milestone-btn" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      取消
                    </button>
                    <button type="button" onClick={() => void handleContinueSearch()} className="milestone-btn">
                      继续等待
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* 龙虾群状态概览 - 详细版 */}
            <div style={{ gridColumn: '1 / -1', marginTop: '20px' }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#fff' }}>🦞 龙虾群状态（点击照顾）</h3>
              <div className="lobster-agents-detailed" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {lobsterAgentsLoading ? (
                  <div className="panel glass-card">加载中...</div>
                ) : lobsterAgents.length === 0 ? (
                  <div className="panel glass-card">暂无龙虾数据</div>
                ) : (
                  lobsterAgents.map((agent) => (
                    <div key={agent.id} className="panel glass-card lobster-agent-card" style={{ borderTop: `4px solid ${agent.color}` }}>
                      {/* 头部信息 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '36px' }}>{agent.emoji}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '16px' }}>{agent.name}</div>
                          <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                            {agent.personality === 'diligent' && '勤奋的'}
                            {agent.personality === 'lazy' && '懒散的'}
                            {agent.personality === 'curious' && '好奇的'}
                            {agent.personality === 'cautious' && '谨慎的'}
                            {agent.personality === 'adventurous' && '冒险的'}
                            {agent.personality === 'social' && '社交的'}
                            {agent.currentAction}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '20px', fontWeight: 700, color: agent.color }}>Lv.{agent.status.level}</div>
                          <div style={{ fontSize: '11px', color: '#9ca3af' }}>阶段 {agent.evolutionStage}/5</div>
                        </div>
                      </div>
                      
                      {/* 成长进度 */}
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                          <span>成长进度</span>
                          <span>{agent.status.growth} XP</span>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${Math.min(100, (agent.status.growth % 100))}%`, 
                            height: '100%', 
                            background: `linear-gradient(90deg, ${agent.color}, ${agent.color}80)`,
                            borderRadius: '3px'
                          }} />
                        </div>
                      </div>
                      
                      {/* 状态条 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                          <span style={{ width: '40px' }}>❤️ 体力</span>
                          <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${agent.status.hp}%`, height: '100%', background: '#22c55e', borderRadius: '2px' }} />
                          </div>
                          <span style={{ width: '30px', textAlign: 'right' }}>{agent.status.hp}%</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                          <span style={{ width: '40px' }}>🍖 饱食</span>
                          <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${100 - agent.status.hunger}%`, height: '100%', background: agent.status.hunger > 60 ? '#ef4444' : '#f59e0b', borderRadius: '2px' }} />
                          </div>
                          <span style={{ width: '30px', textAlign: 'right' }}>{100 - agent.status.hunger}%</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                          <span style={{ width: '40px' }}>😊 心情</span>
                          <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${agent.status.mood}%`, height: '100%', background: '#ec4899', borderRadius: '2px' }} />
                          </div>
                          <span style={{ width: '30px', textAlign: 'right' }}>{agent.status.mood}%</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                          <span style={{ width: '40px' }}>⚡ 能量</span>
                          <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${agent.status.energy}%`, height: '100%', background: '#3b82f6', borderRadius: '2px' }} />
                          </div>
                          <span style={{ width: '30px', textAlign: 'right' }}>{agent.status.energy}%</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                          <span style={{ width: '40px' }}>😴 疲劳</span>
                          <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${agent.fatigue}%`, height: '100%', background: '#6366f1', borderRadius: '2px' }} />
                          </div>
                          <span style={{ width: '30px', textAlign: 'right' }}>{agent.fatigue}%</span>
                        </div>
                      </div>
                      
                      {/* 操作按钮 */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          onClick={async () => {
                            const { feedLobster } = await import('../api');
                            await feedLobster(agent.id);
                            void loadLobsterAgents();
                          }}
                          style={{ flex: 1, padding: '8px', background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', border: 'none', borderRadius: '8px', color: 'white', fontSize: '12px', cursor: 'pointer' }}
                        >
                          🍖 喂食
                        </button>
                        <button 
                          onClick={async () => {
                            const { trainLobster } = await import('../api');
                            await trainLobster(agent.id);
                            void loadLobsterAgents();
                          }}
                          style={{ flex: 1, padding: '8px', background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)', border: 'none', borderRadius: '8px', color: 'white', fontSize: '12px', cursor: 'pointer' }}
                        >
                          💪 训练
                        </button>
                        <button 
                          onClick={async () => {
                            const { restLobster } = await import('../api');
                            await restLobster(agent.id);
                            void loadLobsterAgents();
                          }}
                          style={{ flex: 1, padding: '8px', background: 'linear-gradient(135deg, #3b82f6, #60a5fa)', border: 'none', borderRadius: '8px', color: 'white', fontSize: '12px', cursor: 'pointer' }}
                        >
                          😴 休息
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 数据可视化面板 - Token趋势/技能分布 */}
            <div style={{ gridColumn: '1 / -1', marginTop: '20px' }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#fff' }}>📊 数据统计</h3>
              <VisualizationDashboard
                snapshot={visualizationSnapshot}
                loading={visualizationLoading}
                error={visualizationError}
              />
            </div>
          </section>

          <section className="fade-in-up delay-3 tab-content" data-tab="evolution" style={{ display: activeTab === 'evolution' ? 'block' : 'none' }}>
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
            <EvolutionTrendChart trend={visualizationSnapshot?.evolutionScoreTrend ?? []} />
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

          <section className="fade-in-up delay-3 tab-content" data-tab="memory" style={{ display: activeTab === 'memory' ? 'block' : 'none' }}>
            <div className="memory-overview">
              <section className="panel glass-card memory-overview-hero">
                <div className="memory-overview-badge">Memory Overview</div>
                <div className="memory-overview-head">
                  <div>
                    <h3>记忆系统总览</h3>
                    <p>把规模、结构和索引状态集中到一屏，先看整体健康度，再向下看层级与 Agent 细节。</p>
                  </div>
                  <div className="memory-overview-score">
                    <span>综合评分</span>
                    <strong>{displayValue(memoryOverview.overallScore)}</strong>
                  </div>
                </div>
                <div className="memory-overview-highlights">
                  <div>
                    <span>活跃记忆文件</span>
                    <strong>{displayValue(memoryOverview.shallowCount)}</strong>
                  </div>
                  <div>
                    <span>深层记忆节点</span>
                    <strong>{displayValue(memoryOverview.deepCount)}</strong>
                  </div>
                  <div>
                    <span>索引 Agent</span>
                    <strong>{memoryOverview.indexedAgents}/{memoryOverview.totalAgents || '--'}</strong>
                  </div>
                </div>
                <div className="memory-overview-footer">
                  <span>最近调度: {formatDateLabel(memoryOverview.latestRunAt)}</span>
                  <span>评分样本: {memoryOverview.historyDays} 天</span>
                </div>
              </section>

              <section className="memory-overview-metrics">
                <article className="kpi-card gradient-card-soft memory-metric-card">
                  <p>浅层记忆数 {sourceTip('来自: memory/YYYY-MM-DD.md')}</p>
                  <h2>{displayValue(view.memory?.shallow?.count)}</h2>
                  <span>衡量日常记忆沉淀规模</span>
                </article>
                <article className="kpi-card gradient-card-soft memory-metric-card">
                  <p>浅层质量 {sourceTip('来自: 当日记忆文件结构评分')}</p>
                  <h2>{displayValue(view.memory?.shallow?.quality)}</h2>
                  <span>关注当天记录是否清晰可检索</span>
                </article>
                <article className="kpi-card gradient-card-soft memory-metric-card">
                  <p>组织度 {sourceTip('来自: 核心记忆文件覆盖')}</p>
                  <h2>{displayValue(view.memory?.organization)}</h2>
                  <span>越高说明核心文件结构越完整</span>
                </article>
                <article className="kpi-card gradient-card-soft memory-metric-card">
                  <p>完整度 {sourceTip('来自: MEMORY/SOUL/AGENTS/USER')}</p>
                  <h2>{displayValue(view.memory?.completeness)}</h2>
                  <span>衡量记忆体系是否形成闭环</span>
                </article>
              </section>
            </div>
            <MemoryScorePanel snapshot={memorySnapshot} loading={memoryLoading} error={memoryError} />
            <section className="memory-ai-eval-section">
              <article className="panel glass-card memory-ai-eval-hero">
                <div className="memory-panel-head">
                  <div>
                    <h3>AI 评分</h3>
                    <p>调用 `/lobster/memory-llm-eval`，按 agent 输出独立评分卡，并将结果持久化保存到后端 `data` 目录。</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleMemoryEval()}
                    disabled={memoryEvalLoading}
                    className="milestone-btn"
                  >
                    {memoryEvalLoading ? 'AI 评分中...' : 'AI评分'}
                  </button>
                </div>
                <div className={`memory-ai-eval-status${memoryEvalLoading ? ' loading' : ''}${memoryEvalError ? ' error' : ''}`}>
                  {memoryEvalMessage}
                </div>
                {memoryEvalSavedRecord ? (
                  <div className="memory-ai-eval-meta">
                    <span>最近保存: {formatDateTimeLabel(memoryEvalSavedRecord.savedAt)}</span>
                    <span>评估 Agent: {memoryEvalSavedRecord.result.totalAgents}</span>
                    <span>评估器: {memoryEvalSavedRecord.result.evaluatorAgentId}</span>
                  </div>
                ) : null}
              </article>

              {memoryEval?.agents?.length ? (
                <div className="memory-ai-eval-grid">
                  {memoryEval.agents.map((agent) => (
                    <article className="panel glass-card memory-ai-eval-card" key={agent.agentId}>
                      <div className="memory-panel-head">
                        <div>
                          <h3>{agent.name || agent.agentId}</h3>
                          <p>{agent.workspaceRoot}</p>
                        </div>
                        <div className="memory-ai-score-wrap">
                          <strong style={{ color: evalTone(agent.evaluation.score) }}>
                            {agent.evaluation.score ?? '--'}
                          </strong>
                          <span>{agent.evaluation.grade ?? '待定级'}</span>
                        </div>
                      </div>
                      <p className="memory-ai-summary">{agent.evaluation.summary || '暂无总结'}</p>
                      <div className="memory-layer-pill-row multi-memory-meta-row">
                        <span>文件 {agent.files.filter((file) => file.exists).length}/{agent.files.length}</span>
                        <span>{agent.agentId}</span>
                      </div>
                      {agent.evaluation.strengths.length > 0 ? (
                        <div className="memory-ai-points">
                          <label>亮点</label>
                          <div className="memory-issue-list">
                            {agent.evaluation.strengths.map((item) => (
                              <span key={`${agent.agentId}-strength-${item}`}>{item}</span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {agent.evaluation.risks.length > 0 ? (
                        <div className="memory-ai-points">
                          <label>风险</label>
                          <div className="memory-issue-list">
                            {agent.evaluation.risks.map((item) => (
                              <span key={`${agent.agentId}-risk-${item}`}>{item}</span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {agent.evaluation.suggestions.length > 0 ? (
                        <div className="memory-ai-points">
                          <label>建议</label>
                          <div className="memory-issue-list">
                            {agent.evaluation.suggestions.map((item) => (
                              <span key={`${agent.agentId}-suggestion-${item}`}>{item}</span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : null}
            </section>

            {/* 图表数据 */}

          </section>

          <section className="panel glass-card lobster-news-panel fade-in-up delay-3 tab-content" data-tab="news" style={{ display: activeTab === 'news' ? 'block' : 'none' }}>
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

                {searchMessage ? (
                  <div style={{ marginBottom: '12px', fontSize: '13px', color: searchState === 'error' ? '#ff9b9b' : '#cfd6ff' }}>
                    {searchMessage}
                  </div>
                ) : null}

                {searchState === 'loading' ? (
                  <div className="lobster-news-empty">正在检索资讯并等待 OpenClaw 返回结果...</div>
                ) : null}

                {searchState === 'error' ? (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <button type="button" onClick={() => void handleSearch()} disabled={searchLoading} className="milestone-btn">
                      重新搜索
                    </button>
                  </div>
                ) : null}

                {searchState === 'success' && searchResults.length > 0 ? (
                  <div style={{ maxHeight: '500px', overflow: 'auto' }}>
                    {searchResults.map((item) => (
                      <div key={item.id} style={{ padding: '12px', marginBottom: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', borderLeft: '3px solid #667eea' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '6px', lineHeight: '1.4' }}>{item.title}</div>
                        <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '6px', lineHeight: '1.4' }}>{item.summary}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', color: '#888' }}>{item.source} · {item.date || '未知日期'}</span>
                          {item.url ? (
                            <a href={item.url} target="_blank" rel="noreferrer" style={{ color: '#667eea', fontSize: '12px', flexShrink: 0 }}>
                              查看 →
                            </a>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#666', flexShrink: 0 }}>无链接</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {searchState === 'empty' ? <p className="lobster-news-empty">暂无匹配结果，试试更具体的关键词。</p> : null}
                {searchState === 'idle' ? <p className="lobster-news-empty">输入关键词搜索 OpenClaw 资讯</p> : null}
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

            {!milestonesLoading && milestoneCategories.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {milestoneCategories.map((category) => (
                  <section key={category.key} style={{ marginBottom: '8px' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '12px',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '24px' }}>{category.icon}</span>
                        <div>
                          <div style={{ fontSize: '16px', fontWeight: 600 }}>{category.name}</div>
                          <div style={{ fontSize: '12px', opacity: 0.7 }}>{category.description}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '18px', fontWeight: 700 }}>{category.unlocked}/{category.total}</div>
                        <div style={{ fontSize: '12px', opacity: 0.7 }}>已完成</div>
                      </div>
                    </div>
                    
                    {/* 分类进度条 */}
                    <div style={{
                      height: '6px',
                      borderRadius: '999px',
                      background: 'rgba(255,255,255,0.08)',
                      overflow: 'hidden',
                      marginBottom: '12px',
                    }}>
                      <div style={{
                        width: `${category.progressPercent}%`,
                        height: '100%',
                        borderRadius: '999px',
                        background: 'linear-gradient(90deg, #22c55e, #4ade80)',
                        transition: 'width 0.6s ease',
                      }} />
                    </div>

                    {/* 成就列表 */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '10px',
                    }}>
                      {category.milestones?.map((milestone: any) => (
                        <article
                          key={milestone.id}
                          style={{
                            padding: '12px',
                            borderRadius: '10px',
                            background: milestone.unlocked
                              ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(16, 185, 129, 0.1))'
                              : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${milestone.unlocked ? 'rgba(34, 197, 94, 0.4)' : 'rgba(255,255,255,0.08)'}`,
                            opacity: milestone.unlocked ? 1 : 0.6,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <span style={{ fontSize: '20px' }}>{milestone.icon || '🎯'}</span>
                            <strong style={{ fontSize: '14px' }}>{milestone.name}</strong>
                          </div>
                          <p style={{ margin: '0 0 8px 0', opacity: 0.85, fontSize: '12px' }}>{milestone.description}</p>
                          
                          {/* 进度条 */}
                          {milestone.max && milestone.max > 0 ? (
                            <div style={{ marginBottom: '6px' }}>
                              <div style={{
                                height: '4px',
                                borderRadius: '999px',
                                background: 'rgba(255,255,255,0.08)',
                                overflow: 'hidden',
                              }}>
                                <div style={{
                                  width: `${milestone.progressPercent || 0}%`,
                                  height: '100%',
                                  borderRadius: '999px',
                                  background: milestone.unlocked 
                                    ? 'linear-gradient(90deg, #22c55e, #4ade80)' 
                                    : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                                  transition: 'width 0.4s ease',
                                }} />
                              </div>
                              <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                fontSize: '11px', 
                                opacity: 0.7,
                                marginTop: '4px' 
                              }}>
                                <span>{milestone.progress || 0}/{milestone.max}</span>
                                <span>{milestone.progressPercent || 0}%</span>
                              </div>
                            </div>
                          ) : null}
                          
                          {milestone.unlocked ? (
                            <p style={{ margin: 0, fontSize: '11px', color: '#4ade80' }}>✓ 已解锁</p>
                          ) : (
                            <p style={{ margin: 0, fontSize: '11px', opacity: 0.5 }}>未解锁</p>
                          )}
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
