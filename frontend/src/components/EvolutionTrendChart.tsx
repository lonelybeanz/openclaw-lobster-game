import ReactECharts from 'echarts-for-react';
import type { VisualizationPoint } from '../types';

function formatScore(value?: number) {
  return Number.isFinite(value) ? value!.toFixed(1) : '--';
}

export default function EvolutionTrendChart({ trend }: { trend: VisualizationPoint[] }) {
  if (!trend.length) {
    return <section className="panel glass-card">暂无进化得分趋势数据</section>;
  }

  const firstValue = trend[0]?.value ?? 0;
  const lastValue = trend[trend.length - 1]?.value ?? 0;
  const delta = Math.round((lastValue - firstValue) * 10) / 10;
  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    grid: { left: 24, right: 20, top: 28, bottom: 24, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trend.map((item) => item.label),
      axisLine: { lineStyle: { color: 'rgba(191, 219, 254, 0.35)' } },
      axisLabel: { color: '#cbd5e1' },
    },
    yAxis: {
      type: 'value',
      min: (value: { min: number }) => Math.max(0, Math.floor(value.min - 5)),
      max: (value: { max: number }) => Math.min(100, Math.ceil(value.max + 5)),
      axisLine: { show: false },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.14)' } },
      axisLabel: { color: '#94a3b8' },
    },
    series: [
      {
        name: '进化得分',
        type: 'line',
        smooth: true,
        symbolSize: 7,
        data: trend.map((item) => item.value),
        lineStyle: { width: 3, color: '#fb7185' },
        areaStyle: { color: 'rgba(251, 113, 133, 0.16)' },
        itemStyle: { color: '#fda4af' },
      },
    ],
  };

  return (
    <section className="panel glass-card" style={{ marginBottom: '12px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h4 style={{ margin: '0 0 6px 0' }}>进化得分趋势</h4>
          <p style={{ margin: 0, color: '#cbd5e1', fontSize: '13px' }}>基于近 30 天 token 与记忆快照估算每日进化得分。</p>
        </div>
        <div style={{ display: 'flex', gap: '16px', color: '#e2e8f0' }}>
          <div>
            <div style={{ fontSize: '12px', opacity: 0.75 }}>当前</div>
            <strong style={{ fontSize: '18px' }}>{formatScore(lastValue)}</strong>
          </div>
          <div>
            <div style={{ fontSize: '12px', opacity: 0.75 }}>30 天变化</div>
            <strong style={{ fontSize: '18px', color: delta >= 0 ? '#34d399' : '#fda4af' }}>{delta >= 0 ? '+' : ''}{formatScore(delta)}</strong>
          </div>
        </div>
      </div>
      <ReactECharts option={option} style={{ height: 300 }} notMerge lazyUpdate />
    </section>
  );
}
