import { useMemo } from 'react';
import type { GrowthHeatmapItem } from '../types';

interface GrowthHeatmapProps {
  data: GrowthHeatmapItem[];
  year?: number;
}

type HeatCell = {
  date: string;
  interactions: number;
  deepTalks: number;
  monthLabel?: string;
};

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function getCellTone(interactions: number) {
  if (interactions <= 0) {
    return 'var(--timeline-heat-0)';
  }
  if (interactions <= 5) {
    return 'var(--timeline-heat-1)';
  }
  if (interactions <= 10) {
    return 'var(--timeline-heat-2)';
  }
  return 'var(--timeline-heat-3)';
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  next.setDate(date.getDate() - date.getDay());
  next.setHours(0, 0, 0, 0);
  return next;
}

export default function GrowthHeatmap({ data, year = new Date().getFullYear() }: GrowthHeatmapProps) {
  const { cells, months, totalInteractions, totalDeepTalks, activeDays } = useMemo(() => {
    const dataMap = new Map(data.map((item) => [item.date, item]));
    const jan1 = new Date(year, 0, 1);
    const dec31 = new Date(year, 11, 31);
    const start = startOfWeek(jan1);
    const end = startOfWeek(dec31);
    end.setDate(end.getDate() + 6);

    const nextCells: HeatCell[] = [];
    const monthMarkers: Array<{ label: string; column: number }> = [];
    let cursor = new Date(start);
    let previousMonth = -1;

    while (cursor <= end) {
      const dateKey = cursor.toISOString().slice(0, 10);
      const current = dataMap.get(dateKey);
      const isCurrentYear = cursor.getFullYear() === year;
      const weekIndex = Math.floor((cursor.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));

      if (isCurrentYear && cursor.getMonth() !== previousMonth && cursor.getDate() <= 7) {
        monthMarkers.push({
          label: `${cursor.getMonth() + 1}月`,
          column: weekIndex,
        });
        previousMonth = cursor.getMonth();
      }

      nextCells.push({
        date: dateKey,
        interactions: isCurrentYear ? current?.interactions ?? 0 : 0,
        deepTalks: isCurrentYear ? current?.deepTalks ?? 0 : 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return {
      cells: nextCells,
      months: monthMarkers,
      totalInteractions: data.reduce((sum, item) => sum + item.interactions, 0),
      totalDeepTalks: data.reduce((sum, item) => sum + item.deepTalks, 0),
      activeDays: data.filter((item) => item.interactions > 0).length,
    };
  }, [data, year]);

  return (
    <section className="timeline-card">
      <div className="timeline-card-head">
        <div>
          <p className="timeline-kicker">互动频率</p>
          <h2>年度热力图</h2>
        </div>
        <div className="timeline-stat-row">
          <span>{activeDays} 个活跃日</span>
          <span>{totalInteractions} 次互动</span>
          <span>{totalDeepTalks} 次深聊</span>
        </div>
      </div>

      <div className="heatmap-shell">
        <div className="heatmap-months" style={{ gridTemplateColumns: '28px repeat(53, minmax(0, 1fr))' }}>
          <span />
          {Array.from({ length: 53 }, (_, column) => {
            const marker = months.find((item) => item.column === column);
            return (
              <span key={column} className="heatmap-month-label">
                {marker?.label ?? ''}
              </span>
            );
          })}
        </div>

        <div className="heatmap-grid">
          <div className="heatmap-weekdays">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="heatmap-cells" role="grid" aria-label={`${year} 年互动热力图`}>
            {cells.map((cell) => (
              <div
                key={cell.date}
                className="heatmap-cell"
                role="gridcell"
                title={`${cell.date}｜互动 ${cell.interactions} 次｜深聊 ${cell.deepTalks} 次`}
                style={{ background: getCellTone(cell.interactions) }}
              />
            ))}
          </div>
        </div>

        <div className="heatmap-legend">
          <span>少</span>
          <i style={{ background: 'var(--timeline-heat-0)' }} />
          <i style={{ background: 'var(--timeline-heat-1)' }} />
          <i style={{ background: 'var(--timeline-heat-2)' }} />
          <i style={{ background: 'var(--timeline-heat-3)' }} />
          <span>多</span>
        </div>
      </div>
    </section>
  );
}
