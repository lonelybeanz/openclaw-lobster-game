import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { getMemoryScore } from '../api';
import type { MemoryAgentScore, MemoryScoreSnapshot } from '../types';

type MainTab = 'overview' | 'layers' | 'agents' | 'tests';

const tabs: Array<{ key: MainTab; label: string; shortLabel: string }> = [
  { key: 'overview', label: '总览视图', shortLabel: '总览' },
  { key: 'layers', label: '层级结构', shortLabel: '层级' },
  { key: 'agents', label: 'Agent 标签页', shortLabel: 'Agent' },
  { key: 'tests', label: '测试报告', shortLabel: '测试' },
];

const tabButtonStyle = (active: boolean) => ({
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'flex-start',
  gap: 4,
  border: '1px solid rgba(255,255,255,0.18)',
  background: active ? 'linear-gradient(135deg, rgba(56,189,248,0.34), rgba(16,185,129,0.28))' : 'rgba(255,255,255,0.08)',
  color: '#f8fafc',
  borderRadius: 999,
  padding: '12px 18px',
  cursor: 'pointer',
  fontWeight: 700,
  whiteSpace: 'nowrap' as const,
  boxShadow: active ? '0 8px 24px rgba(56,189,248,0.18)' : 'none',
});

const metricCardStyle = {
  minWidth: 0,
  padding: 18,
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))',
};

const statLabelStyle = {
  display: 'block',
  fontSize: 12,
  color: '#bfdbfe',
  marginBottom: 8,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
};

function metricText(value?: number | null) {
  return Number.isFinite(value) ? String(value) : '--';
}

function formatTime(value?: string | null, options?: Intl.DateTimeFormatOptions) {
  if (!value) {
    return '暂无';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', options ?? {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildChartOption(snapshot: MemoryScoreSnapshot) {
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: {
      top: 0,
      textStyle: { color: '#dbeafe' },
    },
    grid: {
      left: 24,
      right: 18,
      top: 44,
      bottom: 24,
    },
    xAxis: {
      type: 'category',
      data: snapshot.history.map((item) => item.date.slice(5)),
      axisLine: { lineStyle: { color: 'rgba(191,219,254,0.28)' } },
      axisLabel: { color: '#cbd5e1' },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      splitLine: { lineStyle: { color: 'rgba(148,163,184,0.16)' } },
      axisLabel: { color: '#cbd5e1' },
    },
    series: [
      {
        name: '综合评分',
        type: 'line',
        smooth: true,
        symbolSize: 8,
        lineStyle: { width: 3, color: '#38bdf8' },
        areaStyle: { color: 'rgba(56,189,248,0.12)' },
        data: snapshot.history.map((item) => item.score),
      },
      {
        name: 'L1',
        type: 'line',
        smooth: true,
        symbolSize: 6,
        lineStyle: { width: 2, color: '#f59e0b' },
        data: snapshot.history.map((item) => item.l1),
      },
      {
        name: 'L2',
        type: 'line',
        smooth: true,
        symbolSize: 6,
        lineStyle: { width: 2, color: '#34d399' },
        data: snapshot.history.map((item) => item.l2),
      },
      {
        name: 'L3',
        type: 'line',
        smooth: true,
        symbolSize: 6,
        lineStyle: { width: 2, color: '#a78bfa' },
        data: snapshot.history.map((item) => item.l3),
      },
    ],
  };
}

function agentHealthTone(agent: MemoryAgentScore) {
  if (!agent.vectorReady || agent.issues.length > 0) {
    return '#fda4af';
  }
  if (agent.dirty) {
    return '#fde68a';
  }
  return '#86efac';
}

function agentHealthLabel(agent: MemoryAgentScore) {
  if (!agent.vectorReady || agent.issues.length > 0) {
    return '需处理';
  }
  if (agent.dirty) {
    return '待同步';
  }
  return '健康';
}

export default function MultiAgentMemoryPage() {
  const [snapshot, setSnapshot] = useState<MemoryScoreSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MainTab>('overview');
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);

  async function loadSnapshot(force = false) {
    try {
      if (force) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const data = await getMemoryScore(force);
      setSnapshot(data);
      setActiveAgentId((current) => current ?? data.agents[0]?.agentId ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadSnapshot();
  }, []);

  const strongestLayer = useMemo(() => {
    if (!snapshot?.layers.length) {
      return null;
    }
    return snapshot.layers.reduce((best, layer) => (layer.score > best.score ? layer : best), snapshot.layers[0]);
  }, [snapshot]);

  const weakestLayer = useMemo(() => {
    if (!snapshot?.layers.length) {
      return null;
    }
    return snapshot.layers.reduce((worst, layer) => (layer.score < worst.score ? layer : worst), snapshot.layers[0]);
  }, [snapshot]);

  const indexedAgents = useMemo(() => {
    if (!snapshot) {
      return 0;
    }
    return snapshot.agents.filter((agent) => agent.vectorReady && agent.memorySourceFiles > 0).length;
  }, [snapshot]);

  const activeAgent = useMemo(() => {
    if (!snapshot?.agents.length) {
      return null;
    }
    return snapshot.agents.find((agent) => agent.agentId === activeAgentId) ?? snapshot.agents[0];
  }, [activeAgentId, snapshot]);

  if (loading && !snapshot) {
    return <div className="page-shell"><div className="panel glass-card">多 Agent 记忆视图加载中...</div></div>;
  }

  if (error && !snapshot) {
    return <div className="page-shell"><div className="panel glass-card error">加载失败：{error}</div></div>;
  }

  if (!snapshot) {
    return <div className="page-shell"><div className="panel glass-card">暂无记忆数据</div></div>;
  }

  return (
    <div className="page-shell lobster-page">
      <div className="bg-orb bg-orb-one" />
      <div className="bg-orb bg-orb-two" />
      <div className="bg-orb bg-orb-three" />

      <header className="glass-card lobster-header">
        <div>
          <div className="eyebrow">Multi-Agent Memory</div>
          <h1>多标签页记忆视图</h1>
          <p className="lobster-subtitle">
            面向多 Agent 的记忆总览、层级拆解、单 Agent 标签页和测试报告。
          </p>
        </div>
        <div className="header-right multi-memory-header-right">
          <p className="multi-memory-workspace"><strong>{snapshot.workspaceRoot}</strong></p>
          <div className="memory-layer-pill-row multi-memory-header-tags">
            <span>已索引 {indexedAgents}/{snapshot.totalAgents}</span>
            <span>最近调度 {formatTime(snapshot.scheduler.lastRunAt)}</span>
            <span>{snapshot.scheduler.enabled ? `每 ${snapshot.scheduler.intervalMinutes} 分钟巡检` : '自动巡检已关闭'}</span>
          </div>
          <button className="refresh-btn" type="button" onClick={() => void loadSnapshot(true)} disabled={refreshing}>
            {refreshing ? '刷新中...' : '刷新记忆快照'}
          </button>
        </div>
      </header>

      {error ? <div className="panel glass-card error">最新刷新失败：{error}</div> : null}

      <section className="kpi-grid multi-memory-kpi-grid" style={{ marginBottom: 16 }}>
        <article className="kpi-card gradient-card-soft multi-memory-kpi-card">
          <span style={statLabelStyle}>Overall</span>
          <div className="multi-memory-kpi-value multi-memory-kpi-value-lg">{metricText(snapshot.overall.score)}</div>
          <p>等级 {snapshot.overall.grade}</p>
        </article>
        <article className="kpi-card gradient-card-soft multi-memory-kpi-card">
          <span style={statLabelStyle}>Completeness</span>
          <div className="multi-memory-kpi-value">{metricText(snapshot.overall.completenessScore)}</div>
          <p>记忆覆盖完整度</p>
        </article>
        <article className="kpi-card gradient-card-soft multi-memory-kpi-card">
          <span style={statLabelStyle}>Quality</span>
          <div className="multi-memory-kpi-value">{metricText(snapshot.overall.qualityScore)}</div>
          <p>内容质量与可读性</p>
        </article>
        <article className="kpi-card gradient-card-soft multi-memory-kpi-card">
          <span style={statLabelStyle}>Index</span>
          <div className="multi-memory-kpi-value">{metricText(snapshot.overall.indexScore)}</div>
          <p>向量索引健康度</p>
        </article>
      </section>

      <section className="panel glass-card" style={{ marginBottom: 16 }}>
        <div className="multi-memory-tab-row">
          {tabs.map((tab) => (
            <button key={tab.key} type="button" style={tabButtonStyle(activeTab === tab.key)} onClick={() => setActiveTab(tab.key)}>
              <strong>{tab.shortLabel}</strong>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </section>

      {activeTab === 'overview' ? (
        <section className="multi-memory-overview-grid">
          <article className="panel glass-card memory-chart-panel">
            <div className="memory-panel-head">
              <div>
                <h3>记忆成长曲线</h3>
                <p>对比综合评分与三层记忆的阶段变化。</p>
              </div>
              <span>{snapshot.history.length} 天</span>
            </div>
            <ReactECharts option={buildChartOption(snapshot)} style={{ height: 320 }} />
          </article>

          <article className="panel glass-card memory-brief-card">
            <div className="memory-panel-head">
              <div>
                <h3>快速判断</h3>
                <p>适合先看结构状态，再决定切到哪一页。</p>
              </div>
              <span>{snapshot.layers.length} 层 / {snapshot.agents.length} Agent</span>
            </div>
            <div className="memory-brief-list">
              <div style={metricCardStyle}>
                <span style={statLabelStyle}>Strongest Layer</span>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{strongestLayer?.label ?? '--'}</div>
                <p style={{ color: '#cbd5e1', marginTop: 8 }}>得分 {metricText(strongestLayer?.score)}</p>
              </div>
              <div style={metricCardStyle}>
                <span style={statLabelStyle}>Weakest Layer</span>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{weakestLayer?.label ?? '--'}</div>
                <p style={{ color: '#cbd5e1', marginTop: 8 }}>得分 {metricText(weakestLayer?.score)}</p>
              </div>
              <div style={metricCardStyle}>
                <span style={statLabelStyle}>Scheduler</span>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{snapshot.scheduler.enabled ? '已启用' : '未启用'}</div>
                <p style={{ color: '#cbd5e1', marginTop: 8 }}>
                  {snapshot.scheduler.enabled ? `每 ${snapshot.scheduler.intervalMinutes} 分钟执行` : '当前不会自动巡检'}
                </p>
              </div>
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === 'layers' ? (
        <section className="memory-layer-stack">
          {snapshot.layers.map((layer) => (
            <article className="panel glass-card memory-layer-panel" key={layer.key}>
              <div className="memory-panel-head">
                <div>
                  <h3>{layer.label}</h3>
                  <p>{layer.summary}</p>
                </div>
                <span>得分 {metricText(layer.score)}</span>
              </div>

              <div className="memory-report-summary">
                <div style={metricCardStyle}>
                  <span style={statLabelStyle}>Completeness</span>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{metricText(layer.completenessScore)}</div>
                </div>
                <div style={metricCardStyle}>
                  <span style={statLabelStyle}>Quality</span>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{metricText(layer.qualityScore)}</div>
                </div>
                <div style={metricCardStyle}>
                  <span style={statLabelStyle}>Index</span>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{metricText(layer.indexScore)}</div>
                </div>
                <div style={metricCardStyle}>
                  <span style={statLabelStyle}>Vector</span>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{layer.indexed ? '已建立' : '未建立'}</div>
                </div>
              </div>

              <div className="memory-layer-list">
                {layer.files.map((file) => (
                  <div
                    key={file.path}
                    className="memory-layer-row multi-memory-file-row"
                  >
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ display: 'block', marginBottom: 6 }}>{file.label}</strong>
                      <p style={{ color: '#cbd5e1', wordBreak: 'break-all' }}>{file.path}</p>
                    </div>
                    <div className="memory-layer-pill-row multi-memory-meta-row">
                      <span>{file.exists ? '存在' : '缺失'}</span>
                      <span>质量 {file.qualityScore}</span>
                      <span>{file.indexed ? '已索引' : '未索引'}</span>
                      <span>{formatTime(file.updatedAt, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {activeTab === 'agents' ? (
        <section className="multi-memory-agents-grid">
          <aside className="panel glass-card memory-layer-panel">
            <div className="memory-panel-head">
              <div>
                <h3>Agent 标签</h3>
                <p>切换查看单 Agent 的记忆健康状态。</p>
              </div>
              <span>{snapshot.agents.length} 个</span>
            </div>
            <div className="memory-layer-stack">
              {snapshot.agents.map((agent) => {
                const active = agent.agentId === activeAgent?.agentId;
                return (
                  <button
                    key={agent.agentId}
                    type="button"
                    onClick={() => setActiveAgentId(agent.agentId)}
                    className={`multi-memory-agent-tab${active ? ' active' : ''}`}
                  >
                    <div className="multi-memory-agent-tab-head">
                      <strong>{agent.agentId}</strong>
                      <span className="multi-memory-agent-score" style={{ color: agentHealthTone(agent) }}>{agent.score}</span>
                    </div>
                    <div className="memory-layer-pill-row">
                      <span>{agentHealthLabel(agent)}</span>
                      <span>{agent.backend}</span>
                    </div>
                    <p className="multi-memory-agent-meta">
                      {agent.vectorReady ? '向量已就绪' : '向量未就绪'} · {agent.indexedFiles} 文件 · {agent.indexedChunks} chunks
                    </p>
                  </button>
                );
              })}
            </div>
          </aside>

          <article className="panel glass-card memory-agent-card">
            {activeAgent ? (
              <>
                <div className="memory-panel-head">
                  <div>
                    <h3>{activeAgent.agentId}</h3>
                    <p>{activeAgent.workspaceDir}</p>
                  </div>
                  <span>总分 {activeAgent.score}</span>
                </div>

                <div className="memory-report-summary">
                  <div style={metricCardStyle}>
                    <span style={statLabelStyle}>Backend</span>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{activeAgent.backend}</div>
                  </div>
                  <div style={metricCardStyle}>
                    <span style={statLabelStyle}>Memory Files</span>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{activeAgent.memorySourceFiles}</div>
                  </div>
                  <div style={metricCardStyle}>
                    <span style={statLabelStyle}>Session Files</span>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{activeAgent.sessionSourceFiles}</div>
                  </div>
                  <div style={metricCardStyle}>
                    <span style={statLabelStyle}>Dirty State</span>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{activeAgent.dirty ? 'Dirty' : 'Clean'}</div>
                  </div>
                </div>

                <div className="memory-layer-list" style={{ marginBottom: 16 }}>
                  {snapshot.layers.map((layer) => (
                    <div
                      key={`${activeAgent.agentId}-${layer.key}`}
                      className="memory-layer-row"
                    >
                      <div>
                        <strong>{layer.label}</strong>
                        <p style={{ color: '#cbd5e1', marginTop: 6 }}>{layer.summary}</p>
                      </div>
                      <span style={{ fontSize: 20, fontWeight: 800, color: '#93c5fd' }}>{layer.score}</span>
                    </div>
                  ))}
                </div>

                <div className="multi-memory-status-panel">
                  <strong style={{ display: 'block', marginBottom: 10 }}>状态与问题</strong>
                  <div className="memory-layer-pill-row" style={{ marginTop: 0, marginBottom: activeAgent.issues.length > 0 ? 12 : 0 }}>
                    <span>{activeAgent.vectorReady ? '向量已索引' : '向量未索引'}</span>
                    <span>{activeAgent.indexedFiles} 个索引文件</span>
                    <span>{activeAgent.indexedChunks} 个 chunks</span>
                  </div>
                  {activeAgent.issues.length > 0 ? (
                    <div className="memory-issue-list">
                      {activeAgent.issues.map((issue) => (
                        <span key={`${activeAgent.agentId}-${issue}`}>{issue}</span>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: '#86efac' }}>当前没有明显问题。</p>
                  )}
                </div>
              </>
            ) : (
              <p>暂无 Agent 数据</p>
            )}
          </article>
        </section>
      ) : null}

      {activeTab === 'tests' ? (
        <section className="panel glass-card memory-report-panel">
          <div className="memory-panel-head">
            <div>
              <h3>记忆测试报告</h3>
              <p>用于确认多 Agent 检索是否命中预期。</p>
            </div>
            <span>{snapshot.scheduler.testCaseCount} 个固定测试</span>
          </div>

          {snapshot.latestTestReport ? (
            <>
              <div className="memory-report-summary">
                <div style={metricCardStyle}>
                  <span style={statLabelStyle}>Run At</span>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{formatTime(snapshot.latestTestReport.runAt)}</div>
                </div>
                <div style={metricCardStyle}>
                  <span style={statLabelStyle}>Accuracy</span>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{snapshot.latestTestReport.accuracyRate}%</div>
                </div>
                <div style={metricCardStyle}>
                  <span style={statLabelStyle}>Latency</span>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{snapshot.latestTestReport.averageLatencyMs}ms</div>
                </div>
                <div style={metricCardStyle}>
                  <span style={statLabelStyle}>Pass Rate</span>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>
                    {snapshot.latestTestReport.passedCases}/{snapshot.latestTestReport.totalCases}
                  </div>
                </div>
              </div>

              <div className="memory-test-case-list">
                {snapshot.latestTestReport.results.map((result) => (
                  <article
                    key={`${result.agentId}-${result.id}`}
                    className="memory-test-case multi-memory-test-case"
                  >
                    <div className="multi-memory-test-head">
                      <div>
                        <strong>{result.agentId}</strong>
                        <p style={{ color: '#cbd5e1', marginTop: 6 }}>{result.query}</p>
                      </div>
                      <span className="multi-memory-test-status" style={{ color: result.passed ? '#86efac' : '#fda4af' }}>
                        {result.passed ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                    <div className="memory-layer-pill-row multi-memory-meta-row">
                      <span>耗时 {result.latencyMs}ms</span>
                      <span>命中 {result.hitCount}</span>
                      <span>{result.matchedExpectation ? '符合预期' : '未达预期'}</span>
                      {result.error ? <span style={{ color: '#fecaca' }}>错误: {result.error}</span> : null}
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div style={metricCardStyle}>
              <strong style={{ display: 'block', marginBottom: 8 }}>暂无测试报告</strong>
              <p style={{ color: '#cbd5e1' }}>可以先接入后端定时任务，再回到这个标签页查看多 Agent 检索质量。</p>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
