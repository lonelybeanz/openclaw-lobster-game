import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { HealthMetricTrend, HealthTrendSnapshot } from '../types';

type Props = {
  snapshot: HealthTrendSnapshot | null;
  loading: boolean;
  error: string | null;
};

const TREND_TEXT: Record<HealthMetricTrend, string> = {
  rising: '上升',
  falling: '下降',
  stable: '平稳',
};

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function buildChartOption(snapshot: HealthTrendSnapshot) {
  return {
    backgroundColor: 'transparent',
    color: ['#4ade80', '#f472b6', '#f59e0b'],
    tooltip: { trigger: 'axis' },
    legend: {
      top: 4,
      textStyle: { color: '#dbeafe' },
    },
    grid: {
      left: 24,
      right: 20,
      top: 48,
      bottom: 28,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: snapshot.records.map((item) => formatDateLabel(item.timestamp)),
      axisLine: { lineStyle: { color: 'rgba(191, 219, 254, 0.35)' } },
      axisLabel: { color: '#cbd5e1' },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { color: '#94a3b8' },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.14)' } },
    },
    series: [
      {
        name: '健康',
        type: 'line',
        smooth: true,
        symbolSize: 7,
        lineStyle: { width: 3 },
        areaStyle: { color: 'rgba(74, 222, 128, 0.12)' },
        data: snapshot.records.map((item) => item.health),
      },
      {
        name: '心情',
        type: 'line',
        smooth: true,
        symbolSize: 7,
        lineStyle: { width: 3 },
        data: snapshot.records.map((item) => item.mood),
      },
      {
        name: '疲劳',
        type: 'line',
        smooth: true,
        symbolSize: 7,
        lineStyle: { width: 3 },
        data: snapshot.records.map((item) => item.fatigue),
      },
    ],
  };
}

function metricText(value: number) {
  return Number.isFinite(value) ? value.toFixed(1) : '--';
}

export default function HealthTimelinePanel({ snapshot, loading, error }: Props) {
  const option = useMemo(() => (snapshot ? buildChartOption(snapshot) : null), [snapshot]);

  if (loading && !snapshot) {
    return <section className="panel glass-card">健康时间线加载中...</section>;
  }

  if (error && !snapshot) {
    return <section className="panel error glass-card">健康时间线加载失败：{error}</section>;
  }

  if (!snapshot || snapshot.records.length === 0 || !option) {
    return <section className="panel glass-card">最近 30 天暂无健康时间线数据</section>;
  }

  return (
    <section className="panel glass-card fade-in-up delay-3">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '12px',
          alignItems: 'flex-start',
          marginBottom: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>健康时间线</h3>
          <p style={{ margin: '6px 0 0', color: '#cbd5e1' }}>展示过去 30 天的健康、心情和疲劳趋势。</p>
        </div>
        <span style={{ color: '#94a3b8', fontSize: '13px' }}>{snapshot.records.length} 个样本</span>
      </div>

      <ReactECharts option={option} style={{ height: 320 }} notMerge lazyUpdate />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginTop: '12px' }}>
        <article className="kpi-card gradient-card-soft">
          <p>平均健康</p>
          <h2>{metricText(snapshot.averages.health)}</h2>
          <span>趋势 {TREND_TEXT[snapshot.trends.health]}</span>
        </article>
        <article className="kpi-card gradient-card-soft">
          <p>平均心情</p>
          <h2>{metricText(snapshot.averages.mood)}</h2>
          <span>趋势 {TREND_TEXT[snapshot.trends.mood]}</span>
        </article>
        <article className="kpi-card gradient-card-soft">
          <p>平均疲劳</p>
          <h2>{metricText(snapshot.averages.fatigue)}</h2>
          <span>趋势 {TREND_TEXT[snapshot.trends.fatigue]}</span>
        </article>
      </div>
    </section>
  );
}
