import ReactECharts from 'echarts-for-react';
import { useMemo } from 'react';
import type { HealthPeriod, HealthRecord } from '../types';

interface HealthChartProps {
  period: HealthPeriod;
  data: HealthRecord[];
}

function findAnomalies(data: HealthRecord[], key: keyof Omit<HealthRecord, 'timestamp'>) {
  return data
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      const value = item[key];
      return typeof value === 'number' && (value <= 25 || value >= 85);
    })
    .map(({ item, index }) => ({
      coord: [index, item[key] as number],
      value: item[key],
    }));
}

export default function HealthChart({ period, data }: HealthChartProps) {
  const option = useMemo(() => {
    const labels = data.map((item) =>
      new Date(item.timestamp).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }),
    );
    const hunger = data.map((item) => item.hunger);
    const mood = data.map((item) => item.mood);
    const fatigue = data.map((item) => item.fatigue);
    const health = data.map((item) => item.health);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(7, 16, 30, 0.94)',
        borderColor: 'rgba(148, 163, 184, 0.22)',
        textStyle: { color: '#e2e8f0' },
      },
      legend: {
        top: 0,
        textStyle: { color: '#cbd5e1' },
      },
      grid: {
        left: 26,
        right: 28,
        top: 48,
        bottom: 70,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: labels,
        axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.28)' } },
        axisLabel: { color: '#94a3b8' },
      },
      yAxis: [
        {
          type: 'value',
          min: 0,
          max: 100,
          axisLine: { show: false },
          splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.14)' } },
          axisLabel: { color: '#94a3b8' },
        },
        {
          type: 'value',
          min: 0,
          max: 100,
          position: 'right',
          splitLine: { show: false },
          axisLabel: { color: '#94a3b8' },
        },
      ],
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100,
        },
        {
          bottom: 16,
          height: 18,
          borderColor: 'rgba(148, 163, 184, 0.18)',
          fillerColor: 'rgba(45, 212, 191, 0.18)',
          backgroundColor: 'rgba(15, 23, 42, 0.55)',
        },
      ],
      series: [
        {
          name: 'Hunger',
          type: 'line',
          yAxisIndex: 0,
          smooth: true,
          symbol: 'circle',
          symbolSize: 7,
          data: hunger,
          lineStyle: { width: 3, color: '#fb7185' },
          itemStyle: { color: '#fb7185' },
          areaStyle: { color: 'rgba(251, 113, 133, 0.2)' },
          markPoint: { data: findAnomalies(data, 'hunger') },
        },
        {
          name: 'Mood',
          type: 'line',
          yAxisIndex: 0,
          smooth: true,
          symbol: 'circle',
          symbolSize: 7,
          data: mood,
          lineStyle: { width: 3, color: '#facc15' },
          itemStyle: { color: '#facc15' },
          areaStyle: { color: 'rgba(250, 204, 21, 0.2)' },
          markPoint: { data: findAnomalies(data, 'mood') },
        },
        {
          name: 'Fatigue',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          symbol: 'circle',
          symbolSize: 7,
          data: fatigue,
          lineStyle: { width: 3, color: '#60a5fa' },
          itemStyle: { color: '#60a5fa' },
          areaStyle: { color: 'rgba(96, 165, 250, 0.2)' },
          markPoint: { data: findAnomalies(data, 'fatigue') },
        },
        {
          name: 'Health',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          symbol: 'circle',
          symbolSize: 7,
          data: health,
          lineStyle: { width: 3, color: '#34d399' },
          itemStyle: { color: '#34d399' },
          areaStyle: { color: 'rgba(52, 211, 153, 0.2)' },
          markPoint: { data: findAnomalies(data, 'health') },
        },
      ],
    };
  }, [data]);

  return (
    <section className="timeline-card">
      <div className="timeline-card-head">
        <div>
          <p className="timeline-kicker">健康趋势</p>
          <h2>{period.toUpperCase()} 状态波动</h2>
        </div>
      </div>
      <ReactECharts option={option} style={{ height: 340 }} />
    </section>
  );
}
