import ReactECharts from 'echarts-for-react';
import type { MemoryScoreSnapshot } from '../types';

function chartOption(snapshot: MemoryScoreSnapshot) {
  const history = snapshot.history || [];
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: {
      textStyle: { color: '#dbeafe' },
      top: 0,
    },
    grid: {
      left: 24,
      right: 18,
      top: 42,
      bottom: 26,
    },
    xAxis: {
      type: 'category',
      data: history.map((item) => item.date.slice(5)),
      axisLine: { lineStyle: { color: 'rgba(191, 219, 254, 0.35)' } },
      axisLabel: { color: '#cbd5e1' },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { color: '#cbd5e1' },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.15)' } },
    },
    series: [
      {
        name: '综合评分',
        type: 'line',
        smooth: true,
        symbolSize: 8,
        lineStyle: { width: 3, color: '#38bdf8' },
        areaStyle: { color: 'rgba(56, 189, 248, 0.16)' },
        data: history.map((item) => item.score),
      },
      {
        name: 'L3 工作记忆',
        type: 'line',
        smooth: true,
        symbolSize: 6,
        lineStyle: { width: 2, color: '#34d399' },
        data: history.map((item) => item.l3),
      },
    ],
  };
}

function metricText(value?: number) {
  return Number.isFinite(value) ? String(value) : '--';
}

function formatTimeLabel(value?: string | null) {
  if (!value) {
    return '暂无';
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

export default function MemoryScorePanel({
  snapshot,
  loading,
  error,
}: {
  snapshot: MemoryScoreSnapshot | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading && !snapshot) {
    return <div className="panel glass-card">正在分析三层记忆与向量索引...</div>;
  }

  if (error && !snapshot) {
    return <div className="panel error glass-card">记忆评分加载失败：{error}</div>;
  }

  if (!snapshot) {
    return <div className="panel glass-card">暂无记忆评分数据</div>;
  }

  const indexedAgents = snapshot.agents.filter((agent) => agent.vectorReady && agent.memorySourceFiles > 0).length;
  const strongestLayer = snapshot.layers.reduce((best, layer) => (layer.score > best.score ? layer : best), snapshot.layers[0]);
  const weakestLayer = snapshot.layers.reduce((best, layer) => (layer.score < best.score ? layer : best), snapshot.layers[0]);
  const pendingAgents = snapshot.agents.filter((agent) => !agent.vectorReady || agent.memorySourceFiles === 0);

  return (
    <div className="memory-score-layout fade-in-up delay-3">
      <section className="memory-insight-grid">
        <article className="panel glass-card memory-score-hero">
          <div className="memory-panel-head">
            <div>
              <h3>综合记忆评分</h3>
              <p>综合完整性、质量和索引健康度，适合先看总状态。</p>
            </div>
            <span>等级 {snapshot.overall.grade}</span>
          </div>
          <div className="memory-score-hero-value">{metricText(snapshot.overall.score)}</div>
          <div className="memory-hero-stats">
            <div>
              <strong>{snapshot.overall.completenessScore}</strong>
              <span>完整性</span>
            </div>
            <div>
              <strong>{snapshot.overall.qualityScore}</strong>
              <span>质量</span>
            </div>
            <div>
              <strong>{snapshot.overall.indexScore}</strong>
              <span>索引健康</span>
            </div>
          </div>
          <div className="memory-hero-footnote">
            已索引 Agent {indexedAgents}/{snapshot.agents.length}，最近调度 {formatTimeLabel(snapshot.scheduler.lastRunAt)}
          </div>
        </article>

        <article className="panel glass-card memory-brief-card">
          <div className="memory-panel-head">
            <div>
              <h3>结构判断</h3>
              <p>快速定位当前层级中的强项和短板。</p>
            </div>
            <span>{snapshot.layers.length} 层</span>
          </div>
          <div className="memory-brief-list">
            <div className="memory-brief-item">
              <label>最佳层级</label>
              <strong>{strongestLayer?.label ?? '--'}</strong>
              <span>得分 {metricText(strongestLayer?.score)}</span>
            </div>
            <div className="memory-brief-item">
              <label>待补层级</label>
              <strong>{weakestLayer?.label ?? '--'}</strong>
              <span>得分 {metricText(weakestLayer?.score)}</span>
            </div>
            <div className="memory-brief-item">
              <label>待处理 Agent</label>
              <strong>{pendingAgents.length}</strong>
              <span>{pendingAgents.length === 0 ? '全部已就绪' : '存在未索引或无记忆源'}</span>
            </div>
          </div>
        </article>
      </section>

      <section className="memory-analysis-grid">
        <section className="panel glass-card memory-chart-panel">
          <div className="memory-panel-head">
            <div>
              <h3>成长曲线</h3>
              <p>记录每日综合评分与 L3 工作记忆变化</p>
            </div>
            <span>{snapshot.history.length} 天</span>
          </div>
          <ReactECharts option={chartOption(snapshot)} style={{ height: 280 }} />
        </section>

        <section className="panel glass-card memory-layer-panel">
          <div className="memory-panel-head">
            <div>
              <h3>层级拆解</h3>
              <p>逐层查看完整性、质量和索引状态。</p>
            </div>
            <span>三层记忆</span>
          </div>
          <div className="memory-layer-stack">
            {snapshot.layers.map((layer) => (
              <article className="memory-layer-card" key={layer.key}>
                <div className="memory-layer-card-head">
                  <div>
                    <strong>{layer.label}</strong>
                    <p>{layer.summary}</p>
                  </div>
                  <span>{metricText(layer.score)}</span>
                </div>
                <div className="memory-layer-pill-row">
                  <span>完整性 {layer.completenessScore}</span>
                  <span>质量 {layer.qualityScore}</span>
                  <span>索引 {layer.indexed ? '已建立' : '未建立'}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="memory-agent-grid">
        {snapshot.agents.map((agent) => (
          <article className="panel glass-card memory-agent-card" key={agent.agentId}>
            <div className="memory-panel-head">
              <div>
                <h3>{agent.agentId}</h3>
                <p>{agent.workspaceDir}</p>
              </div>
              <strong>{agent.score}</strong>
            </div>
            <div className="memory-agent-meta">
              <span>{agent.backend}</span>
              <span>{agent.vectorReady ? '向量已索引' : '向量未就绪'}</span>
              <span>{agent.indexedFiles} 索引文件</span>
              <span>{agent.indexedChunks} chunks</span>
            </div>
            <div className="memory-layer-list">
              {snapshot.layers.map((layer) => (
                <div className="memory-layer-row" key={`${agent.agentId}-${layer.key}`}>
                  <div>
                    <strong>{layer.label}</strong>
                    <p>{layer.summary}</p>
                  </div>
                  <span>{layer.score}</span>
                </div>
              ))}
            </div>
            {agent.issues.length > 0 ? (
              <div className="memory-issue-list">
                {agent.issues.map((issue, idx) => (
                  <span key={`${agent.agentId}-issue-${idx}`}>{issue}</span>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </section>

      <section className="panel glass-card memory-report-panel">
        <div className="memory-panel-head">
          <div>
            <h3>定时测试</h3>
            <p>{snapshot.scheduler.enabled ? `每 ${snapshot.scheduler.intervalMinutes} 分钟执行一次` : '已禁用'}</p>
          </div>
          <span>{snapshot.scheduler.testCaseCount} 个固定测试用例</span>
        </div>
        {snapshot.latestTestReport ? (
          <>
            <div className="memory-report-summary">
              <div>
                <strong>{snapshot.latestTestReport.accuracyRate}%</strong>
                <span>准确率</span>
              </div>
              <div>
                <strong>{snapshot.latestTestReport.averageLatencyMs}ms</strong>
                <span>平均响应时间</span>
              </div>
              <div>
                <strong>{snapshot.latestTestReport.passedCases}/{snapshot.latestTestReport.totalCases}</strong>
                <span>通过用例</span>
              </div>
            </div>
            <div className="memory-test-case-list">
              {snapshot.latestTestReport.results.map((item) => (
                <div className="memory-test-case" key={`${item.agentId}-${item.id}`}>
                  <div>
                    <strong>{item.agentId}</strong>
                    <p>{item.query}</p>
                  </div>
                  <span>{item.passed ? 'PASS' : 'FAIL'} / {item.latencyMs}ms</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="lobster-news-empty">还没有测试报告。可使用 `backend/package.json` 里的 `memory:cron` 脚本接入 cron。</p>
        )}
      </section>
    </div>
  );
}
