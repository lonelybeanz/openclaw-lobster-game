import ReactECharts from 'echarts-for-react';
import type { VisualizationSnapshot } from '../types';

type Props = {
  snapshot: VisualizationSnapshot | null;
  loading: boolean;
  error: string | null;
};

function formatNumber(value: number) {
  return value.toLocaleString('zh-CN');
}

function formatDateTime(value?: string | null) {
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

export default function VisualizationDashboard({ snapshot, loading, error }: Props) {
  if (loading) {
    return <section className="panel glass-card">图表数据加载中...</section>;
  }

  if (error) {
    return <section className="panel error glass-card">图表数据加载失败：{error}</section>;
  }

  if (!snapshot) {
    return <section className="panel glass-card">暂无可视化数据</section>;
  }

  const tokenOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    grid: { left: 24, right: 20, top: 24, bottom: 24, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: snapshot.tokens.dailyTrend.map((item) => item.label),
      axisLine: { lineStyle: { color: 'rgba(191, 219, 254, 0.35)' } },
      axisLabel: { color: '#cbd5e1' },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.14)' } },
      axisLabel: { color: '#94a3b8' },
    },
    series: [
      {
        name: 'Token',
        type: 'line',
        smooth: true,
        symbolSize: 8,
        data: snapshot.tokens.dailyTrend.map((item) => item.value),
        lineStyle: { width: 3, color: '#38bdf8' },
        areaStyle: {
          color: 'rgba(56, 189, 248, 0.18)',
        },
        itemStyle: { color: '#67e8f9' },
      },
    ],
  };

  const memoryOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: {
      top: 4,
      textStyle: { color: '#dbeafe' },
    },
    grid: { left: 24, right: 20, top: 52, bottom: 24, containLabel: true },
    xAxis: {
      type: 'category',
      data: snapshot.memory.growthTrend.map((item) => item.label),
      axisLine: { lineStyle: { color: 'rgba(191, 219, 254, 0.35)' } },
      axisLabel: { color: '#cbd5e1' },
    },
    yAxis: [
      {
        type: 'value',
        name: '评分',
        axisLabel: { color: '#94a3b8' },
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.14)' } },
      },
      {
        type: 'value',
        name: '增长',
        axisLabel: { color: '#94a3b8' },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '记忆评分',
        type: 'bar',
        barWidth: 22,
        data: snapshot.memory.growthTrend.map((item) => item.score),
        itemStyle: {
          borderRadius: [8, 8, 0, 0],
          color: '#a78bfa',
        },
      },
      {
        name: '日增长',
        type: 'bar',
        yAxisIndex: 1,
        barWidth: 22,
        data: snapshot.memory.growthTrend.map((item) => item.growth),
        itemStyle: {
          borderRadius: [8, 8, 0, 0],
          color: '#f59e0b',
        },
      },
    ],
  };

  const skillsOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    legend: {
      bottom: 0,
      textStyle: { color: '#dbeafe' },
    },
    series: [
      {
        name: '技能分布',
        type: 'pie',
        radius: ['42%', '70%'],
        center: ['50%', '46%'],
        avoidLabelOverlap: true,
        label: {
          color: '#e2e8f0',
          formatter: '{b}\n{d}%',
        },
        itemStyle: {
          borderColor: 'rgba(15, 23, 42, 0.7)',
          borderWidth: 2,
        },
        data: snapshot.skills.distribution.map((item) => ({
          name: item.name,
          value: item.value,
        })),
      },
    ],
    color: ['#38bdf8', '#34d399', '#fb7185', '#f59e0b', '#818cf8', '#22d3ee'],
  };

  return (
    <section className="visualization-panel fade-in-up delay-3">
      <article className="panel glass-card visualization-hero">
        <div>
          <div className="memory-overview-badge">Visualization</div>
          <h3>数据可视化面板</h3>
          <p>汇总 token 消耗、记忆增长和技能分布，便于从时间维度观察变化趋势。</p>
        </div>
        <div className="visualization-meta">
          <span>最近刷新：{formatDateTime(snapshot.updatedAt)}</span>
          <span>Token 更新：{formatDateTime(snapshot.tokens.summary.lastUpdated)}</span>
        </div>
      </article>

      <section className="visualization-kpi-grid">
        <article className="kpi-card gradient-card-soft">
          <p>累计 Token</p>
          <h2>{formatNumber(snapshot.tokens.summary.totalTokens)}</h2>
        </article>
        <article className="kpi-card gradient-card-soft">
          <p>会话数</p>
          <h2>{formatNumber(snapshot.tokens.summary.totalSessions)}</h2>
        </article>
        <article className="kpi-card gradient-card-soft">
          <p>单会话均值</p>
          <h2>{formatNumber(snapshot.tokens.summary.avgPerSession)}</h2>
        </article>
        <article className="kpi-card gradient-card-soft">
          <p>记忆增长</p>
          <h2>{snapshot.memory.summary.latestGrowth >= 0 ? '+' : ''}{snapshot.memory.summary.latestGrowth}</h2>
        </article>
      </section>

      <section className="visualization-grid">
        <article className="panel glass-card visualization-chart-card">
          <div className="visualization-card-head">
            <div>
              <h3>Token 趋势</h3>
              <p>折线图显示近 14 天变化，下方补充近 8 周汇总。</p>
            </div>
          </div>
          <ReactECharts option={tokenOption} style={{ height: 320 }} notMerge lazyUpdate />
          <div className="visualization-skill-tags">
            {snapshot.tokens.weeklyTrend.map((item) => (
              <span key={item.label}>{item.label} · {formatNumber(item.value)}</span>
            ))}
          </div>
        </article>

        <article className="panel glass-card visualization-chart-card">
          <div className="visualization-card-head">
            <div>
              <h3>记忆增长</h3>
              <p>展示综合评分以及相邻样本日增长。</p>
            </div>
          </div>
          <ReactECharts option={memoryOption} style={{ height: 320 }} notMerge lazyUpdate />
        </article>

        <article className="panel glass-card visualization-chart-card">
          <div className="visualization-card-head">
            <div>
              <h3>技能分布</h3>
              <p>当前技能类别占比，用于观察能力面覆盖。</p>
            </div>
          </div>
          <ReactECharts option={skillsOption} style={{ height: 320 }} notMerge lazyUpdate />
        </article>

        <article className="panel glass-card visualization-list-card">
          <div className="visualization-card-head">
            <div>
              <h3>高消耗会话</h3>
              <p>最近统计中 Token 占用最高的会话。</p>
            </div>
          </div>
          <div className="visualization-list">
            {snapshot.tokens.topSessions.length === 0 ? <p className="lobster-news-empty">暂无会话数据</p> : null}
            {snapshot.tokens.topSessions.map((item) => (
              <div key={item.key} className="visualization-list-item">
                <div>
                  <strong>{item.key}</strong>
                  <span>{item.model}</span>
                </div>
                <div>
                  <strong>{formatNumber(item.tokens)}</strong>
                  <span>{formatDateTime(item.updatedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel glass-card visualization-list-card">
          <div className="visualization-card-head">
            <div>
              <h3>技能摘要</h3>
              <p>当前技能库存与重点技能预览。</p>
            </div>
          </div>
          <div className="visualization-skill-summary">
            <div className="memory-layer-pill-row">
              <span>总技能 {snapshot.skills.summary.total}</span>
              <span>分类 {snapshot.skills.summary.categoryCount}</span>
              <span>索引 Agent {snapshot.memory.summary.indexedAgents}/{snapshot.memory.summary.totalAgents}</span>
            </div>
            <div className="visualization-skill-tags">
              {snapshot.skills.topSkills.map((item) => (
                <span key={item.name} title={item.description}>
                  {item.category} · {item.name}
                </span>
              ))}
            </div>
          </div>
        </article>
      </section>
    </section>
  );
}
